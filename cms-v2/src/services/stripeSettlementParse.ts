/** Read the fee, net, and payment method off an expanded Stripe PaymentIntent. */

import { majorAmountFromStripeMinor } from './stripeCheckout';

export interface StripeSettlement {
  fee: number;
  /** Null when the fee is in a different currency from the amount the student paid. */
  net: number | null;
  /** Settlement currency of the Stripe balance. This is not always the sale currency. */
  currency: string;
  paymentMethod: string | null;
}

/** Major-unit amount already stored on the order, used when Stripe's balance shows only a fee. */
export interface StoredCharge {
  amount: number;
  currency: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function moneyFromMinor(amountMinor: number, currency: string): number {
  return Math.round(majorAmountFromStripeMinor(Math.round(amountMinor), currency) * 100) / 100;
}

function paymentMethodLabel(details: Record<string, unknown> | null): string | null {
  const type = typeof details?.type === 'string' ? details.type : '';
  if (type === 'card') {
    const card = asRecord(details?.card);
    const brand = typeof card?.brand === 'string' ? card.brand.trim() : '';
    const pretty = brand ? brand.charAt(0).toUpperCase() + brand.slice(1) : 'Card';
    return `Card · ${pretty}`;
  }
  if (type === 'paypal') return 'PayPal';
  if (type === 'klarna') return 'Klarna';
  if (type === 'link') return 'Link';
  if (!type) return null;
  return type.replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
}

function readMinorAmount(source: Record<string, unknown> | null): { amountMinor: number; currency: string } | null {
  if (!source) return null;
  const currency = typeof source.currency === 'string' ? source.currency.trim().toUpperCase() : '';
  const amountMinor = Number(source.amount);
  if (!currency || !Number.isFinite(amountMinor)) return null;
  return { amountMinor, currency };
}

/**
 * Amounts the student paid, in major units. Stripe's charge comes first.
 * The stored order is the fallback when the PaymentIntent does not repeat it.
 */
function paidCandidates(
  paymentIntent: Record<string, unknown>,
  charge: Record<string, unknown> | null,
  stored: StoredCharge | null | undefined,
): Array<{ amount: number; currency: string }> {
  const candidates: Array<{ amount: number; currency: string }> = [];
  for (const source of [charge, paymentIntent]) {
    const minor = readMinorAmount(source);
    if (!minor || minor.amountMinor <= 0) continue;
    candidates.push({
      amount: moneyFromMinor(minor.amountMinor, minor.currency),
      currency: minor.currency,
    });
  }
  const storedCurrency = stored?.currency?.trim().toUpperCase() ?? '';
  if (stored && storedCurrency && Number.isFinite(stored.amount) && stored.amount > 0) {
    candidates.push({ amount: stored.amount, currency: storedCurrency });
  }
  return candidates;
}

export function parseStripeSettlement(
  body: unknown,
  storedCharge?: StoredCharge | null,
): StripeSettlement | null {
  const paymentIntent = asRecord(body);
  const charge = asRecord(paymentIntent?.latest_charge);
  const balance = asRecord(charge?.balance_transaction);
  if (!paymentIntent || !charge || !balance) return null;

  const currency = typeof balance.currency === 'string' ? balance.currency.trim().toUpperCase() : '';
  const amountMinor = Number(balance.amount);
  const feeMinor = Number(balance.fee);
  const netMinor = Number(balance.net);
  if (!currency || !Number.isFinite(amountMinor) || !Number.isFinite(feeMinor) || !Number.isFinite(netMinor)) {
    return null;
  }

  const gross = moneyFromMinor(amountMinor, currency);
  const fee = moneyFromMinor(feeMinor, currency);
  const reportedNet = moneyFromMinor(netMinor, currency);
  if (gross === 0 && fee === 0) return null;

  const paymentMethod = paymentMethodLabel(asRecord(charge.payment_method_details));
  // PayPal settled to PayPal posts a zero gross. The net is only Stripe's fee leaving the Stripe balance.
  if (gross === 0 && fee > 0) {
    const paid = paidCandidates(paymentIntent, charge, storedCharge)
      .find(candidate => candidate.currency === currency);
    const net = paid ? Math.round((paid.amount - fee) * 100) / 100 : null;
    return { fee, net, currency, paymentMethod };
  }

  return { fee, net: reportedNet, currency, paymentMethod };
}
