import { getCourseById } from '../models/course';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import {
  attachCheckoutSession,
  closePendingPaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  paymentOrderCheckoutId,
  saveOfferedPresentment,
} from '../models/paymentOrder';
import {
  consumeRetakeCodeForOrder,
  generateRetakeCodeValue,
  getRetakeDiscountCodeByCode,
  getRetakeDiscountCodeById,
  getRetakeDiscountCodeByTokenHash,
  insertRetakeDiscountCode,
  listRetakeDiscountCodes,
  markRetakeCodeEmailSent,
  releaseRetakeCodeForOrder,
  replaceDiscountPaymentLink,
  reserveRetakeCode,
  type RetakeDiscountCode,
} from '../models/retakeDiscountCode';
import type { CheckoutEnvironment } from '../../shared/types';
import {
  DISCOUNT_LINK_MESSAGES,
  discountLinkExpiresAt,
  discountLinkStatus,
  discountOfferLabel,
  discountPayUrl,
  generateDiscountToken,
  hashDiscountToken,
  presentDiscountPrices,
  quoteDiscountedPrice,
  type DiscountLinkStatus,
} from './discountPayLink';
import { formatDisplayMoney, normalizeCountryCode } from './displayCurrency';
import { getUsdRates } from './fxRates';
import { sendRetakeDiscountCodeEmail } from './retakeDiscountEmail';
import {
  createStripeCheckoutSession,
  expireOpenStripeCheckoutSession,
  readStripeCheckoutSession,
  stripePaymentMethodTypes,
} from './stripeCheckout';
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

async function catalogueDiscountPrice(
  courseId: number,
  discountType: RetakeDiscountType,
  discountValue: number,
): Promise<{ fullAmount: number; finalAmount: number; currency: string }> {
  const prices = await listActiveGeoPricesForCourse(courseId);
  const price = prices.find(row => row.isDefault) ?? prices[0];
  if (!price) throw new RetakeCodeError('This course has no active price.');
  const finalAmount = quoteDiscountedPrice(price.effectiveAmount, discountType, discountValue);
  if (finalAmount == null) {
    throw new RetakeCodeError('This discount reduces the price below the minimum we can charge.');
  }
  return {
    fullAmount: price.effectiveAmount,
    finalAmount,
    currency: (price.currency || 'USD').toUpperCase(),
  };
}

async function retireOpenDiscountCheckout(row: RetakeDiscountCode): Promise<void> {
  if (!row.paymentOrderId || row.used) return;
  const previous = await getPaymentOrder(row.paymentOrderId);
  if (!previous || previous.status !== 'Pending') return;
  const sessionId = paymentOrderCheckoutId(previous);
  if (sessionId && previous.provider === 'stripe') {
    const outcome = await expireOpenStripeCheckoutSession(sessionId, previous.checkoutEnvironment);
    if (outcome === 'complete') throw new RetakeCodeError('This offer has already been paid.', 409);
  }
  await closePendingPaymentOrder({ orderId: previous.id, status: 'Cancelled' });
  await releaseRetakeCodeForOrder(previous.id);
}

function offerEmailPrices(input: {
  fullAmount: number;
  finalAmount: number;
  currency: string;
  discountType: RetakeDiscountType;
  discountValue: number;
}): { fullPriceLabel: string; discountLabel: string; payableLabel: string } {
  return {
    fullPriceLabel: formatDisplayMoney(input.fullAmount, input.currency),
    payableLabel: formatDisplayMoney(input.finalAmount, input.currency),
    discountLabel: discountOfferLabel({
      discountType: input.discountType,
      discountValue: input.discountValue,
      fullAmount: input.fullAmount,
      payableAmount: input.finalAmount,
    }),
  };
}

