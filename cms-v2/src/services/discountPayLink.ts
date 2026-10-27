import crypto from 'crypto';
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
