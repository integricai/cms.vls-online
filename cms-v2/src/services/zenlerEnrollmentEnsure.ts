import type { PaymentOrder } from '../models/paymentOrder';
import { getGeoPriceById } from '../models/courseGeoPrice';
import {
  getPaymentOrder,
  updateZenlerEnrollment,
} from '../models/paymentOrder';
import { updateCustomerZenlerUserId } from '../models/customer';
import { parseZenlerPlanId } from './zenlerApi';
import { courseAccessUrlForEnrollment, enrollmentStatusBlocksAccessEmail } from './schoolAccess';
import {
  enrollStudentInZenlerCourse,
  unenrollStudentFromZenlerCourse,
} from './zenlerEnrollment';
import {
  clearStudentPassword,
  didStudentChoosePassword,
  markStudentChosePassword,
  readStudentPassword,
} from './studentPassword';
import { normalizeExamSession, sessionAccessDayCount } from '../../shared/sessionAccess';

const RETRYABLE_STATUSES = new Set<string | null>(['pending', 'failed', 'skipped', null, '']);

function zenlerCourseIdsForAccess(order: PaymentOrder): string[] {
  const access = (order.accessZenlerCourseIds ?? [])
    .map((id) => String(id).trim())
    .filter((id) => /^\d+$/.test(id));
  if (access.length) return access;
  const primary = String(order.zenlerCourseId ?? '').trim();
  return /^\d+$/.test(primary) ? [primary] : [];
}

export function orderUsesZenlerAccess(order: PaymentOrder): boolean {
  return zenlerCourseIdsForAccess(order).length > 0;
}

/** Hold the access email only until the first enrolment attempt finishes. */
export function zenlerAccessStillBlockingStudentEmail(order: PaymentOrder): boolean {
  if (!orderUsesZenlerAccess(order)) return false;
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email) return false;
  return enrollmentStatusBlocksAccessEmail(order.zenlerEnrollmentStatus);
}

async function enrollOrderCourses(order: PaymentOrder) {
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  const courseIds = zenlerCourseIdsForAccess(order);
  if (!email || courseIds.length === 0) {
    return {
      zenlerUserId: null as string | null,
      status: 'failed' as const,
      isNewZenlerUser: false,
      temporaryPassword: null as string | null,
      studentChosePassword: false,
    };
  }

  const planId = await resolvePlanId(order);
  const session = normalizeExamSession(order.sessionMonth, order.sessionYear);
  if (session && order.paidAt && order.durationDays) {
    const days = sessionAccessDayCount(order.paidAt, session.month, session.year);
    if (days > order.durationDays) {
      console.warn('[zenler-enrollment] sitting lasts longer than the Zenler plan', {
        orderId: order.id,
        sessionDays: days,
        planDays: order.durationDays,
      });
    }
  }
  const chosenPassword = await readStudentPassword(order.id).catch((err: unknown) => {
    console.error('[zenler-enrollment] could not read the chosen password', order.id, err);
    return null;
  });
  let zenlerUserId: string | null = order.zenlerUserId;
  let isNewZenlerUser = false;
  let temporaryPassword: string | null = null;
  let studentChosePassword = false;
  let accountReady = false;
  let lastStatus = 'failed';

  for (const zenlerCourseId of courseIds) {
    const enrollment = await enrollStudentInZenlerCourse({
      email,
      name: order.studentName,
      zenlerCourseId,
      zenlerPlanId: planId,
      password: chosenPassword,
    });
    lastStatus = enrollment.status;
    if (enrollment.zenlerUserId) zenlerUserId = enrollment.zenlerUserId;
    if (enrollment.isNewZenlerUser) {
      isNewZenlerUser = true;
      temporaryPassword = enrollment.temporaryPassword;
    }
    if (enrollment.studentChosePassword) studentChosePassword = true;
    if (enrollment.status.startsWith('enrolled') || enrollment.isNewZenlerUser) accountReady = true;
    if (!enrollment.status.startsWith('enrolled')) {
      await settleChosenPassword(order.id, { accountReady, studentChosePassword });
      return {
        zenlerUserId,
        status: enrollment.status,
        isNewZenlerUser,
        temporaryPassword,
        studentChosePassword,
      };
    }
  }

  const result = {
    zenlerUserId,
    status: lastStatus.startsWith('enrolled') ? lastStatus : 'enrolled',
    isNewZenlerUser,
    temporaryPassword,
    studentChosePassword,
  };
  await settleChosenPassword(order.id, { accountReady: true, studentChosePassword });
  return result;
}

