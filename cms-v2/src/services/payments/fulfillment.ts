import { splitStudentName, upsertCustomer } from '../../models/customer';
import {
  claimOrderEmailSend,
  closePendingPaymentOrder,
  getPaymentOrder,
  getPaymentOrderByCheckoutId,
  getPaymentOrderByPaymentId,
  listPaidOrdersNeedingReconciliation,
  markFulfillmentAttempted,
  markOrderEmailSent,
  markPaymentOrderPaid,
  markPaymentOrderRefunded,
  paymentOrderPayerEmail,
  releaseOrderEmailSend,
  type PaymentOrder,
} from '../../models/paymentOrder';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
  sendStudentRefundConfirmation,
} from '../paymentEmails';
import { ensureSaleRecordedForPaidOrder } from '../saleRecording';
import {
  enrollmentEmailContextForOrder,
  ensureZenlerEnrollmentForPaidOrder,
  revokeZenlerAccessForRefundedOrder,
  runZenlerEnrollmentForPaidOrder,
  zenlerAccessStillBlockingStudentEmail,
  type ZenlerEnrollmentEmailContext,
} from '../zenlerEnrollmentEnsure';
import { getPaymentProvider } from './registry';
import {
  customerSourceForProvider,
  type CheckoutClosedEvent,
  type CheckoutCompletedEvent,
  type PaymentProviderId,
  type RefundCompletedEvent,
} from './types';

