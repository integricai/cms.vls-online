import { resolveCheckoutSiteUrl } from '../checkoutSiteUrl';
import { isProductionCheckoutDeployment } from '../attribution';
import { fetchWithTimeout } from '../../utils/fetchWithTimeout';
import type {
  CaptureCheckoutResult,
  CheckoutCompletedEvent,
  CreateCheckoutInput,
  IPaymentProvider,
  ProviderWebhookEvent,
  RefundCompletedEvent,
  RefundInput,
  RefundResult,
} from './types';

const ZERO_DECIMAL_CURRENCIES = new Set(['BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF']);

type PaypalTokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: PaypalTokenCache | null = null;

export function isPaypalConfigured(): boolean {
  return Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim());
}

/** Explicit PayPal environment. Unset stays sandbox outside production. */
export function paypalEnvName(): string {
  return (process.env.PAYPAL_ENV ?? process.env.PAYPAL_MODE ?? '').trim().toLowerCase();
}

export function isPaypalLiveEnv(): boolean {
  const env = paypalEnvName();
  return env === 'live' || env === 'production';
}

/**
 * A production deployment must not fall through to PayPal sandbox.
 * PayPal that is not configured is left alone so Stripe-only production can start.
 */
export function assertPaypalEnvForProduction(): void {
  if (!isProductionCheckoutDeployment() || !isPaypalConfigured()) return;
  if (!isPaypalLiveEnv()) {
    throw new Error('PAYPAL_ENV must be live in production');
  }
}

export function paypalApiBase(): string {
  assertPaypalEnvForProduction();
  if (isPaypalLiveEnv()) return 'https://api-m.paypal.com';
  return 'https://api-m.sandbox.paypal.com';
}

export function formatPaypalAmount(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return String(Math.round(amount));
  return (Math.round(amount * 100) / 100).toFixed(2);
}

export function paypalAmountToMinor(value: string | number | null | undefined, currency: string): number | null {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(amount)) return null;
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return Math.round(amount);
  return Math.round(amount * 100);
}

function siteUrl(origin?: string | null): string {
  return resolveCheckoutSiteUrl(origin);
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' ? value as Record<string, any> : {};
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function paypalAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) {
    return tokenCache.token;
  }

  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not configured');
  }

  const response = await fetchWithTimeout(`${paypalApiBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    timeoutMs: 15_000,
  });
  const body = await response.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? `PayPal auth failed (${response.status})`);
  }

  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(30, Number(body.expires_in ?? 300)) * 1000,
  };
  return body.access_token;
}

async function paypalRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await paypalAccessToken();
  const response = await fetchWithTimeout(`${paypalApiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
    timeoutMs: 20_000,
  });
  const body = await response.json().catch(() => ({})) as T & { message?: string; error_description?: string; details?: Array<{ description?: string }> };
  if (!response.ok) {
    const detail = body.details?.[0]?.description ?? body.message ?? body.error_description;
    throw new Error(detail ?? `PayPal request failed (${response.status})`);
  }
  return body;
}

function extractOrderId(resource: Record<string, any>): string | null {
  return textOrNull(resource.id)
    ?? textOrNull(resource.supplementary_data?.related_ids?.order_id)
    ?? textOrNull(resource.order_id);
}

function extractOrderIdFromCustom(resource: Record<string, any>): number | null {
  const customId = textOrNull(resource.custom_id)
    ?? textOrNull(resource.purchase_units?.[0]?.custom_id)
    ?? textOrNull(resource.purchase_units?.[0]?.reference_id)
    ?? textOrNull(resource.invoice_id?.replace(/^vls-order-/, ''));
  const orderId = Number(customId);
  return Number.isInteger(orderId) && orderId > 0 ? orderId : null;
}

function extractCaptureId(resource: Record<string, any>): string | null {
  const captures = resource.purchase_units?.[0]?.payments?.captures;
  if (Array.isArray(captures) && captures[0]?.id) return textOrNull(captures[0].id);
  if (resource.resource_type === 'capture' || resource.intent === 'CAPTURE') {
    return textOrNull(resource.id);
  }
  return textOrNull(resource.id);
}

function extractPayer(resource: Record<string, any>): { email: string | null; name: string | null } {
  const email = textOrNull(resource.payer?.email_address)
    ?? textOrNull(resource.payment_source?.paypal?.email_address);
  const given = textOrNull(resource.payer?.name?.given_name);
  const surname = textOrNull(resource.payer?.name?.surname);
  const name = [given, surname].filter(Boolean).join(' ').trim() || null;
  return { email, name };
}

function extractAmount(resource: Record<string, any>): { amountMinor: number | null; currency: string | null } {
  const amount = resource.amount
    ?? resource.purchase_units?.[0]?.amount
    ?? resource.purchase_units?.[0]?.payments?.captures?.[0]?.amount
    ?? {};
  const currency = textOrNull(amount.currency_code ?? amount.currency);
  return {
    amountMinor: paypalAmountToMinor(amount.value, currency ?? 'USD'),
    currency,
  };
}

