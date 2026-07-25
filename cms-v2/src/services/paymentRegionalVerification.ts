import type { PaymentOrder } from '../models/paymentOrder';
import {
  markPaymentOrderCancelled,
  recordPaymentMethodCountry,
} from '../models/paymentOrder';
import {
  sendAdminRegionalMismatchNotification,
  sendRegionalPricingMismatchCancelled,
} from './paymentEmails';
import {
  cancelStripePaymentIntent,
  captureStripePaymentIntent,
  fetchCardIssuingCountry,
} from './stripeCheckout';

export type RegionalVerificationResult =
  | { allowed: true; paymentMethodCountry: string | null }
  | { allowed: false; cancelled: true; paymentMethodCountry: string | null };

export function resolveQuotedPricingRegion(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  return normalized && /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

/** Exact ISO country match between quoted checkout country and card issuing country. */
export function paymentCountriesMatchExact(
  quotedCountryCode: string | null | undefined,
  paymentCountryCode: string | null | undefined,
): boolean {
  const quoted = resolveQuotedPricingRegion(quotedCountryCode);
  const payment = resolveQuotedPricingRegion(paymentCountryCode);
  if (!quoted || !payment) return false;
  return quoted === payment;
}

/** Whether checkout used ParityDeals regional pricing that must match the card country. */
export function shouldVerifyRegionalPricing(order: PaymentOrder): boolean {
  return order.regionalPricingApplied === true;
}

export function shouldApplyRegionalPricingAtCheckout(input: {
  geoPricingApplied?: boolean;
}): boolean {
  return input.geoPricingApplied === true;
}

/**
 * For regional discounts: authorize was manual — verify exact card country, then capture or cancel.
 * Cancel voids the hold (not a refund).
 */
export async function verifyRegionalPaymentMethod(
  order: PaymentOrder,
  paymentIntentId: string | null,
): Promise<RegionalVerificationResult> {
  if (!shouldVerifyRegionalPricing(order)) {
    return { allowed: true, paymentMethodCountry: null };
  }

  if (!paymentIntentId) {
    console.warn('[regional-pricing] Missing payment intent for regional order', order.id);
    return { allowed: false, cancelled: true, paymentMethodCountry: null };
  }

  const paymentMethodCountry = await fetchCardIssuingCountry(paymentIntentId);
  await recordPaymentMethodCountry(order.id, paymentMethodCountry);

  if (!paymentMethodCountry || !paymentCountriesMatchExact(order.countryCode, paymentMethodCountry)) {
    await cancelStripePaymentIntent(paymentIntentId);
    const cancelledOrder = await markPaymentOrderCancelled({
      orderId: order.id,
      paymentMethodCountry,
      zenlerEnrollmentStatus: 'blocked_regional_mismatch',
      stripePaymentIntentId: paymentIntentId,
    });

    const studentSent = await sendRegionalPricingMismatchCancelled(
      cancelledOrder,
      paymentMethodCountry ?? 'unknown',
    );
    const adminSent = await sendAdminRegionalMismatchNotification(
      cancelledOrder,
      paymentMethodCountry ?? 'unknown',
    );
    if (!studentSent) {
      console.warn('[regional-pricing] Could not send student cancel email for order', order.id);
    }
    if (!adminSent) {
      console.warn('[regional-pricing] Could not send admin mismatch email for order', order.id);
    }

    return { allowed: false, cancelled: true, paymentMethodCountry };
  }

  await captureStripePaymentIntent(paymentIntentId);
  return { allowed: true, paymentMethodCountry };
}
