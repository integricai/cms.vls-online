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
  rememberPaymentOrderStudentName,
  rememberPresentedCharge,
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
import { majorAmountFromStripeMinor } from '../stripeCheckout';
import { courseAccessUrlForEnrollment } from '../schoolAccess';
import { clearStudentPassword } from '../studentPassword';
import { ensureSaleRecordedForPaidOrder } from '../saleRecording';
import { consumeRetakeCodeForOrder, releaseRetakeCodeForOrder } from '../retakeDiscount';
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

/** Thrown when the course-access confirmation could not be delivered. */
export class StudentConfirmationEmailError extends Error {
  constructor() {
    super('Student confirmation email failed');
    this.name = 'StudentConfirmationEmailError';
  }
}

export function isStudentConfirmationEmailError(err: unknown): boolean {
  if (err instanceof StudentConfirmationEmailError) return true;
  return Boolean(
    err
    && typeof err === 'object'
    && (err as { confirmationEmailFailed?: boolean }).confirmationEmailFailed === true,
  );
}

/**
 * Paid is stored before Zenler enrolment and confirmation emails. A webhook
 * retry, or the reconciliation cron, has to finish whichever of those did not.
 */
export async function reconcilePaidOrder(order: PaymentOrder): Promise<PaymentOrder> {
  if (order.status !== 'Paid') return order;

  let current = order;
  let emailContext: ZenlerEnrollmentEmailContext | null = null;
  let failure: unknown = null;
  let confirmationEmailFailed = false;

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
    if (isStudentConfirmationEmailError(err)) confirmationEmailFailed = true;
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

  if (failure) {
    if (confirmationEmailFailed && failure instanceof Error) {
      (failure as Error & { confirmationEmailFailed?: boolean }).confirmationEmailFailed = true;
    }
    throw failure;
  }
  return current;
}

async function contextForStudentEmail(
  order: PaymentOrder,
  emailContext: ZenlerEnrollmentEmailContext | null,
): Promise<ZenlerEnrollmentEmailContext | null> {
  const fromOrder = await enrollmentEmailContextForOrder(order);
  const studentChosePassword = emailContext?.studentChosePassword === true
    || fromOrder?.studentChosePassword === true;
  if (order.zenlerUserCreated || emailContext?.isNewZenlerUser) {
    return {
      isNewZenlerUser: true,
      temporaryPassword: emailContext?.temporaryPassword ?? null,
      studentChosePassword,
      courseAccessUrl: emailContext?.courseAccessUrl
        ?? fromOrder?.courseAccessUrl
        ?? courseAccessUrlForEnrollment({
          zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
          isNewZenlerUser: true,
        }),
      zenlerEnrollmentStatus: emailContext?.zenlerEnrollmentStatus
        ?? fromOrder?.zenlerEnrollmentStatus
        ?? order.zenlerEnrollmentStatus
        ?? 'enrolled',
    };
  }
  if (emailContext && String(emailContext.zenlerEnrollmentStatus).toLowerCase().startsWith('enrolled')) {
    return emailContext;
  }
  return fromOrder;
}

function waitingForPasswordHolder(
  order: PaymentOrder,
  emailContext: ZenlerEnrollmentEmailContext | null,
): boolean {
  const status = String(order.zenlerEnrollmentStatus ?? '').toLowerCase();
  if (status === 'failed' || status === 'skipped') return false;
  const createdNewUser = order.zenlerUserCreated || emailContext?.isNewZenlerUser === true;
  if (emailContext?.studentChosePassword) return false;
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
  const access = await contextForStudentEmail(fresh, emailContext);
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
      errors.push(new StudentConfirmationEmailError());
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
  const studentFailure = errors.find((err) => err instanceof StudentConfirmationEmailError);
  if (studentFailure) throw studentFailure;
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
  if (
    event.presentmentAmountMinor != null
    && event.presentmentCurrency
    && event.presentmentCurrency.toUpperCase() !== order.currency.toUpperCase()
  ) {
    order = await rememberPresentedCharge(
      order.id,
      majorAmountFromStripeMinor(event.presentmentAmountMinor, event.presentmentCurrency),
      event.presentmentCurrency,
    );
  }

  const payerEmail = paymentOrderPayerEmail(order) ?? event.customerEmail;
  const payerName = (event.customerName ?? order.studentName ?? '').trim();
  if (payerName) {
    order = await rememberPaymentOrderStudentName(order.id, payerName);
  }
  if (payerEmail) {
    const { firstName, lastName } = splitStudentName(order.studentName ?? payerName);
    await upsertCustomer({
      email: String(payerEmail).trim().toLowerCase(),
      firstName,
      lastName,
      countryCode: order.countryCode,
      source: customerSourceForProvider(event.provider),
    });
  }

  await consumeRetakeCodeForOrder(order.id).catch((err: unknown) => {
    console.error('[payments] could not mark the retake code used', order.id, err);
  });

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
  const closed = await closePendingPaymentOrder({
    orderId: existing.id,
    status: event.status,
  });
  await releaseRetakeCodeForOrder(existing.id).catch((err: unknown) => {
    console.error('[payments] could not release the retake code', existing.id, err);
  });
  await clearStudentPassword(existing.id).catch((err: unknown) => {
    console.error('[payments] could not clear the stored password', existing.id, err);
  });
  return closed;
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