async function settleChosenPassword(orderId: number, enrollment: {
  accountReady: boolean;
  studentChosePassword: boolean;
}): Promise<void> {
  try {
    if (enrollment.studentChosePassword) {
      await markStudentChosePassword(orderId);
      return;
    }
    if (enrollment.accountReady) await clearStudentPassword(orderId);
  } catch (err) {
    console.error('[zenler-enrollment] could not clear the stored password', orderId, err);
  }
}

async function resolvePlanId(order: PaymentOrder): Promise<number | undefined> {
  if (!order.coursePriceId) return undefined;
  const price = await getGeoPriceById(order.coursePriceId);
  return parseZenlerPlanId(price?.zenlerPricingCode);
}

export type ZenlerEnrollmentEmailContext = {
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  studentChosePassword?: boolean;
  courseAccessUrl: string;
  zenlerEnrollmentStatus: string;
};

export async function enrollmentEmailContextForOrder(
  order: PaymentOrder,
): Promise<ZenlerEnrollmentEmailContext | null> {
  const status = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (!status.startsWith('enrolled') && !order.zenlerUserCreated) return null;
  return await emailContextFromOrder(order);
}

async function emailContextFromOrder(order: PaymentOrder): Promise<ZenlerEnrollmentEmailContext> {
  const studentChosePassword = order.zenlerUserCreated
    ? await didStudentChoosePassword(order.id).catch(() => false)
    : false;
  return {
    isNewZenlerUser: order.zenlerUserCreated,
    // Retries do not have the original temporary password. A buyer who chose
    // one at checkout is told to sign in with it. Anyone else gets a reset link.
    temporaryPassword: null,
    studentChosePassword,
    courseAccessUrl: courseAccessUrlForEnrollment({
      zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
      isNewZenlerUser: order.zenlerUserCreated,
    }),
    zenlerEnrollmentStatus: order.zenlerEnrollmentStatus ?? 'enrolled',
  };
}

function emailContextFromEnrollment(enrollment: {
  status: string;
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  studentChosePassword?: boolean;
}): ZenlerEnrollmentEmailContext | null {
  const enrolled = String(enrollment.status).startsWith('enrolled');
  if (!enrolled && !enrollment.isNewZenlerUser) return null;
  return {
    isNewZenlerUser: enrollment.isNewZenlerUser,
    temporaryPassword: enrollment.temporaryPassword,
    studentChosePassword: enrollment.studentChosePassword === true,
    courseAccessUrl: courseAccessUrlForEnrollment({
      zenlerEnrollmentStatus: enrollment.status,
      isNewZenlerUser: enrollment.isNewZenlerUser,
    }),
    zenlerEnrollmentStatus: enrollment.status,
  };
}

export type ZenlerEnrollmentEnsureResult = {
  order: PaymentOrder;
  emailContext: ZenlerEnrollmentEmailContext | null;
};

/** Enroll a paid order in Zenler when webhook or status backfill runs. */
export async function ensureZenlerEnrollmentForPaidOrder(
  order: PaymentOrder,
): Promise<ZenlerEnrollmentEnsureResult> {
  if (order.status !== 'Paid') return { order, emailContext: null };

  const currentStatus = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (currentStatus.startsWith('enrolled')) {
    return { order, emailContext: await emailContextFromOrder(order) };
  }
  if (!RETRYABLE_STATUSES.has(order.zenlerEnrollmentStatus)) {
    return { order, emailContext: null };
  }

  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email || zenlerCourseIdsForAccess(order).length === 0) {
    return { order, emailContext: null };
  }

  const enrollment = await enrollOrderCourses(order);

  await updateZenlerEnrollment(order.id, {
    zenlerUserId: enrollment.zenlerUserId,
    zenlerEnrollmentStatus: enrollment.status,
    zenlerUserCreated: enrollment.isNewZenlerUser,
  });

  if (order.customerId && enrollment.zenlerUserId) {
    await updateCustomerZenlerUserId(order.customerId, enrollment.zenlerUserId);
  }

  const refreshed = (await getPaymentOrder(order.id)) ?? order;
  return { order: refreshed, emailContext: emailContextFromEnrollment(enrollment) };
}

