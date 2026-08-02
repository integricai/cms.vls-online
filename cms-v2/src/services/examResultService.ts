import type {
  ExamEmailBulkSendResult,
  ExamEmailSendResult,
  ExamResultPreview,
  ExamResultSubmitResult,
  ExamStatus,
} from '../../shared/types';
import { getCustomerById, listStudents } from '../models/customer';
import {
  ensureCustomerCourseStatus,
  parseExamStatus,
  setCustomerExamStatus,
} from '../models/customerCourseStatus';
import { getCourseById } from '../models/courseGeoPrice';
import {
  createExamResultToken,
  getExamResultTokenByValue,
  markExamResultTokenEmailed,
  markExamResultTokenUsed,
} from '../models/examResultToken';
import { sendExamResultRequestEmail } from './examResultEmails';

const STUDENT_LINK_STATUSES: ExamStatus[] = ['passed', 'awaiting_result'];

function studentDisplayName(firstName: string | null, lastName: string | null, email: string): string {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim();
  return name || email;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export async function previewExamResultToken(tokenValue: string): Promise<ExamResultPreview> {
  const token = await getExamResultTokenByValue(tokenValue);
  if (!token) throw new Error('This exam result link is invalid.');

  const expiresAt = asDate(token.expiresAt);
  const expired = expiresAt.getTime() < Date.now();
  return {
    customerId: token.customerId,
    courseId: token.courseId,
    courseName: token.courseName,
    studentName: studentDisplayName(token.customerFirstName, token.customerLastName, token.customerEmail),
    expiresAt,
    used: Boolean(token.usedAt),
    expired,
  };
}

export async function submitExamResultFromToken(input: {
  token: string;
  status: unknown;
}): Promise<ExamResultSubmitResult> {
  const examStatus = parseExamStatus(input.status);
  if (!examStatus || !STUDENT_LINK_STATUSES.includes(examStatus)) {
    throw new Error('Choose either passed or awaiting_result.');
  }

  const token = await getExamResultTokenByValue(input.token);
  if (!token) throw new Error('This exam result link is invalid.');
  if (asDate(token.expiresAt).getTime() < Date.now()) {
    throw new Error('This exam result link has expired. Please ask VLS for a new email.');
  }
  if (token.usedAt) {
    throw new Error('This exam result link has already been used.');
  }

  await setCustomerExamStatus({
    customerId: token.customerId,
    courseId: token.courseId,
    examStatus,
    examStatusSource: 'student_link',
  });
  await markExamResultTokenUsed(token.id);

  return {
    examStatus,
    courseName: token.courseName,
    studentName: studentDisplayName(token.customerFirstName, token.customerLastName, token.customerEmail),
  };
}

export async function updateExamStatusManual(input: {
  customerId: number;
  courseId: number;
  examStatus: unknown;
}): Promise<{ examStatus: ExamStatus }> {
  const examStatus = parseExamStatus(input.examStatus);
  if (!examStatus) throw new Error('Invalid exam status');

  const customer = await getCustomerById(input.customerId);
  if (!customer) throw new Error('Student not found');
  const course = await getCourseById(input.courseId);
  if (!course) throw new Error('Course not found');

  await setCustomerExamStatus({
    customerId: input.customerId,
    courseId: input.courseId,
    examStatus,
    examStatusSource: 'manual',
  });

  return { examStatus };
}

export async function sendExamResultEmailForStudent(input: {
  customerId: number;
  courseId: number;
}): Promise<ExamEmailSendResult> {
  const customer = await getCustomerById(input.customerId);
  if (!customer) {
    return {
      customerId: input.customerId,
      courseId: input.courseId,
      email: '',
      sent: false,
      error: 'Student not found',
    };
  }

  const course = await getCourseById(input.courseId);
  if (!course) {
    return {
      customerId: input.customerId,
      courseId: input.courseId,
      email: customer.email,
      sent: false,
      error: 'Course not found',
    };
  }

  try {
    await ensureCustomerCourseStatus(input.customerId, input.courseId);
    const token = await createExamResultToken({
      customerId: input.customerId,
      courseId: input.courseId,
    });

    await sendExamResultRequestEmail({
      to: customer.email,
      studentName: studentDisplayName(customer.firstName, customer.lastName, customer.email),
      courseName: course.name,
      token: token.token,
    });
    await markExamResultTokenEmailed(token.id);

    return {
      customerId: input.customerId,
      courseId: input.courseId,
      email: customer.email,
      sent: true,
    };
  } catch (err) {
    return {
      customerId: input.customerId,
      courseId: input.courseId,
      email: customer.email,
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function sendExamResultEmailsForCourse(courseId: number): Promise<ExamEmailBulkSendResult> {
  const course = await getCourseById(courseId);
  if (!course) throw new Error('Course not found');

  const students = await listStudents({ courseId });
  const results: ExamEmailSendResult[] = [];

  for (const student of students) {
    results.push(await sendExamResultEmailForStudent({
      customerId: student.id,
      courseId,
    }));
  }

  return {
    courseId,
    attempted: results.length,
    sent: results.filter((r) => r.sent).length,
    failed: results.filter((r) => !r.sent).length,
    results,
  };
}