async function resolveOrderForCheckout(
  event: Pick<CheckoutCompletedEvent, 'orderId' | 'checkoutId' | 'paymentId' | 'provider'>,
): Promise<PaymentOrder | null> {
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

const RECONCILIATION_BATCH_SIZE = 10;
const RECONCILIATION_MIN_AGE_MINUTES = 2;
const RECONCILIATION_LOOKBACK_DAYS = 14;
const NEW_USER_PASSWORD_EMAIL_GRACE_MS = 3 * 60 * 1000;

/**
 * Paid is stored before Zenler enrolment and confirmation emails. A webhook
 * retry, or the reconciliation cron, has to finish whichever of those did not.
 */
export async function reconcilePaidOrder(order: PaymentOrder): Promise<PaymentOrder> {
  if (order.status !== 'Paid') return order;

  let current = order;
  let emailContext: ZenlerEnrollmentEmailContext | null = null;
  let failure: unknown = null;

  try {
    const ensured = await ensureZenlerEnrollmentForPaidOrder(current);
    current = ensured.order;
    emailContext = ensured.emailContext;
  } catch (err) {
    console.error('[payments] zenler enrolment retry failed', order.id, err);
    failure = err;
  }

  try {
    current = await sendUnsentPaymentEmails(current, emailContext);
  } catch (err) {
    console.error('[payments] payment email retry failed', order.id, err);
    if (!failure) failure = err;
  }

  try {
    await ensureSaleRecordedForPaidOrder(current);
  } catch (err) {
    console.error('[payments] sale reconcile failed', order.id, err);
    if (!failure) failure = err;
  }

  if (!failure && zenlerAccessStillBlockingStudentEmail(current)) {
    failure = new Error(`Zenler enrolment incomplete for order ${current.id}; student confirmation held`);
  }

  if (failure) throw failure;
  return current;
}

function contextForStudentEmail(
  order: PaymentOrder,
  emailContext: ZenlerEnrollmentEmailContext | null,
): ZenlerEnrollmentEmailContext | null {
  if (emailContext && String(emailContext.zenlerEnrollmentStatus).toLowerCase().startsWith('enrolled')) {
    return emailContext;
  }
  return enrollmentEmailContextForOrder(order);
}

function waitingForPasswordHolder(
  order: PaymentOrder,
  emailContext: ZenlerEnrollmentEmailContext | null,
): boolean {
  const createdNewUser = order.zenlerUserCreated || emailContext?.isNewZenlerUser === true;
  if (!createdNewUser || emailContext?.temporaryPassword) return false;
  if (!order.paidAt) return false;
  return Date.now() - new Date(order.paidAt).getTime() < NEW_USER_PASSWORD_EMAIL_GRACE_MS;
}

async function sendClaimedEmail(
  orderId: number,
  kind: 'student' | 'admin',
  send: () => Promise<boolean>,
): Promise<void> {
  const claimToken = await claimOrderEmailSend(orderId, kind);
  if (!claimToken) return;

  let committed = false;
  try {
    const delivered = await send();
    if (!delivered) return;
    await markOrderEmailSent(orderId, kind, claimToken);
    committed = true;
  } finally {
    if (!committed) {
      try {
        await releaseOrderEmailSend(orderId, kind, claimToken);
      } catch (releaseErr) {
        console.error('[payments] failed to release email claim', orderId, kind, releaseErr);
      }
    }
  }
}

async function sendUnsentPaymentEmails(
  order: PaymentOrder,
  emailContext: ZenlerEnrollmentEmailContext | null,
): Promise<PaymentOrder> {
  const fresh = (await getPaymentOrder(order.id)) ?? order;
  const access = contextForStudentEmail(fresh, emailContext);
  const sendStudent = !fresh.confirmationEmailSentAt
    && !zenlerAccessStillBlockingStudentEmail(fresh)
    && !waitingForPasswordHolder(fresh, access);
  const sendAdmin = !fresh.adminEmailSentAt;
  if (!sendStudent && !sendAdmin) return fresh;

  const errors: unknown[] = [];

  if (sendStudent) {
    try {
      await sendClaimedEmail(fresh.id, 'student', () => sendStudentPaymentConfirmation(fresh, access));
    } catch (err) {
      console.error('[payments] student confirmation retry failed', order.id, err);
      errors.push(err);
    }
  }
  if (sendAdmin) {
    try {
      await sendClaimedEmail(fresh.id, 'admin', () => sendAdminPaymentNotification(fresh));
    } catch (err) {
      console.error('[payments] admin payment notification retry failed', order.id, err);
      errors.push(err);
    }
  }

  const updated = (await getPaymentOrder(order.id)) ?? fresh;
  if (errors.length) throw errors[0];
  return updated;
}

export type PaymentReconciliationResult = {
  selected: number;
  reconciled: number;
  failed: number;
};

export async function reconcileIncompletePaidOrders(): Promise<PaymentReconciliationResult> {
  const orders = await listPaidOrdersNeedingReconciliation({
    limit: RECONCILIATION_BATCH_SIZE,
    minAgeMinutes: RECONCILIATION_MIN_AGE_MINUTES,
    lookbackDays: RECONCILIATION_LOOKBACK_DAYS,
    includeAdminEmail: Boolean(process.env.ADMIN_NOTIFICATION_EMAIL?.trim()),
  });

  let reconciled = 0;
  let failed = 0;
  for (const order of orders) {
    try {
      await markFulfillmentAttempted(order.id);
      await reconcilePaidOrder(order);
      reconciled += 1;
    } catch (err) {
      failed += 1;
      console.error('[cron/payment-reconciliation]', order.id, err);
    }
  }

  return { selected: orders.length, reconciled, failed };
}

export async function fulfillPaidCheckout(event: CheckoutCompletedEvent): Promise<PaymentOrder | null> {
  const existing = await resolveOrderForCheckout(event);
  if (!existing) return null;
  if (existing.status === 'Paid') {
    return reconcilePaidOrder(existing);
  }
  if (existing.status === 'Cancelled' || existing.status === 'Failed' || existing.status === 'Refunded') return existing;

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

  if (wasAlreadyPaid) {
    return reconcilePaidOrder(order);
  }

  const email = paymentOrderPayerEmail(order);
  let enrollmentEmailContext = null;
  if (email && (order.zenlerCourseId || (order.accessZenlerCourseIds?.length ?? 0) > 0)) {
    const enrollmentResult = await runZenlerEnrollmentForPaidOrder(order);
    order = enrollmentResult.order;
    enrollmentEmailContext = enrollmentResult.emailContext;
  }

  order = await sendUnsentPaymentEmails(order, enrollmentEmailContext);

  await ensureSaleRecordedForPaidOrder(order);
  if (zenlerAccessStillBlockingStudentEmail(order)) {
    throw new Error(`Zenler enrolment incomplete for order ${order.id}; student confirmation held`);
  }
  return order;
}

export async function closeAbandonedCheckout(event: CheckoutClosedEvent): Promise<PaymentOrder | null> {
  const existing = await resolveOrderForCheckout(event);
  if (!existing || existing.status !== 'Pending') return existing;
  return closePendingPaymentOrder({
    orderId: existing.id,
    status: event.status,
  });
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
