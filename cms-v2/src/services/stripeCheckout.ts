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

/** Shown under the course name in the left order summary, beneath the currency choice. */
export const STRIPE_PAYPAL_CURRENCY_NOTE =
  'To pay by PayPal, please select the USD price, provided PayPal is available in your country.';

export const STRIPE_RETURNING_STUDENT_MESSAGE =
  'Already a Vertex student? Use the email you log in with.';

/** Card already surfaces Apple Pay and Google Pay. Link is added only when Stripe collects the email. */
export function stripePaymentMethodTypes(paymentFirst: boolean, currency = 'USD'): string[] {
  if (!paymentFirst) return ['card', 'paypal', 'klarna'];
  if (currency.toUpperCase() === 'USD') return ['card', 'link', 'paypal', 'klarna'];
  return ['card', 'link'];
}

const STRIPE_ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF',
  'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

/** Stripe wants the amount in the currency's minor unit. Yen is already that unit. */
export function stripeUnitAmount(amount: number, currency: string): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  const unit = STRIPE_ZERO_DECIMAL.has(currency.toUpperCase())
    ? Math.round(amount)
    : Math.round(amount * 100);
  if (!Number.isInteger(unit) || unit <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  return unit;
}

/** Course page path, or the generic cancelled page when the path is not same-site. */
export function safeCheckoutCancelPath(value: string | null | undefined): string {
  const path = String(value ?? '').trim();
  if (
    !path.startsWith('/')
    || path.startsWith('//')
    || path.includes('://')
    || path.includes('\\')
    || path.length > 500
  ) {
    return '/payment-cancelled';
  }
  return path;
}

export function appendStripeOrderSummaryNote(params: URLSearchParams): void {
  params.append('line_items[0][price_data][product_data][description]', STRIPE_PAYPAL_CURRENCY_NOTE);
}

/** Stripe draws the local price and the dollar price, on desktop and on a phone. */
export function appendStripeAdaptivePricing(params: URLSearchParams, currency: string): void {
  if (currency.toUpperCase() !== 'USD') return;
  params.append('adaptive_pricing[enabled]', 'true');
}

export type LocalPresentment = {
  amount: number;
  currency: string;
};

/**
 * Stripe stores this currency on the PaymentIntent.
 * A price currency option would record the student's local currency instead.
 */
export function assertStripeUsdCharge(currency: string): void {
  if (currency.toUpperCase() !== 'USD') {
    throw new Error('Stripe charges must be in USD');
  }
}

export type PaidAmountDecision = 'order' | 'presentment' | 'mismatch';

/** Accept the dollar charge, or the local amount that was locked onto the same checkout. */
export function classifyPaidAmount(input: {
  orderAmount: number;
  orderCurrency: string;
  presentmentAmount?: number | null;
  presentmentCurrency?: string | null;
  paidAmountMinor: number;
  paidCurrency: string;
}): PaidAmountDecision {
  const paidCurrency = input.paidCurrency.toUpperCase();
  const orderCurrency = input.orderCurrency.toUpperCase();
  if (paidCurrency === orderCurrency) {
    const expected = orderCurrency === 'USD' || !STRIPE_ZERO_DECIMAL.has(orderCurrency)
      ? Math.round(input.orderAmount * 100)
      : Math.round(input.orderAmount);
    return expected === input.paidAmountMinor ? 'order' : 'mismatch';
  }
  const presentmentCurrency = input.presentmentCurrency?.toUpperCase() ?? '';
  if (
    presentmentCurrency
    && paidCurrency === presentmentCurrency
    && input.presentmentAmount != null
    && input.presentmentAmount > 0
  ) {
    const expected = stripeUnitAmount(input.presentmentAmount, presentmentCurrency);
    return expected === input.paidAmountMinor ? 'presentment' : 'mismatch';
  }
  return 'mismatch';
}

/** Stripe minor units back to the amount we store. Yen is already that unit. */
export function majorAmountFromStripeMinor(amountMinor: number, currency: string): number {
  if (STRIPE_ZERO_DECIMAL.has(currency.toUpperCase())) return amountMinor;
  return amountMinor / 100;
}

