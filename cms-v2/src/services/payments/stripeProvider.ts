import type { CheckoutEnvironment } from '../../../shared/types';
import type { PaymentOrder } from '../../models/paymentOrder';
import {
  createStripeCheckoutSession,
  createStripeRefund,
  stripeEventLivemode,
  verifyStripeWebhook,
} from '../stripeCheckout';
import { isPaypalConfigured } from './paypalProvider';
import type {
  CheckoutCompletedEvent,
  CreateCheckoutInput,
  IPaymentProvider,
  ProviderWebhookEvent,
  RefundCompletedEvent,
  RefundInput,
  RefundResult,
} from './types';

function extractStripeId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

/** Live events belong to production orders. Test events belong to staging orders. */
export function stripeLivemodeMatchesOrder(
  livemode: boolean | null,
  environment: CheckoutEnvironment,
): boolean {
  if (livemode === true) return environment === 'production';
  if (livemode === false) return environment === 'staging';
  return false;
}

export function assertStripeLivemodeMatchesOrder(
  livemode: boolean | null,
  environment: CheckoutEnvironment,
): void {
  if (!stripeLivemodeMatchesOrder(livemode, environment)) {
    throw new Error('Stripe livemode does not match the order environment');
  }
}

async function findStripeOrder(mapped: ProviderWebhookEvent): Promise<PaymentOrder | null> {
  if (mapped.type === 'ignored') return null;
  // Loaded on demand so mapping tests do not open the database.
  const orders = await import('../../models/paymentOrder');
  if (mapped.type === 'checkout.completed') {
    if (Number.isInteger(mapped.orderId) && (mapped.orderId ?? 0) > 0) {
      const byId = await orders.getPaymentOrder(mapped.orderId as number);
      if (byId) return byId;
    }
    if (mapped.checkoutId) return orders.getPaymentOrderByCheckoutId(mapped.checkoutId, 'stripe');
    return null;
  }
  if (mapped.paymentId) {
    const byPayment = await orders.getPaymentOrderByPaymentId(mapped.paymentId, 'stripe');
    if (byPayment) return byPayment;
  }
  if (mapped.checkoutId) return orders.getPaymentOrderByCheckoutId(mapped.checkoutId, 'stripe');
  return null;
}

export function mapStripeWebhookEvent(event: unknown): ProviderWebhookEvent {
  const payload = asRecord(event);
  const type = typeof payload.type === 'string' ? payload.type : '';
  const object = asRecord(payload.data?.object);

  if (type === 'checkout.session.completed') {
    const completed: CheckoutCompletedEvent = {
      type: 'checkout.completed',
      provider: 'stripe',
      orderId: Number(object.client_reference_id ?? object.metadata?.orderId),
      checkoutId: typeof object.id === 'string' ? object.id : null,
      paymentId: extractStripeId(object.payment_intent),
      customerEmail: object.customer_details?.email ?? object.customer_email ?? null,
      customerName: typeof object.customer_details?.name === 'string' ? object.customer_details.name : null,
      amountMinor: typeof object.amount_total === 'number' ? object.amount_total : null,
      currency: typeof object.currency === 'string' ? object.currency : null,
    };
    return completed;
  }

  if (type === 'charge.refunded') {
    const refunds = Array.isArray(object.refunds?.data) ? object.refunds.data : [];
    const latestRefund = refunds[0] ?? null;
    const refunded: RefundCompletedEvent = {
      type: 'refund.completed',
      provider: 'stripe',
      paymentId: extractStripeId(object.payment_intent),
      refundId: extractStripeId(latestRefund?.id ?? latestRefund),
    };
    return refunded;
  }

  if (type === 'refund.created' || type === 'refund.updated') {
    const status = typeof object.status === 'string' ? object.status : '';
    if (status !== 'succeeded') {
      return { type: 'ignored', provider: 'stripe', reason: `${type}:${status || 'unknown'}` };
    }
    return {
      type: 'refund.completed',
      provider: 'stripe',
      paymentId: extractStripeId(object.payment_intent),
      refundId: extractStripeId(object.id ?? object),
    };
  }

  return { type: 'ignored', provider: 'stripe', reason: type || 'unknown' };
}

export const stripeProvider: IPaymentProvider = {
  id: 'stripe',

  async createCheckout(input: CreateCheckoutInput) {
    const session = await createStripeCheckoutSession({
      ...input,
      // Native PayPal replaces Stripe's PayPal button when configured.
      paymentMethodTypes: isPaypalConfigured()
        ? ['card', 'klarna']
        : ['card', 'paypal', 'klarna'],
    });
    if (!session.url) {
      throw new Error('Stripe did not return a checkout URL');
    }
    return {
      provider: 'stripe' as const,
      checkoutId: session.id,
      checkoutUrl: session.url,
    };
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await createStripeRefund({
      paymentIntentId: input.paymentId,
      reason: input.reason,
      environment: input.environment,
    });
    return {
      refundId: refund.id,
      paymentId: refund.paymentIntentId,
      status: refund.status,
    };
  },

  async parseWebhook(rawBody, headers) {
    const event = verifyStripeWebhook(rawBody, headers['stripe-signature']);
    const mapped = mapStripeWebhookEvent(event);
    const order = await findStripeOrder(mapped);
    if (order) assertStripeLivemodeMatchesOrder(stripeEventLivemode(event), order.checkoutEnvironment);
    return mapped;
  },

  dashboardPaymentUrl(paymentId: string) {
    return `https://dashboard.stripe.com/payments/${paymentId}`;
  },
};
