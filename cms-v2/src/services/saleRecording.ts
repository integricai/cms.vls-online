import type { PaymentOrder } from '../models/paymentOrder';
import {
  attachCustomerToPaymentOrder,
  getPaymentOrder,
} from '../models/paymentOrder';
import { splitStudentName, upsertCustomer } from '../models/customer';
import { ensureCustomerCourseStatus } from '../models/customerCourseStatus';
import { createSale, getSaleByPaymentOrderId } from '../models/sale';
import { autoAssignCourseTutorForSale } from './saleAssignment';

async function createSaleForOrder(order: PaymentOrder, customerCountryCode: string | null) {
  const existing = await getSaleByPaymentOrderId(order.id);
  if (existing) return existing;

  if (!order.customerId || !order.paidAt) {
    console.warn('[sales] Cannot create sale for paid order', order.id, {
      customerId: order.customerId,
      paidAt: order.paidAt,
    });
    return null;
  }

  const paymentOrderOnly = order.courseId == null;
  if (paymentOrderOnly && order.optionType !== 'Custom payment') {
    console.warn('[sales] Cannot create sale for paid order', order.id, {
      courseId: order.courseId,
      optionType: order.optionType,
    });
    return null;
  }
  if (!paymentOrderOnly && !order.durationDays) {
    console.warn('[sales] Cannot create sale for paid order', order.id, {
      courseId: order.courseId,
      durationDays: order.durationDays,
    });
    return null;
  }

  const sale = await createSale({
    customerId: order.customerId,
    courseId: order.courseId,
    coursePriceId: order.coursePriceId,
    paymentOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    discountPercent: order.discountPercent,
    durationDays: paymentOrderOnly ? null : order.durationDays,
    soldAt: order.paidAt,
    countryCode: order.countryCode ?? customerCountryCode,
  });

  if (order.courseId != null) {
    try {
      await ensureCustomerCourseStatus(order.customerId, order.courseId);
    } catch (err) {
      console.error(`[sales] Failed to ensure course status for sale ${sale.id}`, err);
    }
  }

  if (sale.courseId == null) return sale;

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