function clipStripeName(value: string | null | undefined): string {
  return String(value ?? '').trim().slice(0, 80);
}

/**
 * Values for the Stripe name boxes. A name from our form wins for that box.
 * The school account is next, then the name stored on a discount code.
 * Both form names means those boxes are left off the page, so this returns nothing.
 */
export function resolveStripeStudentNameDefaults(input: {
  formFirstName?: string | null;
  formLastName?: string | null;
  schoolFirstName?: string | null;
  schoolLastName?: string | null;
  codeFirstName?: string | null;
  codeLastName?: string | null;
}): { studentFirstName?: string; studentLastName?: string } {
  const formFirstName = clipStripeName(input.formFirstName);
  const formLastName = clipStripeName(input.formLastName);
  if (formFirstName && formLastName) return {};

  const studentFirstName = formFirstName
    || clipStripeName(input.schoolFirstName)
    || clipStripeName(input.codeFirstName);
  const studentLastName = formLastName
    || clipStripeName(input.schoolLastName)
    || clipStripeName(input.codeLastName);
  return {
    ...(studentFirstName ? { studentFirstName } : {}),
    ...(studentLastName ? { studentLastName } : {}),
  };
}

/** Required name fields on the Stripe page, beside the email. */
export function appendStripeStudentNameFields(
  params: URLSearchParams,
  defaults?: { firstName?: string | null; lastName?: string | null },
): void {
  const fields = [
    { key: 'first_name', label: 'First name', value: defaults?.firstName },
    { key: 'last_name', label: 'Last name', value: defaults?.lastName },
  ];
  fields.forEach((field, index) => {
    params.append(`custom_fields[${index}][key]`, field.key);
    params.append(`custom_fields[${index}][label][type]`, 'custom');
    params.append(`custom_fields[${index}][label][custom]`, field.label);
    params.append(`custom_fields[${index}][type]`, 'text');
    params.append(`custom_fields[${index}][optional]`, 'false');
    params.append(`custom_fields[${index}][text][minimum_length]`, '1');
    params.append(`custom_fields[${index}][text][maximum_length]`, '80');
    const value = String(field.value ?? '').trim().slice(0, 80);
    if (value) params.append(`custom_fields[${index}][text][default_value]`, value);
  });
}

/** Lock Checkout to this email. A prefilled customer_email can still be edited. */
export async function stripeCustomerIdForEmail(
  email: string,
  environment?: CheckoutEnvironment | null,
): Promise<string> {
  const secretKey = stripeSecretKeyForEnvironment(environment);
  const query = new URLSearchParams({ email, limit: '1' });
  const listed = await stripeApiRequest(secretKey, `/customers?${query.toString()}`, { method: 'GET' });
  const customers = Array.isArray(listed.data) ? listed.data as Array<{ id?: string; email?: string }> : [];
  const match = customers.find((customer) => customer.email?.trim().toLowerCase() === email.toLowerCase());
  if (match?.id) return match.id;

  const params = new URLSearchParams();
  params.set('email', email);
  const created = await stripeApiRequest(secretKey, '/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (typeof created.id !== 'string' || !created.id) {
    throw new Error('Stripe did not return a customer id');
  }
  return created.id;
}

async function stripeApiRequest(
  secretKey: string,
  path: string,
  init: RequestInit,
): Promise<{ id?: string; data?: unknown; error?: { message?: string } }> {
  const response = await fetchWithTimeout(`https://api.stripe.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init.headers ?? {}),
    },
    timeoutMs: 20_000,
  });
  const body = await response.json() as { id?: string; data?: unknown; error?: { message?: string } };
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Stripe request failed (${response.status})`);
  }
  return body;
}

/** Close an unpaid Checkout page. A completed payment is left alone. */
export async function expireOpenStripeCheckoutSession(
  sessionId: string,
  environment?: CheckoutEnvironment | null,
): Promise<'expired' | 'complete'> {
  const secretKey = stripeSecretKeyForEnvironment(environment);
  try {
    await stripeApiRequest(secretKey, `/checkout/sessions/${encodeURIComponent(sessionId)}/expire`, {
      method: 'POST',
    });
    return 'expired';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/complete|succeeded/i.test(message)) return 'complete';
    if (/expired/i.test(message)) return 'expired';
    throw err;
  }
}

