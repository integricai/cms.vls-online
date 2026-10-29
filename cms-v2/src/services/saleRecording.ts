import type { PaymentOrder } from '../models/paymentOrder';
import {
  attachCustomerToPaymentOrder,
  getPaymentOrder,
  saveSessionAccessDays,
} from '../models/paymentOrder';
import { splitStudentName, upsertCustomer } from '../models/customer';
import { ensureCustomerCourseStatus } from '../models/customerCourseStatus';
import { createSale, getSaleByPaymentOrderId } from '../models/sale';
import { autoAssignCourseTutorForSale } from './saleAssignment';
import {
  normalizeExamSession,
  sessionAccessDayCount,
  sessionAccessEndsAt,
} from '../../shared/sessionAccess';

async function createSaleForOrder(order: PaymentOrder, customerCountryCode: string | null) {
  const existing = await getSaleByPaymentOrderId(order.id);
  if (existing) return existing;

  if (!order.customerId || !order.courseId || !order.durationDays || !order.paidAt) {
    console.warn('[sales] Cannot create sale for paid order', order.id, {
      customerId: order.customerId,
      courseId: order.courseId,
      durationDays: order.durationDays,
      paidAt: order.paidAt,
    });
    return null;
  }

  const session = normalizeExamSession(order.sessionMonth, order.sessionYear);
  let durationDays = order.durationDays;
  let expiryDate: Date | null = null;
  let sessionMonth: number | null = null;
  let sessionYear: number | null = null;
  if (session) {
    const days = sessionAccessDayCount(order.paidAt, session.month, session.year);
    const endsAt = sessionAccessEndsAt(session.month, session.year);
    if (days >= 1 && endsAt.getTime() > order.paidAt.getTime()) {
      durationDays = days;
      expiryDate = endsAt;
      sessionMonth = session.month;
      sessionYear = session.year;
      await saveSessionAccessDays(order.id, days);
    } else {
      console.warn('[sales] session access already ended; keeping the catalogue length', order.id);
    }
  }

  const sale = await createSale({
    customerId: order.customerId,
    courseId: order.courseId,
    coursePriceId: order.coursePriceId,
    paymentOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    discountPercent: order.discountPercent,
    durationDays,
    soldAt: order.paidAt,
    expiryDate,
    sessionMonth,
    sessionYear,
    countryCode: order.countryCode ?? customerCountryCode,
  });

  try {
    await ensureCustomerCourseStatus(order.customerId, order.courseId);
  } catch (err) {
    console.error(`[sales] Failed to ensure course status for sale ${sale.id}`, err);
  }

  try {
    const assigned = await autoAssignCourseTutorForSale(sale);
    return assigned ?? sale;
  } catch (err) {
    console.error(`[sales] Failed to auto-assign tutor for sale ${sale.id}`, err);
    return sale;
  }
}

/** Ensure a paid order has a linked customer and sales row (creates either if missing). */
export async function ensureSaleRecordedForPaidOrder(order: PaymentOrder) {
  if (order.status !== 'Paid') return null;

  const existing = await getSaleByPaymentOrderId(order.id);
  if (existing) return existing;

  let workingOrder = order;
  const email = (workingOrder.studentEmail ?? workingOrder.providerCustomerEmail ?? workingOrder.stripeCustomerEmail)?.trim().toLowerCase();
  if (!email) {
    console.warn('[sales] Paid order has no payer email', order.id);
    return null;
  }

  const { firstName, lastName } = splitStudentName(workingOrder.studentName);
  const customer = await upsertCustomer({
    email,
    firstName,
    lastName,
    countryCode: workingOrder.countryCode,
    source: workingOrder.provider === 'paypal' ? 'paypal' : 'stripe',
  });

  if (!workingOrder.customerId || workingOrder.customerId !== customer.id) {
    workingOrder = await attachCustomerToPaymentOrder(order.id, customer.id, email);
  }

  return createSaleForOrder(workingOrder, customer.countryCode);
}
