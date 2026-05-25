import crypto from 'crypto';

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
}

function appendParam(params: URLSearchParams, key: string, value: string | number | null | undefined): void {
  if (value != null && value !== '') params.append(key, String(value));
}

export async function createStripeCheckoutSession(input: {
  orderId: number;
  paymentOptionId: number;
  zenlerCourseId: string;
  courseTitle: string;
  paymentCardTitle: string;
  amount: number;
  currency: string;
  studentEmail: string | null;
}): Promise<StripeCheckoutSession> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');

  const siteUrl = (process.env.PUBLIC_SITE_URL ?? 'https://vls-online.com').replace(/\/+$/, '');
  const unitAmount = Math.round(input.amount * 100);
  if (!Number.isInteger(unitAmount) || unitAmount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  params.append('success_url', `${siteUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`);
  params.append('cancel_url', `${siteUrl}/payment-cancelled`);
  params.append('client_reference_id', String(input.orderId));
  params.append('line_items[0][price_data][currency]', input.currency.toLowerCase());
  params.append('line_items[0][price_data][product_data][name]', input.paymentCardTitle || input.courseTitle);
  params.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  params.append('line_items[0][quantity]', '1');
  appendParam(params, 'customer_email', input.studentEmail);
  params.append('metadata[orderId]', String(input.orderId));
  params.append('metadata[paymentOptionId]', String(input.paymentOptionId));
  params.append('metadata[zenlerCourseId]', input.zenlerCourseId);
  params.append('metadata[courseTitle]', input.courseTitle);
  appendParam(params, 'metadata[studentEmail]', input.studentEmail);

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  const body = await response.json() as { id?: string; url?: string | null; error?: { message?: string } };
  if (!response.ok || !body.id) {
    throw new Error(body.error?.message ?? `Stripe checkout failed (${response.status})`);
  }

  return { id: body.id, url: body.url ?? null };
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
