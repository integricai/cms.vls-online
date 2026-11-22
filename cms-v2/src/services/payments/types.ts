import type { CheckoutEnvironment } from '../../../shared/types';

export const PAYMENT_PROVIDER_IDS = ['stripe', 'paypal'] as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export interface CreateCheckoutInput {
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
  /** Name from the website popup. Saved on the Stripe customer; Stripe can't show it on the payment page. */
  studentName?: string | null;
  countryCode?: string | null;
  returnOrigin?: string | null;
  /** Same-site path opened when the student leaves Checkout. */
  cancelPath?: string | null;
  environment?: CheckoutEnvironment | null;
  /** Local amount the course page showed. Stored on the order. Stripe is charged in USD. */
  localPresentment?: { amount: number; currency: string } | null;
  /** Website enrol checkouts close after 2-3 hours. Emailed links keep Stripe's 24 hours. */
  closeUnpaidSoon?: boolean;
  /** Second Stripe line. The course line stays input.amount. */
  extraLineItem?: { name: string; amount: number } | null;
  /** Further Stripe lines for checkout C books and upsell courses. */
  extraLineItems?: Array<{ name: string; amount: number; image?: boolean }> | null;
  /** Ask Stripe for a shipping address. Used when the book is posted. */
  collectShipping?: boolean;
  bookId?: number | null;
  bookIds?: number[] | null;
}

export interface CheckoutSessionResult {
  provider: PaymentProviderId;
  checkoutId: string;
  checkoutUrl: string;
}

export interface RefundInput {
  paymentId: string;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  environment?: CheckoutEnvironment | null;
}

export interface RefundResult {
  refundId: string;
  paymentId: string | null;
  status: string;
}

export interface CheckoutCompletedEvent {
  type: 'checkout.completed';
  provider: PaymentProviderId;
  orderId: number | null;
  checkoutId: string | null;
  paymentId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  amountMinor: number | null;
  currency: string | null;
  /** What the student actually paid when they chose a local price. */
  presentmentAmountMinor?: number | null;
  presentmentCurrency?: string | null;
}

export interface RefundCompletedEvent {
  type: 'refund.completed';
  provider: PaymentProviderId;
  paymentId: string | null;
  refundId: string | null;
  checkoutId?: string | null;
}

/** Async payment failed, or the Checkout Session expired before payment. */
export interface CheckoutClosedEvent {
  type: 'checkout.closed';
  provider: PaymentProviderId;
  orderId: number | null;
  checkoutId: string | null;
  paymentId: string | null;
  status: 'Failed' | 'Cancelled';
  /** Email typed on the payment page before it closed, if any. */
  customerEmail?: string | null;
  /** Name typed on the payment page before it closed, if any. */
  customerName?: string | null;
}

export interface IgnoredWebhookEvent {
  type: 'ignored';
  provider: PaymentProviderId;
  reason?: string;
}

export type ProviderWebhookEvent =
  | CheckoutCompletedEvent
  | CheckoutClosedEvent
  | RefundCompletedEvent
  | IgnoredWebhookEvent;

export interface CaptureCheckoutResult {
  completed: boolean;
  checkoutId: string;
  paymentId: string | null;
  customerEmail: string | null;
  customerName: string | null;
  amountMinor: number | null;
  currency: string | null;
}

export interface IPaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(input: CreateCheckoutInput): Promise<CheckoutSessionResult>;
  refund(input: RefundInput): Promise<RefundResult>;
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | undefined>,
  ): Promise<ProviderWebhookEvent>;
  captureCheckout?(checkoutId: string): Promise<CaptureCheckoutResult>;
  dashboardPaymentUrl(paymentId: string): string;
}

export function isPaymentProviderId(value: unknown): value is PaymentProviderId {
  return value === 'stripe' || value === 'paypal';
}

export function parsePaymentProviderId(value: unknown): PaymentProviderId {
  const text = String(value ?? '').trim().toLowerCase();
  if (!text || text === 'stripe') return 'stripe';
  if (text === 'paypal') return 'paypal';
  throw new Error(`Unsupported payment provider: ${text}`);
}

export function customerSourceForProvider(provider: PaymentProviderId): 'stripe' | 'paypal' {
  return provider === 'paypal' ? 'paypal' : 'stripe';
}
