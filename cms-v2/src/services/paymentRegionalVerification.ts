import type { PaymentOrder } from '../models/paymentOrder';
import {
  markPaymentOrderRefunded,
  recordPaymentMethodCountry,
} from '../models/paymentOrder';
import {
  sendAdminRegionalMismatchNotification,
  sendRegionalPricingMismatchRefund,
} from './paymentEmails';
import {
  isDiscountedPricingRegion,
  pricingRegionsMatch,
  resolvePricingRegion,
  type PricingRegion,
} from './pricingRegions';
import { createStripeRefund, fetchPaymentMethodCountry } from './stripeCheckout';

export type RegionalVerificationResult =
  | { allowed: true; paymentMethodCountry: string | null }
  | { allowed: false; refunded: true; paymentMethodCountry: string };

export function resolveQuotedPricingRegion(countryCode: string | null | undefined): PricingRegion {
  return resolvePricingRegion(countryCode);
}

/** Whether checkout used a discounted regional tier that must match the payment method. */
export function shouldVerifyRegionalPricing(order: PaymentOrder): boolean {
  if (!order.countryCode) return false;
  if (order.regionalPricingApplied) return true;
  return isDiscountedPricingRegion(resolvePricingRegion(order.countryCode));
}

export function shouldApplyRegionalPricingAtCheckout(input: {
  countryCode: string | null;
  regionalPricingApplied?: boolean;
  listAmount?: number;
  effectiveAmount?: number;
}): boolean {
  if (input.regionalPricingApplied === true) return true;
  if (
    input.listAmount != null
    && input.effectiveAmount != null
    && input.effectiveAmount < input.listAmount
    && isDiscountedPricingRegion(resolvePricingRegion(input.countryCode))
  ) {
    return true;
  }
  return isDiscountedPricingRegion(resolvePricingRegion(input.countryCode));
}

/**
 * Compare quoted checkout region to payment-method country.
 * On mismatch: refund via Stripe, block enrollment, notify student and admin.
 */
export async function verifyRegionalPaymentMethod(
  order: PaymentOrder,
  paymentIntentId: string | null,
): Promise<RegionalVerificationResult> {
  if (!shouldVerifyRegionalPricing(order)) {
    return { allowed: true, paymentMethodCountry: null };
  }

  if (!paymentIntentId) {
    console.warn('[regional-pricing] Missing payment intent; skipping verification for order', order.id);
    return { allowed: true, paymentMethodCountry: null };
  }

  const paymentMethodCountry = await fetchPaymentMethodCountry(paymentIntentId);
  await recordPaymentMethodCountry(order.id, paymentMethodCountry);

  if (!paymentMethodCountry) {
    console.warn('[regional-pricing] Payment method country unavailable for order', order.id);
    return { allowed: true, paymentMethodCountry: null };
  }

  if (pricingRegionsMatch(order.countryCode, paymentMethodCountry)) {
    return { allowed: true, paymentMethodCountry };
  }

  const refund = await createStripeRefund(paymentIntentId);
  const refundedOrder = await markPaymentOrderRefunded({
    orderId: order.id,
    stripeRefundId: refund.id,
    paymentMethodCountry,
    zenlerEnrollmentStatus: 'blocked_regional_mismatch',
  });

  const studentSent = await sendRegionalPricingMismatchRefund(refundedOrder, paymentMethodCountry);
  const adminSent = await sendAdminRegionalMismatchNotification(refundedOrder, paymentMethodCountry);
  if (!studentSent) {
    console.warn('[regional-pricing] Could not send student refund email for order', order.id);
  }
  if (!adminSent) {
    console.warn('[regional-pricing] Could not send admin mismatch email for order', order.id);
  }

  return { allowed: false, refunded: true, paymentMethodCountry };
}