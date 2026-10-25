import { getCourseById } from '../models/course';
import {
  closePendingPaymentOrder,
  getPaymentOrder,
  paymentOrderCheckoutId,
} from '../models/paymentOrder';
import {
  consumeRetakeCodeForOrder,
  generateRetakeCodeValue,
  getRetakeDiscountCodeByCode,
  getRetakeDiscountCodeById,
  insertRetakeDiscountCode,
  listRetakeDiscountCodes,
  markRetakeCodeEmailSent,
  releaseRetakeCodeForOrder,
  reserveRetakeCode,
  type RetakeDiscountCode,
} from '../models/retakeDiscountCode';
import { sendRetakeDiscountCodeEmail } from './retakeDiscountEmail';
import { expireOpenStripeCheckoutSession } from './stripeCheckout';
import {
  applyRetakeDiscount,
  normalizeRetakeCode,
  parseRetakeDiscount,
  retakeEmailsMatch,
  type RetakeDiscountType,
} from './retakeDiscountMath';

export const DEFAULT_DISCOUNT_CC_EMAIL = 'office@vls-online.com';

export class RetakeCodeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'RetakeCodeError';
    this.status = status;
  }
}

export type IssuedRetakeCode = RetakeDiscountCode & {
  emailSent: boolean;
  emailError: string | null;
};

function discountLabel(type: RetakeDiscountType, value: number): string {
  if (type === 'percent') return `${value}%`;
  return `$${value.toFixed(2)}`;
}

function parseCcEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase() || DEFAULT_DISCOUNT_CC_EMAIL;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RetakeCodeError('Enter a valid CC email.');
  }
  return email;
}

async function loadUsableCode(input: {
  code: string;
  email: string;
  courseId: number;
}): Promise<RetakeDiscountCode> {
  const code = normalizeRetakeCode(input.code);
  if (!code) throw new RetakeCodeError('Enter a discount code.');
  const row = await getRetakeDiscountCodeByCode(code);
  if (!row) throw new RetakeCodeError('That discount code was not recognised.');
  if (row.used) throw new RetakeCodeError('This discount code has already been used.');
  if (!retakeEmailsMatch(row.studentEmail, input.email)) {
    throw new RetakeCodeError('This discount code was issued to a different email address.');
  }
  if (row.courseId !== input.courseId) {
    throw new RetakeCodeError('This discount code is for a different course.');
  }
  return row;
}

export async function issueRetakeDiscountCode(input: {
  firstName: string;
  lastName: string;
  email: string;
  courseId: number;
  discountType: unknown;
  discountValue: unknown;
  ccEmail?: unknown;
  createdBy: number | null;
}): Promise<IssuedRetakeCode> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  if (!firstName || !lastName) throw new RetakeCodeError('Enter the student first and last name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RetakeCodeError('Enter a valid student email.');
  if (!Number.isInteger(input.courseId) || input.courseId <= 0) throw new RetakeCodeError('Choose a course.');

  const discount = parseRetakeDiscount(input);
  if ('error' in discount) throw new RetakeCodeError(discount.error);

  const course = await getCourseById(input.courseId);
  if (!course || !course.isActive) throw new RetakeCodeError('Course not found or inactive.', 404);
  const ccEmail = parseCcEmail(input.ccEmail);

  let saved: RetakeDiscountCode | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      saved = await insertRetakeDiscountCode({
        code: generateRetakeCodeValue(),
        courseId: course.id,
        studentEmail: email,
        firstName,
        lastName,
        discountType: discount.type,
        discountValue: discount.value,
        ccEmail,
        createdBy: input.createdBy,
      });
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate|unique/i.test(message) || attempt === 4) throw err;
    }
  }
  if (!saved) throw new RetakeCodeError('Could not generate a discount code.');

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendRetakeDiscountCodeEmail({
      to: email,
      cc: ccEmail,
      firstName,
      courseName: course.name,
      coursePageUrl: course.coursePageUrl,
      code: saved.code,
      discountLabel: discountLabel(discount.type, discount.value),
    });
    await markRetakeCodeEmailSent(saved.id);
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'The code was saved, but the email could not be sent.';
    console.error('[retake-code] email failed', emailError);
  }

  const fresh = await getRetakeDiscountCodeById(saved.id);
  return { ...(fresh ?? saved), courseName: course.name, emailSent, emailError };
}