function savedPrice(row: RetakeDiscountCode): { fullAmount: number; finalAmount: number; currency: string } | null {
  if (row.finalAmount == null || row.fullAmount == null) return null;
  return {
    fullAmount: row.fullAmount,
    finalAmount: row.finalAmount,
    currency: (row.currency || 'USD').toUpperCase(),
  };
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
  countryCode?: unknown;
  createdBy: number | null;
}): Promise<IssuedRetakeCode> {
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const email = input.email.trim().toLowerCase();
  const countryCode = normalizeCountryCode(String(input.countryCode ?? ''));
  if (!firstName || !lastName) throw new RetakeCodeError('Enter the student first and last name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new RetakeCodeError('Enter a valid student email.');
  if (!countryCode) throw new RetakeCodeError('Choose the student\'s country.');
  if (!Number.isInteger(input.courseId) || input.courseId <= 0) throw new RetakeCodeError('Choose a course.');

  const discount = parseRetakeDiscount(input);
  if ('error' in discount) throw new RetakeCodeError(discount.error);

  const course = await getCourseById(input.courseId);
  if (!course || !course.isActive) throw new RetakeCodeError('Course not found or inactive.', 404);
  if (!course.zenlerCourseId?.trim()) {
    throw new RetakeCodeError('This course is not connected to the school yet.');
  }
  const ccEmail = parseCcEmail(input.ccEmail);
  const catalogue = await catalogueDiscountPrice(course.id, discount.type, discount.value);
  const price = presentDiscountPrices({
    ...catalogue,
    countryCode,
    rates: await getUsdRates(),
  });
  const expiresAt = discountLinkExpiresAt();

  let saved: RetakeDiscountCode | null = null;
  let payToken = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    payToken = generateDiscountToken();
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
        tokenHash: hashDiscountToken(payToken),
        expiresAt,
        fullAmount: price.fullAmount,
        finalAmount: price.finalAmount,
        currency: price.currency,
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
      ...offerEmailPrices({ ...price, discountType: discount.type, discountValue: discount.value }),
      payUrl: discountPayUrl(payToken),
      expiresAt,
    });
    await markRetakeCodeEmailSent(saved.id);
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'The offer was saved, but the email could not be sent.';
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
  const courseName = course?.name ?? row.courseName ?? 'your course';
  const price = savedPrice(row) ?? await catalogueDiscountPrice(row.courseId, row.discountType, row.discountValue);
  await retireOpenDiscountCheckout(row);

  const expiresAt = discountLinkExpiresAt();
  let payToken = '';
  let replaced = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    payToken = generateDiscountToken();
    try {
      replaced = await replaceDiscountPaymentLink(row.id, {
        tokenHash: hashDiscountToken(payToken),
        expiresAt,
        fullAmount: price.fullAmount,
        finalAmount: price.finalAmount,
        currency: price.currency,
      });
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate|unique/i.test(message) || attempt === 4) throw err;
    }
  }
  if (!replaced) throw new RetakeCodeError('This discount code has already been used.');

  await sendRetakeDiscountCodeEmail({
    to: row.studentEmail,
    cc: row.ccEmail || DEFAULT_DISCOUNT_CC_EMAIL,
    firstName: row.firstName,
    courseName,
    ...offerEmailPrices({ ...price, discountType: row.discountType, discountValue: row.discountValue }),
    payUrl: discountPayUrl(payToken),
    expiresAt,
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

export type OpenDiscountLinkResult = {
  status: DiscountLinkStatus | 'error';
  message: string;
  checkoutUrl: string | null;
};

function closedLink(status: Exclude<DiscountLinkStatus, 'valid'>): OpenDiscountLinkResult {
  return { status, message: DISCOUNT_LINK_MESSAGES[status], checkoutUrl: null };
}

/**
 * Open a discount payment link. A valid link returns the Stripe page.
 * Opening the link does not mark the offer used.
 */
export async function openDiscountPaymentLink(input: {
  token: string;
  returnOrigin?: string | null;
  environment: CheckoutEnvironment;
}): Promise<OpenDiscountLinkResult> {
  const token = input.token.trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) return closedLink('invalid');

  const row = await getRetakeDiscountCodeByTokenHash(hashDiscountToken(token));
  const status = discountLinkStatus(row);
  if (status !== 'valid' || !row) return closedLink(status === 'valid' ? 'invalid' : status);

  const shown = savedPrice(row);
  if (!shown) return closedLink('invalid');
  const catalogue = await catalogueDiscountPrice(row.courseId, row.discountType, row.discountValue);
  const presentment = shown.currency !== 'USD' && shown.finalAmount > 0
    ? { amount: shown.finalAmount, currency: shown.currency }
    : null;

  const course = await getCourseById(row.courseId);
  if (!course?.isActive || !course.zenlerCourseId?.trim()) {
    throw new RetakeCodeError('This course cannot be paid for from this link.');
  }

  if (row.paymentOrderId) {
    const existing = await getPaymentOrder(row.paymentOrderId);
    if (existing?.status === 'Paid' || existing?.status === 'Refunded') return closedLink('used');
    if (existing?.status === 'Pending') {
      const sessionId = paymentOrderCheckoutId(existing);
      if (sessionId && existing.provider === 'stripe') {
        const session = await readStripeCheckoutSession(sessionId, existing.checkoutEnvironment);
        if (session.status === 'complete') return closedLink('used');
        if (session.status === 'open' && session.url) {
          return { status: 'valid', message: '', checkoutUrl: session.url };
        }
      }
      await retireOpenDiscountCheckout(row);
    }
  }

  const order = await createPaymentOrder({
    courseId: course.id,
    zenlerCourseId: course.zenlerCourseId,
    courseTitle: course.name,
    optionType: 'discount-link',
    studentName: `${row.firstName} ${row.lastName}`.trim() || null,
    studentEmail: null,
    amount: catalogue.finalAmount,
    currency: 'USD',
    environment: input.environment,
    provider: 'stripe',
  });
  if (presentment) {
    await saveOfferedPresentment(order.id, presentment.amount, presentment.currency);
  }

  await holdRetakeCodeForOrder(row.id, order.id);

  const session = await createStripeCheckoutSession({
    orderId: order.id,
    courseId: course.id,
    zenlerCourseId: course.zenlerCourseId,
    courseTitle: course.name,
    paymentCardTitle: course.name,
    amount: catalogue.finalAmount,
    currency: 'USD',
    studentEmail: null,
    studentFirstName: row.firstName,
    studentLastName: row.lastName,
    paymentMethodTypes: stripePaymentMethodTypes(true, 'USD'),
    returnOrigin: input.returnOrigin,
    cancelPath: '/',
    environment: input.environment,
  });
  if (!session.url) throw new RetakeCodeError('Stripe did not return a checkout page.', 502);
  await attachCheckoutSession(order.id, { provider: 'stripe', checkoutId: session.id });
  return { status: 'valid', message: '', checkoutUrl: session.url };
}

export { consumeRetakeCodeForOrder, releaseRetakeCodeForOrder };
