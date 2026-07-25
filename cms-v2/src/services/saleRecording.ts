import type { PaymentOrder } from '../models/paymentOrder';
import {
  attachCustomerToPaymentOrder,
  getPaymentOrder,
} from '../models/paymentOrder';
import { splitStudentName, upsertCustomer } from '../models/customer';
import { createSale, getSaleByPaymentOrderId } from '../models/sale';
import { autoAssignCourseTutorForSale } from './saleAssignment';

async function createSaleForOrder(order: PaymentOrder) {
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

  const sale = await createSale({
    customerId: order.customerId,
    courseId: order.courseId,
    coursePriceId: order.coursePriceId,
    paymentOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    discountPercent: order.discountPercent,
    durationDays: order.durationDays,
    soldAt: order.paidAt,
  });

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
  if (!workingOrder.customerId) {
    const email = (workingOrder.studentEmail ?? workingOrder.stripeCustomerEmail)?.trim().toLowerCase();
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
    });
    workingOrder = await attachCustomerToPaymentOrder(order.id, customer.id, email);
  }

  return createSaleForOrder(workingOrder);
}
