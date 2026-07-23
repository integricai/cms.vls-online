import crypto from 'crypto';
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
}): Promise<StripeCheckoutSession> {
  const secretKey = stripeSecretKey();

  const siteUrl = (process.env.PUBLIC_SITE_URL ?? 'https://vls-online.com').replace(/\/+$/, '');
  const unitAmount = Math.round(input.amount * 100);
  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
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

function stripeSecretKey(): string {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  return secretKey;
}

async function stripeApiGet<T>(path: string, query?: Record<string, string>): Promise<T> {
  const params = query ? `?${new URLSearchParams(query).toString()}` : '';
  const response = await fetchWithTimeout(`https://api.stripe.com/v1${path}${params}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey()}` },
    timeoutMs: 20_000,
  });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Stripe API GET failed (${response.status})`);
  }
  return body;
}

async function stripeApiPost<T>(path: string, params: URLSearchParams): Promise<T> {
  const response = await fetchWithTimeout(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${stripeSecretKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
    timeoutMs: 20_000,
  });
  const body = await response.json() as T & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Stripe API POST failed (${response.status})`);
  }
  return body;
}

type StripePaymentMethod = {
  type?: string;
  card?: { country?: string | null };
  billing_details?: { address?: { country?: string | null } };
};

type StripePaymentIntent = {
  payment_method?: StripePaymentMethod | string | null;
};

function countryFromPaymentMethod(paymentMethod: StripePaymentMethod | null | undefined): string | null {
  if (!paymentMethod) return null;
  const cardCountry = paymentMethod.card?.country?.trim().toUpperCase();
  if (cardCountry) return cardCountry;
  const billingCountry = paymentMethod.billing_details?.address?.country?.trim().toUpperCase();
  return billingCountry || null;
}

/** Issuing/billing country for the payment method used on a PaymentIntent. */
export async function fetchPaymentMethodCountry(paymentIntentId: string): Promise<string | null> {
  const intent = await stripeApiGet<StripePaymentIntent>(`/payment_intents/${encodeURIComponent(paymentIntentId)}`, {
    'expand[]': 'payment_method',
  });
  const paymentMethod = typeof intent.payment_method === 'object' ? intent.payment_method : null;
  return countryFromPaymentMethod(paymentMethod);
}

export async function createStripeRefund(paymentIntentId: string): Promise<{ id: string }> {
  const params = new URLSearchParams();
  params.append('payment_intent', paymentIntentId);
  params.append('reason', 'requested_by_customer');
  const refund = await stripeApiPost<{ id: string }>('/refunds', params);
  return { id: refund.id };
}

export function verifyStripeWebhook(rawBody: Buffer, signatureHeader: string | undefined): unknown {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  if (!signatureHeader) throw new Error('Missing Stripe signature');

  const parts = Object.fromEntries(signatureHeader.split(',').map(part => {
    const [key, value] = part.split('=', 2);
    return [key, value];
  }));
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) throw new Error('Invalid Stripe signature');

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const actual = Buffer.from(signature, 'hex');
  const wanted = Buffer.from(expected, 'hex');
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) {
    throw new Error('Invalid Stripe signature');
  }

  return JSON.parse(rawBody.toString('utf8')) as unknown;
}
