import type { BookRecord } from '../../shared/types';
import { resolveCheckoutEnvironment } from './attribution';
import { resolveCheckoutReturnUrl } from './checkoutSiteUrl';
import {
  appendStripeAdaptivePricing,
  appendStripeBranding,
  appendStripeOrderSummaryImage,
  STRIPE_RETURNING_STUDENT_MESSAGE,
  stripePaymentMethodTypes,
  stripeSecretKeyForEnvironment,
  stripeUnitAmount,
} from './stripeCheckout';
import { fetchWithTimeout } from '../utils/fetchWithTimeout';

/** The amount Stripe should charge: the discounted price when one is set, otherwise the list price. */
export function bookChargeAmount(book: Pick<BookRecord, 'price' | 'discountedPrice'>): number | null {
  const amount = book.discountedPrice != null ? Number(book.discountedPrice) : Number(book.price);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

export function withBookCheckoutResult(raw: string, result: 'success' | 'cancelled'): string {
  const url = new URL(raw);
  url.searchParams.set('book_checkout', result);
  return url.toString();
}

export async function createBookCheckoutUrl(
  bookId: number,
  input: { returnTo?: string; origin?: string | null; referer?: string | null },
): Promise<string | null> {
  const { getBook } = await import('../models/book');
  const book = await getBook(bookId);
  if (!book || !book.isActive) return null;
  const amount = bookChargeAmount(book);
  if (amount == null) return null;

  const returnUrl = resolveCheckoutReturnUrl(input.returnTo);
  const environment = resolveCheckoutEnvironment({
    origin: input.origin,
    referer: input.referer ?? input.returnTo,
  });
  const secretKey = stripeSecretKeyForEnvironment(environment);
  const currency = (book.currency || 'GBP').trim().toUpperCase() || 'GBP';
  const { attachCheckoutSession, createPaymentOrder } = await import('../models/paymentOrder');
  const order = await createPaymentOrder({
    courseId: null,
    zenlerCourseId: '',
    courseTitle: book.title.slice(0, 250),
    optionType: 'BPP Book',
    studentName: null,
    studentEmail: null,
    amount,
    currency,
    environment,
    provider: 'stripe',
  });

  const params = new URLSearchParams();
  params.append('mode', 'payment');
  for (const method of stripePaymentMethodTypes(true, currency)) {
    params.append('payment_method_types[]', method);
  }
  params.append('success_url', withBookCheckoutResult(returnUrl, 'success'));
  params.append('cancel_url', withBookCheckoutResult(returnUrl, 'cancelled'));
  params.append('custom_text[submit][message]', STRIPE_RETURNING_STUDENT_MESSAGE);
  params.append('billing_address_collection', 'required');
  appendStripeBranding(params);
  params.append('line_items[0][price_data][currency]', currency.toLowerCase());
  params.append('line_items[0][price_data][product_data][name]', book.title.slice(0, 250));
  appendStripeOrderSummaryImage(params);
  params.append('line_items[0][price_data][unit_amount]', String(stripeUnitAmount(amount, currency)));
  appendStripeAdaptivePricing(params);
  params.append('line_items[0][quantity]', '1');
  params.append('client_reference_id', String(order.id));
  params.append('metadata[orderId]', String(order.id));
  params.append('metadata[flow]', 'book');
  params.append('metadata[bookId]', String(book.id));
  params.append('metadata[bookTitle]', book.title.slice(0, 450));

  const response = await fetchWithTimeout('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `book-checkout-${order.id}`,
    },
    body: params,
    timeoutMs: 20_000,
  });

  const body = await response.json() as { id?: string; url?: string | null; error?: { message?: string } };
  if (!response.ok || !body.id || !body.url) {
    throw new Error(body.error?.message ?? `Stripe checkout failed (${response.status})`);
  }
  await attachCheckoutSession(order.id, { provider: 'stripe', checkoutId: body.id });
  return body.url;
}