export async function resendRetakeDiscountCode(id: number): Promise<IssuedRetakeCode> {
  const row = await getRetakeDiscountCodeById(id);
  if (!row) throw new RetakeCodeError('Discount code not found.', 404);
  if (row.used) throw new RetakeCodeError('This discount code has already been used.');
  const course = await getCourseById(row.courseId);
  await sendRetakeDiscountCodeEmail({
    to: row.studentEmail,
    cc: row.ccEmail || DEFAULT_DISCOUNT_CC_EMAIL,
    firstName: row.firstName,
    courseName: course?.name ?? row.courseName ?? 'your course',
    coursePageUrl: course?.coursePageUrl,
    code: row.code,
    discountLabel: discountLabel(row.discountType, row.discountValue),
  });
  await markRetakeCodeEmailSent(row.id);
  const fresh = await getRetakeDiscountCodeById(row.id);
  return { ...(fresh ?? row), emailSent: true, emailError: null };
}

export async function listIssuedRetakeCodes(): Promise<RetakeDiscountCode[]> {
  return listRetakeDiscountCodes(100);
}

export type RetakeQuote = {
  codeId: number;
  code: string;
  listAmount: number;
  chargeAmount: number;
  discountType: RetakeDiscountType;
  discountValue: number;
  firstName: string;
  lastName: string;
};

/**
 * Check the code against the student and course it was issued for.
 * Does not mark it used, and does not require a previous enrolment.
 */
export async function previewRetakeDiscount(input: {
  code: string;
  email: string;
  courseId: number;
  listAmount: number;
}): Promise<RetakeQuote> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RetakeCodeError('Enter the email address the code was sent to.');
  }
  const row = await loadUsableCode({ code: input.code, email, courseId: input.courseId });
  const chargeAmount = applyRetakeDiscount(input.listAmount, row.discountType, row.discountValue);
  if (chargeAmount == null) {
    throw new RetakeCodeError('This code reduces the price below the minimum we can charge.');
  }
  return {
    codeId: row.id,
    code: row.code,
    listAmount: input.listAmount,
    chargeAmount,
    discountType: row.discountType,
    discountValue: row.discountValue,
    firstName: row.firstName,
    lastName: row.lastName,
  };
}

const RETAKE_CODE_HELD = 'This discount code is already waiting on another payment.';

/**
 * The first checkout to pay keeps the code. An earlier checkout that never
 * finished can be replaced so the student can complete this one.
 */
export async function holdRetakeCodeForOrder(codeId: number, orderId: number): Promise<void> {
  if (await reserveRetakeCode(codeId, orderId)) return;

  const row = await getRetakeDiscountCodeById(codeId);
  const previousId = row && !row.used ? row.paymentOrderId : null;
  if (!previousId || previousId === orderId) throw new RetakeCodeError(RETAKE_CODE_HELD, 409);

  const previous = await getPaymentOrder(previousId);
  if (!previous || previous.status === 'Paid' || previous.status === 'Refunded') {
    throw new RetakeCodeError('This discount code has already been used.', 409);
  }
  if (previous.status === 'Pending') {
    const sessionId = paymentOrderCheckoutId(previous);
    if (sessionId && previous.provider === 'stripe') {
      let outcome: 'expired' | 'complete';
      try {
        outcome = await expireOpenStripeCheckoutSession(sessionId, previous.checkoutEnvironment);
      } catch (err) {
        console.error('[retake-code] could not expire the earlier checkout', previous.id, err);
        outcome = 'expired';
      }
      if (outcome === 'complete') throw new RetakeCodeError(RETAKE_CODE_HELD, 409);
    }
    await closePendingPaymentOrder({ orderId: previous.id, status: 'Cancelled' });
  }
  if (await reserveRetakeCode(codeId, orderId)) return;
  throw new RetakeCodeError(RETAKE_CODE_HELD, 409);
}

export { consumeRetakeCodeForOrder, releaseRetakeCodeForOrder };