export function mapPaypalWebhookEvent(event: unknown): ProviderWebhookEvent {
  const payload = asRecord(event);
  const eventType = typeof payload.event_type === 'string' ? payload.event_type : '';
  const resource = asRecord(payload.resource);

  // Approval only means the buyer consented. Funds are taken on capture, which can still fail.
  if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
    const amount = extractAmount(resource);
    const payer = extractPayer(resource);
    const relatedOrderId = textOrNull(resource.supplementary_data?.related_ids?.order_id);
    const completed: CheckoutCompletedEvent = {
      type: 'checkout.completed',
      provider: 'paypal',
      orderId: extractOrderIdFromCustom(resource),
      checkoutId: relatedOrderId ?? extractOrderId(resource),
      paymentId: textOrNull(resource.id),
      customerEmail: payer.email,
      customerName: payer.name,
      amountMinor: amount.amountMinor,
      currency: amount.currency,
    };
    return completed;
  }

  if (eventType === 'PAYMENT.CAPTURE.REFUNDED' || eventType === 'PAYMENT.CAPTURE.REVERSED') {
    const refunded: RefundCompletedEvent = {
      type: 'refund.completed',
      provider: 'paypal',
      paymentId: textOrNull(resource.supplementary_data?.related_ids?.capture_id)
        ?? textOrNull(resource.links?.find((link: { rel?: string }) => link.rel === 'up')?.href?.split('/').pop()),
      refundId: textOrNull(resource.id),
      checkoutId: textOrNull(resource.supplementary_data?.related_ids?.order_id),
    };
    return refunded;
  }

  return { type: 'ignored', provider: 'paypal', reason: eventType || 'unknown' };
}

function buildCreateOrderBody(input: CreateCheckoutInput) {
  const currency = input.currency.toUpperCase();
  return {
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: String(input.orderId),
      custom_id: String(input.orderId),
      invoice_id: `vls-order-${input.orderId}`,
      description: input.paymentCardTitle || input.courseTitle,
      amount: {
        currency_code: currency,
        value: formatPaypalAmount(input.amount, currency),
      },
    }],
    payer: input.studentEmail ? { email_address: input.studentEmail } : undefined,
    application_context: {
      brand_name: 'VLS Online',
      landing_page: 'LOGIN',
      user_action: 'PAY_NOW',
      shipping_preference: 'NO_SHIPPING',
      return_url: `${siteUrl(input.returnOrigin)}/payment-success?provider=paypal`,
      cancel_url: `${siteUrl(input.returnOrigin)}/payment-cancelled`,
    },
  };
}

async function verifyPaypalWebhook(rawBody: Buffer, headers: Record<string, string | undefined>): Promise<unknown> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (!webhookId) throw new Error('PAYPAL_WEBHOOK_ID is not configured');

  const authAlgo = headers['paypal-auth-algo'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const transmissionTime = headers['paypal-transmission-time'];
  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    throw new Error('Missing PayPal webhook signature headers');
  }

  const webhookEvent = JSON.parse(rawBody.toString('utf8')) as unknown;
  const verification = await paypalRequest<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      auth_algo: authAlgo,
      cert_url: certUrl,
      transmission_id: transmissionId,
      transmission_sig: transmissionSig,
      transmission_time: transmissionTime,
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    }),
  });

  if (verification.verification_status !== 'SUCCESS') {
    throw new Error('Invalid PayPal webhook signature');
  }
  return webhookEvent;
}

export async function capturePaypalOrder(checkoutId: string): Promise<CaptureCheckoutResult> {
  const existing = await paypalRequest<Record<string, any>>(`/v2/checkout/orders/${encodeURIComponent(checkoutId)}`);
  const status = textOrNull(existing.status);
  const captured = status === 'COMPLETED'
    ? existing
    : await paypalRequest<Record<string, any>>(`/v2/checkout/orders/${encodeURIComponent(checkoutId)}/capture`, {
      method: 'POST',
      body: '{}',
    });

  const payer = extractPayer(captured);
  const amount = extractAmount(captured);
  const completed = textOrNull(captured.status) === 'COMPLETED';

  return {
    completed,
    checkoutId,
    paymentId: extractCaptureId(captured),
    customerEmail: payer.email,
    customerName: payer.name,
    amountMinor: amount.amountMinor,
    currency: amount.currency,
  };
}

/** Direct checkout disabled, legacy refund only. Webhooks do not call this provider. */
export const paypalProvider: IPaymentProvider = {
  id: 'paypal',

  async createCheckout(_input: CreateCheckoutInput): Promise<never> {
    throw new Error('Direct PayPal checkout is disabled');
  },

  async refund(input: RefundInput): Promise<RefundResult> {
    const refund = await paypalRequest<{ id?: string; status?: string }>(
      `/v2/payments/captures/${encodeURIComponent(input.paymentId)}/refund`,
      {
        method: 'POST',
        body: '{}',
      },
    );
    if (!refund.id) throw new Error('PayPal refund did not return an id');
    return {
      refundId: refund.id,
      paymentId: input.paymentId,
      status: refund.status ?? 'COMPLETED',
    };
  },

  async parseWebhook(rawBody, headers) {
    const event = await verifyPaypalWebhook(rawBody, headers);
    return mapPaypalWebhookEvent(event);
  },

  captureCheckout: capturePaypalOrder,

  dashboardPaymentUrl(paymentId: string) {
    assertPaypalEnvForProduction();
    const host = isPaypalLiveEnv()
      ? 'https://www.paypal.com'
      : 'https://www.sandbox.paypal.com';
    return `${host}/activity/payment/${paymentId}`;
  },
};

export const paypalProviderInternals = {
  buildCreateOrderBody,
};