/**
 * After a refund, revoke Zenler access for this order's course only.
 * Best-effort: never throws; records unenrolled / unenroll_failed on the order.
 */
export async function revokeZenlerAccessForRefundedOrder(
  order: PaymentOrder,
): Promise<PaymentOrder> {
  const currentStatus = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (currentStatus === 'unenrolled') return order;

  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim() ?? null;
  const courseIds = zenlerCourseIdsForAccess(order);
  if (courseIds.length === 0) {
    await updateZenlerEnrollment(order.id, {
      zenlerUserId: order.zenlerUserId,
      zenlerEnrollmentStatus: 'unenrolled',
    });
    return (await getPaymentOrder(order.id)) ?? order;
  }

  let zenlerUserId = order.zenlerUserId;
  let aggregateStatus = 'unenrolled';
  for (const zenlerCourseId of courseIds) {
    const result = await unenrollStudentFromZenlerCourse({
      email,
      zenlerUserId,
      zenlerCourseId,
    });
    if (result.zenlerUserId) zenlerUserId = result.zenlerUserId;
    if (result.status === 'unenroll_failed' || result.status === 'skipped') {
      aggregateStatus = 'unenroll_failed';
      console.error('[zenler-unenrollment] refund revoke incomplete', {
        orderId: order.id,
        zenlerCourseId,
        status: result.status,
        message: result.message,
      });
    }
  }

  await updateZenlerEnrollment(order.id, {
    zenlerUserId,
    zenlerEnrollmentStatus: aggregateStatus,
  });

  return (await getPaymentOrder(order.id)) ?? order;
}

/**
 * After the 15th of a purchased sitting, remove school access.
 * Best-effort: a missing Zenler account is treated as already closed.
 */
export async function expireZenlerAccessForSessionOrder(order: PaymentOrder): Promise<boolean> {
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim() ?? null;
  const courseIds = zenlerCourseIdsForAccess(order);
  if (courseIds.length === 0) {
    await updateZenlerEnrollment(order.id, {
      zenlerUserId: order.zenlerUserId,
      zenlerEnrollmentStatus: 'expired',
    });
    return true;
  }

  let zenlerUserId = order.zenlerUserId;
  let failed = false;
  for (const zenlerCourseId of courseIds) {
    const result = await unenrollStudentFromZenlerCourse({
      email,
      zenlerUserId,
      zenlerCourseId,
    });
    if (result.zenlerUserId) zenlerUserId = result.zenlerUserId;
    if (result.status === 'skipped') return false;
    if (result.status !== 'unenrolled') failed = true;
  }

  await updateZenlerEnrollment(order.id, {
    zenlerUserId,
    zenlerEnrollmentStatus: failed ? 'unenroll_failed' : 'expired',
  });
  return !failed;
}

/** Run enrollment once and return email context (password only on first successful create). */
export async function runZenlerEnrollmentForPaidOrder(
  order: PaymentOrder,
): Promise<{ order: PaymentOrder; emailContext: ZenlerEnrollmentEmailContext | null }> {
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email || zenlerCourseIdsForAccess(order).length === 0) {
    return { order, emailContext: null };
  }

  const currentStatus = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (currentStatus.startsWith('enrolled')) {
    return { order, emailContext: await emailContextFromOrder(order) };
  }

  const enrollment = await enrollOrderCourses(order);

  await updateZenlerEnrollment(order.id, {
    zenlerUserId: enrollment.zenlerUserId,
    zenlerEnrollmentStatus: enrollment.status,
    zenlerUserCreated: enrollment.isNewZenlerUser,
  });

  if (order.customerId && enrollment.zenlerUserId) {
    await updateCustomerZenlerUserId(order.customerId, enrollment.zenlerUserId);
  }

  const refreshed = (await getPaymentOrder(order.id)) ?? order;
  return { order: refreshed, emailContext: emailContextFromEnrollment(enrollment) };
}
