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
  countryCode?: string | null;
  returnOrigin?: string | null;
  environment?: CheckoutEnvironment | null;
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
