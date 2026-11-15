import type { BookRecord } from '../../shared/types';
import { resolveCheckoutEnvironment } from './attribution';
import { resolveCheckoutReturnUrl } from './checkoutSiteUrl';
import { createStripeCheckoutSession, safeCheckoutCancelPath } from './stripeCheckout';

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

function bookCancelPath(returnUrl: string): string {
  const url = new URL(returnUrl);
  return safeCheckoutCancelPath(`${url.pathname}${url.search}`);
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
  const currency = (book.currency || 'USD').trim().toUpperCase() || 'USD';
  const title = book.title.slice(0, 250);
  const { attachCheckoutSession, createPaymentOrder } = await import('../models/paymentOrder');
  const order = await createPaymentOrder({
    courseId: null,
    zenlerCourseId: '',
    courseTitle: title,
    optionType: 'BPP Book',
    studentName: null,
    studentEmail: null,
    amount,
    currency,
    environment,
    provider: 'stripe',
  });

  const session = await createStripeCheckoutSession({
    orderId: order.id,
    courseId: null,
    zenlerCourseId: '',
    courseTitle: title,
    paymentCardTitle: title,
    amount,
    currency,
    studentEmail: null,
    returnOrigin: returnUrl,
    cancelPath: bookCancelPath(returnUrl),
    environment,
  });
  if (!session.url) {
    throw new Error('Stripe did not return a checkout URL');
  }
  await attachCheckoutSession(order.id, { provider: 'stripe', checkoutId: session.id });
  return session.url;
}
