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

function emailContextFromOrder(order: PaymentOrder): ZenlerEnrollmentEmailContext {
  return {
    isNewZenlerUser: order.zenlerUserCreated,
    temporaryPassword: null,
    courseAccessUrl: courseAccessUrlForEnrollment({
      zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
      isNewZenlerUser: order.zenlerUserCreated,
    }),
    zenlerEnrollmentStatus: order.zenlerEnrollmentStatus ?? 'enrolled',
  };
}

/** Enroll a paid order in Zenler when webhook or status backfill runs. */
export async function ensureZenlerEnrollmentForPaidOrder(order: PaymentOrder) {
  if (order.status !== 'Paid') return order;

  const currentStatus = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (currentStatus.startsWith('enrolled')) return order;
  if (!RETRYABLE_STATUSES.has(order.zenlerEnrollmentStatus)) return order;

  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email || !order.zenlerCourseId) return order;

  const enrollment = await enrollStudentInZenlerCourse({
    email,
    name: order.studentName,
    zenlerCourseId: order.zenlerCourseId,
    zenlerPlanId: await resolvePlanId(order),
  });

  await updateZenlerEnrollment(order.id, {
    zenlerUserId: enrollment.zenlerUserId,
    zenlerEnrollmentStatus: enrollment.status,
    zenlerUserCreated: enrollment.isNewZenlerUser,
  });

  if (order.customerId && enrollment.zenlerUserId) {
    await updateCustomerZenlerUserId(order.customerId, enrollment.zenlerUserId);
  }

  const refreshed = await getPaymentOrder(order.id);
  return refreshed ?? order;
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
  if (!order.zenlerCourseId?.trim()) {
    await updateZenlerEnrollment(order.id, {
      zenlerUserId: order.zenlerUserId,
      zenlerEnrollmentStatus: 'unenrolled',
    });
    return (await getPaymentOrder(order.id)) ?? order;
  }

  const result = await unenrollStudentFromZenlerCourse({
    email,
    zenlerUserId: order.zenlerUserId,
    zenlerCourseId: order.zenlerCourseId,
  });

  await updateZenlerEnrollment(order.id, {
    zenlerUserId: result.zenlerUserId ?? order.zenlerUserId,
    zenlerEnrollmentStatus: result.status === 'skipped' ? 'unenroll_failed' : result.status,
  });

  if (result.status === 'unenroll_failed' || result.status === 'skipped') {
    console.error('[zenler-unenrollment] refund revoke incomplete', {
      orderId: order.id,
      status: result.status,
      message: result.message,
    });
  }

  return (await getPaymentOrder(order.id)) ?? order;
}

/** Run enrollment once and return email context (password only on first successful create). */
export async function runZenlerEnrollmentForPaidOrder(
  order: PaymentOrder,
): Promise<{ order: PaymentOrder; emailContext: ZenlerEnrollmentEmailContext | null }> {
  const email = (order.studentEmail ?? order.stripeCustomerEmail)?.trim();
  if (!email || !order.zenlerCourseId) {
    return { order, emailContext: null };
  }

  const currentStatus = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (currentStatus.startsWith('enrolled')) {
    return { order, emailContext: emailContextFromOrder(order) };
  }

  const enrollment = await enrollStudentInZenlerCourse({
    email,
    name: order.studentName,
    zenlerCourseId: order.zenlerCourseId,
    zenlerPlanId: await resolvePlanId(order),
  });

  await updateZenlerEnrollment(order.id, {
    zenlerUserId: enrollment.zenlerUserId,
    zenlerEnrollmentStatus: enrollment.status,
    zenlerUserCreated: enrollment.isNewZenlerUser,
  });

  if (order.customerId && enrollment.zenlerUserId) {
    await updateCustomerZenlerUserId(order.customerId, enrollment.zenlerUserId);
  }

  const refreshed = (await getPaymentOrder(order.id)) ?? order;

  if (!enrollment.status.startsWith('enrolled')) {
    return { order: refreshed, emailContext: null };
  }

  return {
    order: refreshed,
    emailContext: {
      isNewZenlerUser: enrollment.isNewZenlerUser,
      temporaryPassword: enrollment.temporaryPassword,
      courseAccessUrl: courseAccessUrlForEnrollment({
        zenlerEnrollmentStatus: enrollment.status,
        isNewZenlerUser: enrollment.isNewZenlerUser,
      }),
      zenlerEnrollmentStatus: enrollment.status,
    },
  };
}
