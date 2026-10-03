import { splitStudentName, upsertCustomer } from '../../models/customer';
import {
  getPaymentOrder,
  getPaymentOrderByCheckoutId,
  getPaymentOrderByPaymentId,
  markOrderEmailsSent,
  markPaymentOrderPaid,
  markPaymentOrderRefunded,
  paymentOrderPayerEmail,
  type PaymentOrder,
} from '../../models/paymentOrder';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
  sendStudentRefundConfirmation,
} from '../paymentEmails';
import { ensureSaleRecordedForPaidOrder } from '../saleRecording';
import {
  ensureZenlerEnrollmentForPaidOrder,
  revokeZenlerAccessForRefundedOrder,
  runZenlerEnrollmentForPaidOrder,
} from '../zenlerEnrollmentEnsure';
import { getPaymentProvider } from './registry';
import { customerSourceForProvider, type CheckoutCompletedEvent, type PaymentProviderId, type RefundCompletedEvent } from './types';

async function resolveOrderForCheckout(event: CheckoutCompletedEvent): Promise<PaymentOrder | null> {
  if (Number.isInteger(event.orderId) && event.orderId! > 0) {
    const byId = await getPaymentOrder(event.orderId!);
    if (byId) return byId;
  }
  if (event.checkoutId) {
    const byCheckout = await getPaymentOrderByCheckoutId(event.checkoutId, event.provider);
    if (byCheckout) return byCheckout;
  }
  if (event.paymentId) {
    return getPaymentOrderByPaymentId(event.paymentId, event.provider);
  }
  return null;
}

export async function fulfillPaidCheckout(event: CheckoutCompletedEvent): Promise<PaymentOrder | null> {
  const existing = await resolveOrderForCheckout(event);
  if (!existing) return null;
  if (existing.status === 'Paid') {
    await ensureSaleRecordedForPaidOrder(existing);
    return existing;
  }
  if (existing.status === 'Cancelled' || existing.status === 'Refunded') return existing;

  let { order, wasAlreadyPaid } = await markPaymentOrderPaid({
    orderId: existing.id,
    provider: event.provider,
    checkoutId: event.checkoutId ?? existing.providerCheckoutId,
    paymentId: event.paymentId ?? existing.providerPaymentId,
    customerEmail: event.customerEmail,
    amountMinor: event.amountMinor,
    currency: event.currency,
  });

  const payerEmail = paymentOrderPayerEmail(order) ?? event.customerEmail;
  if (payerEmail) {
    const payerName = event.customerName ?? order.studentName;
    const { firstName, lastName } = splitStudentName(payerName);
    await upsertCustomer({
      email: String(payerEmail).trim().toLowerCase(),
      firstName,
      lastName,
      countryCode: order.countryCode,
      source: customerSourceForProvider(event.provider),
    });
  }

  if (!wasAlreadyPaid) {
    const email = paymentOrderPayerEmail(order);
    let enrollmentEmailContext = null;
    if (email && (order.zenlerCourseId || (order.accessZenlerCourseIds?.length ?? 0) > 0)) {
      const enrollmentResult = await runZenlerEnrollmentForPaidOrder(order);
      order = enrollmentResult.order;
      enrollmentEmailContext = enrollmentResult.emailContext;
    }

    const studentSent = await sendStudentPaymentConfirmation(order, enrollmentEmailContext);
    const adminSent = await sendAdminPaymentNotification(order);
    await markOrderEmailsSent(order.id, { student: studentSent, admin: adminSent });
  }

  await ensureSaleRecordedForPaidOrder(order);
  return order;
}

export async function fulfillRefund(event: RefundCompletedEvent): Promise<PaymentOrder | null> {
  const order = event.paymentId
    ? await getPaymentOrderByPaymentId(event.paymentId, event.provider)
    : event.checkoutId
      ? await getPaymentOrderByCheckoutId(event.checkoutId, event.provider)
      : null;
  if (!order) return null;

  if (order.status === 'Refunded') {
    await revokeZenlerAccessForRefundedOrder(order);
    return order;
  }
  if (order.status !== 'Paid') return order;

  const { order: refunded, wasAlreadyRefunded } = await markPaymentOrderRefunded({
    orderId: order.id,
    provider: event.provider,
    refundId: event.refundId,
    paymentId: event.paymentId,
  });

  await revokeZenlerAccessForRefundedOrder(refunded);

  if (!wasAlreadyRefunded) {
    try {
      await sendStudentRefundConfirmation(refunded);
    } catch (emailErr) {
      console.error('[payments] refund confirmation email failed', emailErr);
    }
  }

  return refunded;
}

export async function capturePendingProviderCheckout(order: PaymentOrder): Promise<PaymentOrder> {
  if (order.status !== 'Pending') return order;
  const checkoutId = order.providerCheckoutId ?? order.stripeCheckoutSessionId;
  if (!checkoutId) return order;

  const provider = getPaymentProvider(order.provider);
  if (!provider.captureCheckout) return order;

  const captured = await provider.captureCheckout(checkoutId);
  if (!captured.completed) return order;

  const fulfilled = await fulfillPaidCheckout({
    type: 'checkout.completed',
    provider: order.provider as PaymentProviderId,
    orderId: order.id,
    checkoutId: captured.checkoutId,
    paymentId: captured.paymentId,
    customerEmail: captured.customerEmail,
    customerName: captured.customerName,
    amountMinor: captured.amountMinor,
    currency: captured.currency,
  });
  return fulfilled ?? (await getPaymentOrder(order.id)) ?? order;
}
