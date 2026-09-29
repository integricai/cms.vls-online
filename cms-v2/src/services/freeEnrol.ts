import { ensureCustomerCourseStatus } from '../models/customerCourseStatus';
import { getCourseByZenlerCourseId } from '../models/course';
import { splitStudentName, upsertCustomer, updateCustomerZenlerUserId } from '../models/customer';
import { enrollStudentInZenlerCourse } from './zenlerEnrollment';
import { sendFreeEnrolConfirmation } from './paymentEmails';
import { courseAccessUrlForEnrollment } from './schoolAccess';

export const FREE_QUIZ_COURSES: Record<string, { slug: string; name: string }> = {
  '24794': { slug: 'quizzes', name: 'ACCA Free Quizzes' },
  '186586': { slug: 'cimatests', name: 'CIMA Free Quizzes' },
  '191070': { slug: 'cmaquizzes', name: 'CMA Free Quizzes' },
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class FreeEnrolError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FreeEnrolError';
  }
}

export function isFreeQuizCourseId(zenlerCourseId: string): boolean {
  return Object.prototype.hasOwnProperty.call(FREE_QUIZ_COURSES, zenlerCourseId.trim());
}

export function normalizeFreeEnrolEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeFreeEnrolName(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

export type FreeEnrolResult = {
  enrolled: boolean;
  alreadyEnrolled: boolean;
  isNewUser: boolean;
  courseTitle: string;
  zenlerCourseId: string;
  accessUrl: string;
  emailSent: boolean;
};

export async function enrolFreeQuiz(input: {
  zenlerCourseId: string;
  studentEmail: string;
  studentName: string;
}): Promise<FreeEnrolResult> {
  const zenlerCourseId = String(input.zenlerCourseId ?? '').trim();
  const studentEmail = normalizeFreeEnrolEmail(input.studentEmail);
  const studentName = normalizeFreeEnrolName(input.studentName);

  if (!isFreeQuizCourseId(zenlerCourseId)) {
    throw new FreeEnrolError('This product is not available for free enrolment.', 400, 'not_free');
  }
  if (!EMAIL_RE.test(studentEmail)) {
    throw new FreeEnrolError('A valid email address is required.', 400, 'invalid_email');
  }
  if (studentName.length < 2) {
    throw new FreeEnrolError('Please enter your name.', 400, 'invalid_name');
  }

  const catalog = FREE_QUIZ_COURSES[zenlerCourseId];
  const cmsCourse = await getCourseByZenlerCourseId(zenlerCourseId);
  const courseTitle = cmsCourse?.name?.trim() || catalog.name;
  const { firstName, lastName } = splitStudentName(studentName);

  const enrollment = await enrollStudentInZenlerCourse({
    email: studentEmail,
    name: studentName,
    zenlerCourseId,
  });

  if (enrollment.status === 'failed' || enrollment.status === 'skipped') {
    throw new FreeEnrolError(
      enrollment.message || 'Unable to enrol you on this free quiz course.',
      502,
      enrollment.status === 'skipped' ? 'zenler_unconfigured' : 'enrol_failed',
    );
  }

  const customer = await upsertCustomer({
    email: studentEmail,
    firstName,
    lastName,
    zenlerUserId: enrollment.zenlerUserId,
    source: 'zenler_sync',
  });
  if (enrollment.zenlerUserId && customer.zenlerUserId !== enrollment.zenlerUserId) {
    await updateCustomerZenlerUserId(customer.id, enrollment.zenlerUserId);
  }
  if (cmsCourse) {
    await ensureCustomerCourseStatus(customer.id, cmsCourse.id);
  }

  const accessUrl = courseAccessUrlForEnrollment({
    zenlerEnrollmentStatus: enrollment.status,
    isNewZenlerUser: enrollment.isNewZenlerUser,
  });
  const alreadyEnrolled = enrollment.message.toLowerCase().includes('already enrolled');

  let emailSent = false;
  try {
    emailSent = await sendFreeEnrolConfirmation({
      studentEmail,
      studentName,
      courseTitle,
      accessUrl,
      isNewZenlerUser: enrollment.isNewZenlerUser,
      temporaryPassword: enrollment.temporaryPassword,
    });
  } catch (err) {
    console.error('[free-enrol] confirmation email failed', err);
  }

  return {
    enrolled: true,
    alreadyEnrolled,
    isNewUser: enrollment.isNewZenlerUser,
    courseTitle,
    zenlerCourseId,
    accessUrl,
    emailSent,
  };
}
