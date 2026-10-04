import type { PaymentOrder } from '../models/paymentOrder';
import { getGeoPriceById } from '../models/courseGeoPrice';
import {
  getPaymentOrder,
  updateZenlerEnrollment,
} from '../models/paymentOrder';
import { updateCustomerZenlerUserId } from '../models/customer';
import { parseZenlerPlanId } from './zenlerApi';
import { courseAccessUrlForEnrollment } from './schoolAccess';
import {
  enrollStudentInZenlerCourse,
  unenrollStudentFromZenlerCourse,
} from './zenlerEnrollment';

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

/** Paid Zenler order whose student access email must wait for a successful enrolment. */
export function zenlerAccessStillBlockingStudentEmail(order: PaymentOrder): boolean {
  if (!orderUsesZenlerAccess(order)) return false;
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email) return false;
  const status = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (status.startsWith('enrolled')) return false;
  return RETRYABLE_STATUSES.has(order.zenlerEnrollmentStatus);
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
    };
  }

  const planId = await resolvePlanId(order);
  let zenlerUserId: string | null = order.zenlerUserId;
  let isNewZenlerUser = false;
  let temporaryPassword: string | null = null;
  let lastStatus = 'failed';

  for (const zenlerCourseId of courseIds) {
    const enrollment = await enrollStudentInZenlerCourse({
      email,
      name: order.studentName,
      zenlerCourseId,
      zenlerPlanId: planId,
    });
    lastStatus = enrollment.status;
    if (enrollment.zenlerUserId) zenlerUserId = enrollment.zenlerUserId;
    if (enrollment.isNewZenlerUser) {
      isNewZenlerUser = true;
      temporaryPassword = enrollment.temporaryPassword;
    }
    if (!enrollment.status.startsWith('enrolled')) {
      return {
        zenlerUserId,
        status: enrollment.status,
        isNewZenlerUser,
        temporaryPassword,
      };
    }
  }

  return {
    zenlerUserId,
    status: lastStatus.startsWith('enrolled') ? lastStatus : 'enrolled',
    isNewZenlerUser,
    temporaryPassword,
  };
}

async function resolvePlanId(order: PaymentOrder): Promise<number | undefined> {
  if (!order.coursePriceId) return undefined;
  const price = await getGeoPriceById(order.coursePriceId);
  return parseZenlerPlanId(price?.zenlerPricingCode);
}

export type ZenlerEnrollmentEmailContext = {
  isNewZenlerUser: boolean;
  temporaryPassword: string | null;
  courseAccessUrl: string;
  zenlerEnrollmentStatus: string;
};

export function enrollmentEmailContextForOrder(order: PaymentOrder): ZenlerEnrollmentEmailContext | null {
  if (!String(order.zenlerEnrollmentStatus ?? '').toLowerCase().startsWith('enrolled')) return null;
  return emailContextFromOrder(order);
}

function emailContextFromOrder(order: PaymentOrder): ZenlerEnrollmentEmailContext {
  return {
    isNewZenlerUser: order.zenlerUserCreated,
    // Retries do not have the original temporary password. The confirmation
    // email sends password-reset instructions instead of an existing-account login.
    temporaryPassword: null,
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
}): ZenlerEnrollmentEmailContext | null {
  if (!String(enrollment.status).startsWith('enrolled')) return null;
  return {
    isNewZenlerUser: enrollment.isNewZenlerUser,
    temporaryPassword: enrollment.temporaryPassword,
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
    return { order, emailContext: emailContextFromOrder(order) };
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
    return { order, emailContext: emailContextFromOrder(order) };
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
