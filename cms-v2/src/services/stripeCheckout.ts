import crypto from 'crypto';
import type { CheckoutEnvironment } from '../../shared/types';
import { isProductionCheckoutDeployment, resolveCheckoutEnvironment } from './attribution';
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
  const environment = isProductionCheckoutDeployment()
    ? 'production'
    : (input.environment ?? resolveCheckoutEnvironment({ origin: input.returnOrigin }));
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

function trimmedEnv(value: string | undefined): string {
  return String(value ?? '').trim();
}

let warnedIgnoredTestWebhookSecret = false;

/**
 * Production accepts only the live webhook secret.
 * Do not set STRIPE_WEBHOOK_SECRET (the test secret) on production; it is ignored.
 */
function webhookSecrets(): Array<{ secret: string; livemode: boolean }> {
  const live = trimmedEnv(process.env.STRIPE_WEBHOOK_SECRET_LIVE);
  const test = trimmedEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const production = isProductionCheckoutDeployment();
  if (production && test && !warnedIgnoredTestWebhookSecret) {
    warnedIgnoredTestWebhookSecret = true;
    console.warn(
      '[stripe] STRIPE_WEBHOOK_SECRET is set on a production deployment and is ignored. Use STRIPE_WEBHOOK_SECRET_LIVE only.',
    );
  }
  const secrets: Array<{ secret: string; livemode: boolean }> = [];
  if (live) secrets.push({ secret: live, livemode: true });
  if (!production && test && test !== live) {
    secrets.push({ secret: test, livemode: false });
  }
  return secrets;
}

export function stripeEventLivemode(event: unknown): boolean | null {
  if (!event || typeof event !== 'object') return null;
  const payload = event as { livemode?: unknown; data?: { object?: { livemode?: unknown } } };
  if (typeof payload.livemode === 'boolean') return payload.livemode;
  if (typeof payload.data?.object?.livemode === 'boolean') return payload.data.object.livemode;
  return null;
}

/** Stripe's default replay window. Payloads signed earlier than this are rejected. */
export const STRIPE_WEBHOOK_TOLERANCE_SECONDS = 300;

function parseStripeSignatureHeader(signatureHeader: string): { timestamp: string | null; signatures: string[] } {
  let timestamp: string | null = null;
  const signatures: string[] = [];
  // Secret rotation sends several v1 values. Keeping only the last one drops a still-valid signature.
  for (const part of signatureHeader.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!value) continue;
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
  }
  return { timestamp, signatures };
}

function matchStripeSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): 'match' | 'stale' | 'mismatch' {
  const { timestamp, signatures } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || !/^\d+$/.test(timestamp) || signatures.length === 0) return 'mismatch';

  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expectedHex = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
  const expected = Buffer.from(expectedHex, 'hex');

  let matched = false;
  for (const signature of signatures) {
    if (!/^[0-9a-f]+$/i.test(signature) || signature.length !== expectedHex.length) continue;
    const actual = Buffer.from(signature, 'hex');
    if (actual.length === expected.length && crypto.timingSafeEqual(actual, expected)) {
      matched = true;
    }
  }
  if (!matched) return 'mismatch';

  const ageSeconds = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (ageSeconds > STRIPE_WEBHOOK_TOLERANCE_SECONDS) return 'stale';
  return 'match';
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
    throw new Error(
      isProductionCheckoutDeployment()
        ? 'STRIPE_WEBHOOK_SECRET_LIVE is not configured'
        : 'STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_SECRET_LIVE is not configured',
    );
  }
  if (!signatureHeader) throw new Error('Missing Stripe signature');

  let matched: { secret: string; livemode: boolean } | undefined;
  for (const entry of secrets) {
    const result = matchStripeSignature(rawBody, signatureHeader, entry.secret);
    if (result === 'stale') {
      throw new Error('Stripe webhook timestamp is outside the tolerance window');
    }
    if (result === 'match') {
      matched = entry;
      break;
    }
  }
  if (!matched) throw new Error('Invalid Stripe signature');

  const event = JSON.parse(rawBody.toString('utf8')) as unknown;
  const livemode = stripeEventLivemode(event);
  if (livemode !== null && livemode !== matched.livemode) {
    throw new Error('Stripe livemode does not match the webhook secret');
  }
  return event;
}
