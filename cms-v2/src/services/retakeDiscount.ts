import { getCourseById } from '../models/course';
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
import { findZenlerUserByEmail, isStudentEnrolledInCourse, zenlerCredentialsConfigured } from './zenlerApi';
import { sendRetakeDiscountCodeEmail } from './retakeDiscountEmail';
import {
  applyRetakeDiscount,
  normalizeRetakeCode,
  parseRetakeDiscount,
  retakeEmailsMatch,
  type RetakeDiscountType,
} from './retakeDiscountMath';

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

async function assertPriorEnrollment(email: string, zenlerCourseId: string, courseName: string): Promise<void> {
  if (!zenlerCredentialsConfigured()) {
    throw new RetakeCodeError('Zenler is not configured, so a past enrolment cannot be checked.');
  }
  const zenlerId = zenlerCourseId.trim();
  if (!/^\d+$/.test(zenlerId)) {
    throw new RetakeCodeError('This course is not linked to Zenler.');
  }
  const user = await findZenlerUserByEmail(email);
  if (!user?.id) {
    throw new RetakeCodeError('This email does not have a Vertex school account.');
  }
  const enrolled = await isStudentEnrolledInCourse({
    zenlerUserId: String(user.id),
    email,
    zenlerCourseId: zenlerId,
  });
  if (!enrolled) {
    throw new RetakeCodeError(`${email} is not enrolled in ${courseName} on Zenler, so a retake code cannot be used.`);
  }
}

async function loadUsableCode(input: {
  code: string;
  email: string;
  courseId: number;
}): Promise<RetakeDiscountCode> {
  const code = normalizeRetakeCode(input.code);
  if (!code) throw new RetakeCodeError('Enter a retake code.');
  const row = await getRetakeDiscountCodeByCode(code);
  if (!row) throw new RetakeCodeError('That retake code was not recognised.');
  if (row.used) throw new RetakeCodeError('This retake code has already been used.');
  if (!retakeEmailsMatch(row.studentEmail, input.email)) {
    throw new RetakeCodeError('This retake code was issued to a different email address.');
  }
  if (row.courseId !== input.courseId) {
    throw new RetakeCodeError('This retake code is for a different course.');
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
  await assertPriorEnrollment(email, course.zenlerCourseId, course.name);

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
        createdBy: input.createdBy,
      });
      break;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate|unique/i.test(message) || attempt === 4) throw err;
    }
  }
  if (!saved) throw new RetakeCodeError('Could not generate a retake code.');

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendRetakeDiscountCodeEmail({
      to: email,
      firstName,
      courseName: course.name,
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
  if (!row) throw new RetakeCodeError('Retake code not found.', 404);
  if (row.used) throw new RetakeCodeError('This retake code has already been used.');
  await sendRetakeDiscountCodeEmail({
    to: row.studentEmail,
    firstName: row.firstName,
    courseName: row.courseName ?? 'your course',
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
};

/**
 * Check the code against the saved student, course, and Zenler enrolment.
 * Does not mark it used.
 */
export async function previewRetakeDiscount(input: {
  code: string;
  email: string;
  courseId: number;
  zenlerCourseId: string;
  courseName: string;
  listAmount: number;
}): Promise<RetakeQuote> {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new RetakeCodeError('Enter the email address the code was sent to.');
  }
  const row = await loadUsableCode({ code: input.code, email, courseId: input.courseId });
  await assertPriorEnrollment(email, input.zenlerCourseId, input.courseName);
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
  };
}

export async function holdRetakeCodeForOrder(codeId: number, orderId: number): Promise<void> {
  const reserved = await reserveRetakeCode(codeId, orderId);
  if (!reserved) {
    throw new RetakeCodeError('This retake code is already waiting on another payment.', 409);
  }
}

export { consumeRetakeCodeForOrder, releaseRetakeCodeForOrder };
