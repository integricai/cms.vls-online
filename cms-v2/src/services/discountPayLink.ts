import crypto from 'crypto';
import { presentCheckoutAmount } from './displayCurrency';
import { applyRetakeDiscount, type RetakeDiscountType } from './retakeDiscountMath';

export const DISCOUNT_LINK_DAYS = 14;

export type DiscountLinkStatus = 'invalid' | 'used' | 'expired' | 'valid';

export const DISCOUNT_LINK_MESSAGES: Record<Exclude<DiscountLinkStatus, 'valid'>, string> = {
  invalid: "This link isn't valid.",
  used: 'This offer has already been used.',
  expired: 'This offer has expired.',
};

/** Random URL token. Store only the hash. */
export function generateDiscountToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashDiscountToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function discountLinkExpiresAt(from = new Date()): Date {
  return new Date(from.getTime() + DISCOUNT_LINK_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Host of the emailed /pay link.
 * Staging is the default until the page is on the live site.
 * DISCOUNT_PAY_BASE_URL overrides it.
 */
export function discountPayBaseUrl(): string {
  const configured = process.env.DISCOUNT_PAY_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return 'https://staging.vls-online.com';
}

export function discountPayUrl(token: string): string {
  return `${discountPayBaseUrl()}/pay/${token}`;
}

export function discountLinkStatus(
  row: { used: boolean; expiresAt: string | null } | null,
  now = new Date(),
): DiscountLinkStatus {
  if (!row) return 'invalid';
  if (row.used) return 'used';
  if (!row.expiresAt) return 'expired';
  const expires = new Date(row.expiresAt);
  if (Number.isNaN(expires.getTime()) || expires.getTime() <= now.getTime()) return 'expired';
  return 'valid';
}

/** Catalogue price after the form discount. Null when the remainder is too small to charge. */
export function quoteDiscountedPrice(
  listAmount: number,
  type: RetakeDiscountType,
  value: number,
): number | null {
  return applyRetakeDiscount(listAmount, type, value);
}

/**
 * Lock the full price and the payable price in the student's currency.
 * Both use the same conversion as the course page. An unsupported currency stays in the catalogue currency.
 */
export function presentDiscountPrices(input: {
  fullAmount: number;
  finalAmount: number;
  currency: string;
  countryCode: string;
  rates: Record<string, number> | null;
}): { fullAmount: number; finalAmount: number; currency: string } {
  const full = presentCheckoutAmount({
    amount: input.fullAmount,
    currency: input.currency,
    countryCode: input.countryCode,
    rates: input.rates,
  });
  const payable = presentCheckoutAmount({
    amount: input.finalAmount,
    currency: input.currency,
    countryCode: input.countryCode,
    rates: input.rates,
  });
  if (full.currency !== payable.currency) {
    return {
      fullAmount: input.fullAmount,
      finalAmount: input.finalAmount,
      currency: (input.currency || 'USD').toUpperCase(),
    };
  }
  return { fullAmount: full.amount, finalAmount: payable.amount, currency: full.currency };
}

function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  if (!Number.isFinite(rounded) || rounded <= 0) return '0%';
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/** Percent from the form, or the equivalent percent when the discount was a fixed amount. */
export function discountOfferLabel(input: {
  discountType: RetakeDiscountType;
  discountValue: number;
  fullAmount: number;
  payableAmount: number;
}): string {
  if (input.discountType === 'percent') return formatPercent(input.discountValue);
  if (!(input.fullAmount > 0) || !(input.payableAmount >= 0) || input.payableAmount >= input.fullAmount) {
    return '0%';
  }
  return formatPercent(((input.fullAmount - input.payableAmount) / input.fullAmount) * 100);
}
