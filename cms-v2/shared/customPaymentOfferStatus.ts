/** Stripe Checkout sessions last 24 hours when no expires_at is set. */
export const CUSTOM_PAYMENT_LINK_MS = 24 * 60 * 60 * 1000;

export type CustomPaymentOfferLinkStatus = 'Accepted' | 'Waiting' | 'Expired' | 'Failed' | 'Refunded';

export function customPaymentOfferLinkStatus(input: {
  orderStatus: string | null | undefined;
  checkoutIssuedAt: string | Date | null | undefined;
}, now = new Date()): CustomPaymentOfferLinkStatus {
  const status = String(input.orderStatus ?? 'Pending').trim();
  if (status === 'Paid') return 'Accepted';
  if (status === 'Refunded') return 'Refunded';
  if (status === 'Failed') return 'Failed';
  if (status === 'Cancelled') return 'Expired';

  const issued = input.checkoutIssuedAt ? new Date(input.checkoutIssuedAt) : null;
  if (!issued || Number.isNaN(issued.getTime())) return 'Expired';
  if (now.getTime() - issued.getTime() >= CUSTOM_PAYMENT_LINK_MS) return 'Expired';
  return 'Waiting';
}

/** A paid or refunded offer keeps its link. Every other state can be resent. */
export function customPaymentOfferCanResend(status: CustomPaymentOfferLinkStatus): boolean {
  return status !== 'Accepted' && status !== 'Refunded';
}
