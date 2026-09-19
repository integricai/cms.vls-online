import crypto from 'crypto';
import type { CheckoutEnvironment } from '../../shared/types';
import { resolveCheckoutEnvironment } from './attribution';
import { resolveCheckoutSiteUrl } from './checkoutSiteUrl';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

function appendParam(params: URLSearchParams, key: string, value: string | number | null | undefined): void {
  if (value != null && value !== '') params.append(key, String(value));
}

export async function createStripeCheckoutSession(input: {
  orderId: number;
  paymentOptionId?: number | null;
  courseId?: number | null;
  coursePriceId?: number | null;
  zenlerCourseId: string;
  courseTitle: string;
  paymentCardTitle: string;
  amount: number;
  currency: string;
  studentEmail: string | null;
  countryCode?: string | null;
  paymentMethodTypes?: string[];
  returnOrigin?: string | null;
  environment?: CheckoutEnvironment | null;
}): Promise<StripeCheckoutSession> {
  const environment = input.environment
    ?? resolveCheckoutEnvironment({ origin: input.returnOrigin });
  const secretKey = stripeSecretKeyForEnvironment(environment);

  const siteUrl = resolveCheckoutSiteUrl(input.returnOrigin);
  const unitAmount = Math.round(input.amount * 100);
  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const paymentMethodTypes = input.paymentMethodTypes?.length
    ? input.paymentMethodTypes
    : ['card', 'paypal', 'klarna'];

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  // Explicit types so Dashboard dynamic methods cannot omit card/Klarna/PayPal.
  for (const method of paymentMethodTypes) {
    params.append('payment_method_types[]', method);
  }
  params.append('success_url', `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${siteUrl}/payment-cancelled`);
  params.append('billing_address_collection', 'required');
  params.append('client_reference_id', String(input.orderId));
  params.append('line_items[0][price_data][currency]', input.currency.toLowerCase());
  params.append('line_items[0][price_data][product_data][name]', input.paymentCardTitle || input.courseTitle);
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.append('line_items[0][quantity]', '1');
  appendParam(params, 'customer_email', input.studentEmail);
  params.append('metadata[orderId]', String(input.orderId));
  appendParam(params, 'metadata[paymentOptionId]', input.paymentOptionId);
  appendParam(params, 'metadata[courseId]', input.courseId);
  appendParam(params, 'metadata[coursePriceId]', input.coursePriceId);
  params.append('metadata[zenlerCourseId]', input.zenlerCourseId);
  params.append('metadata[courseTitle]', input.courseTitle);
  appendParam(params, 'metadata[studentEmail]', input.studentEmail);
  appendParam(params, 'metadata[countryCode]', input.countryCode);

  const response = await fetchWithTimeout('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    timeoutMs: 20_000,
  });

  const body = await response.json() as { id?: string; url?: string | null; error?: { message?: string } };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? `Stripe checkout failed (${response.status})`);
  }

  return { id: body.id, url: body.url ?? null };
}

export function stripeSecretKeyForEnvironment(
  environment?: CheckoutEnvironment | null,
): string {
  if (environment === 'production') {
    const liveKey = process.env.STRIPE_SECRET_KEY_LIVE?.trim();
    if (!liveKey) throw new Error('STRIPE_SECRET_KEY_LIVE is not configured');
    return liveKey;
  }
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return secretKey;
}

function webhookSecrets(): string[] {
  return [
    process.env.STRIPE_WEBHOOK_SECRET_LIVE,
    process.env.STRIPE_WEBHOOK_SECRET,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);
}

function verifyStripeSignature(rawBody: Buffer, signatureHeader: string, secret: string): boolean {
  const parts = Object.fromEntries(signatureHeader.split(',').map(part => {
    const [key, value] = part.split('=', 2);
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const actual = Buffer.from(signature, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  return actual.length === wanted.length && crypto.timingSafeEqual(actual, wanted);
}

export async function createStripeRefund(input: {
  paymentIntentId: string;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  environment?: CheckoutEnvironment | null;
}): Promise<{ id: string; status: string; paymentIntentId: string | null }> {
  const secretKey = stripeSecretKeyForEnvironment(input.environment);
  const params = new URLSearchParams();
  params.append('payment_intent', input.paymentIntentId);
  if (input.reason) params.append('reason', input.reason);

  const response = await fetchWithTimeout('https://api.stripe.com/v1/refunds', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    timeoutMs: 20_000,
  });

  const body = await response.json() as {
    id?: string;
    status?: string;
    payment_intent?: string | { id?: string } | null;
    error?: { message?: string };
  };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? `Stripe refund failed (${response.status})`);
  }

  const paymentIntentId = typeof body.payment_intent === 'string'
    ? body.payment_intent
    : body.payment_intent?.id ?? input.paymentIntentId;

  return {
    id: body.id,
    status: body.status ?? 'succeeded',
    paymentIntentId,
  };
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined): unknown {
  const secrets = webhookSecrets();
  if (secrets.length === 0) {
    throw new Error('STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_LIVE is not configured');
  }
  if (!signatureHeader) throw new Error('Missing Stripe signature');

  const matched = secrets.some((secret) => verifyStripeSignature(rawBody, signatureHeader, secret));
  if (!matched) throw new Error('Invalid Stripe signature');

  return JSON.parse(rawBody.toString('utf8')) as unknown;
}
