import type { PaymentOrder } from '../models/paymentOrder';
import {
  markPaymentOrderRefunded,
  recordPaymentMethodCountry,
} from '../models/paymentOrder';
import {
  sendAdminRegionalMismatchNotification,
  sendRegionalPricingMismatchRefund,
} from './paymentEmails';
import { geoPricingRegionsMatch, resolveGeoRegionCode } from './geoPricing';
import { createStripeRefund, fetchPaymentMethodCountry } from './stripeCheckout';

export type RegionalVerificationResult =
  | { allowed: true; paymentMethodCountry: string | null }
  | { allowed: false; refunded: true; paymentMethodCountry: string };

export function resolveQuotedPricingRegion(countryCode: string | null | undefined): string | null {
  return resolveGeoRegionCode(countryCode);
}

/** Whether checkout used geo regional pricing that must match the payment method country. */
export function shouldVerifyRegionalPricing(order: PaymentOrder): boolean {
  return order.regionalPricingApplied === true;
}

export function shouldApplyRegionalPricingAtCheckout(input: {
  geoPricingApplied?: boolean;
}): boolean {
  return input.geoPricingApplied === true;
}

/**
 * Compare quoted checkout geo region to payment-method country.
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

  if (geoPricingRegionsMatch(order.countryCode, paymentMethodCountry)) {
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