export async function readStripeCheckoutSession(
  sessionId: string,
  environment?: CheckoutEnvironment | null,
): Promise<{ status: string; url: string | null }> {
  const secretKey = stripeSecretKeyForEnvironment(environment);
  const body = await stripeApiRequest(
    secretKey,
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  ) as { status?: string; url?: string | null };
  return { status: body.status ?? '', url: body.url ?? null };
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
  skipStudentNameFields?: boolean;
  studentFirstName?: string | null;
  studentLastName?: string | null;
  countryCode?: string | null;
  paymentMethodTypes?: string[];
  returnOrigin?: string | null;
  cancelPath?: string | null;
  environment?: CheckoutEnvironment | null;
  /** Exact local amount from the course page. The dollar amount stays the integration price. */
  localPresentment?: LocalPresentment | null;
  /** An emailed offer that was saved in a local currency. The amount is that offer, not today's price. */
  savedOffer?: boolean;
}): Promise<StripeCheckoutSession> {
  if (!input.savedOffer) assertStripeUsdCharge(input.currency);
  const chargeCurrency = input.currency.toUpperCase();
  const environment = input.environment
    ?? resolveCheckoutEnvironment({ origin: input.returnOrigin });
  const secretKey = stripeSecretKeyForEnvironment(environment);
  const siteUrl = resolveCheckoutSiteUrl(input.returnOrigin);
  const unitAmount = stripeUnitAmount(input.amount, chargeCurrency);

  const paymentFirst = !input.studentEmail;
  const paymentMethodTypes = input.paymentMethodTypes?.length
    ? input.paymentMethodTypes
    : stripePaymentMethodTypes(paymentFirst);

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  // Explicit types so Dashboard dynamic methods cannot omit card/Klarna/PayPal.
  for (const method of paymentMethodTypes) {
    params.append('payment_method_types[]', method);
  }
  params.append('success_url', `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${siteUrl}${safeCheckoutCancelPath(input.cancelPath)}`);
  if (paymentFirst) {
    params.append('custom_text[submit][message]', STRIPE_RETURNING_STUDENT_MESSAGE);
    params.append('metadata[flow]', 'standard');
  }
  params.append('billing_address_collection', 'required');
  if (!input.skipStudentNameFields) {
    appendStripeStudentNameFields(params, {
      firstName: input.studentFirstName,
      lastName: input.studentLastName,
    });
  }
  params.append('client_reference_id', String(input.orderId));
  // New checkouts are USD. Adaptive Pricing may show a local price; the PaymentIntent stays USD.
  params.append('line_items[0][price_data][currency]', chargeCurrency.toLowerCase());
  params.append('line_items[0][price_data][product_data][name]', input.paymentCardTitle || input.courseTitle);
  appendStripeOrderSummaryNote(params);
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  appendStripeAdaptivePricing(params, chargeCurrency);
  params.append('line_items[0][quantity]', '1');
  if (input.studentEmail) {
    try {
      const customerId = await stripeCustomerIdForEmail(input.studentEmail, environment);
      params.append('customer', customerId);
    } catch (err) {
      console.error('[stripe] could not lock the checkout email', err instanceof Error ? err.message : err);
      appendParam(params, 'customer_email', input.studentEmail);
    }
  } else {
    appendParam(params, 'customer_email', input.studentEmail);
  }
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
      'Idempotency-Key': `checkout-session-${input.orderId}`,
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

/**
 * Live and sandbox webhook secrets are both accepted.
 * A sandbox event is still rejected for a production order.
 */
function webhookSecrets(): Array<{ secret: string; livemode: boolean }> {
  const live = trimmedEnv(process.env.STRIPE_WEBHOOK_SECRET_LIVE);
  const test = trimmedEnv(process.env.STRIPE_WEBHOOK_SECRET);
  const secrets: Array<{ secret: string; livemode: boolean }> = [];
  if (live) secrets.push({ secret: live, livemode: true });
  if (test && test !== live) secrets.push({ secret: test, livemode: false });
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
