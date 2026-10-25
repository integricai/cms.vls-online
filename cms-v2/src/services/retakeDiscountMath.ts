import { roundMoney } from './courseGeoPriceValidation';

export type RetakeDiscountType = 'percent' | 'fixed';

/** Stripe rejects a zero charge. Keep a small payable remainder. */
export const MIN_RETAKE_CHARGE = 0.5;

/** A discount code applies on staging checkout only. Production keeps the normal price. */
export function retakeCodeForCheckout(environment: string | null | undefined, code: unknown): string {
  if (environment !== 'staging') return '';
  return String(code ?? '').trim();
}

export function normalizeRetakeCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function retakeEmailsMatch(issued: string, checkout: string): boolean {
  return issued.trim().toLowerCase() === checkout.trim().toLowerCase();
}

/**
 * Discount the catalogue price. A percent or fixed amount that leaves less
 * than the minimum charge is rejected so checkout cannot open a free session.
 */
export function applyRetakeDiscount(
  listAmount: number,
  type: RetakeDiscountType,
  value: number,
): number | null {
  if (!Number.isFinite(listAmount) || listAmount <= 0) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  if (type === 'percent') {
    if (value >= 100) return null;
    const charge = roundMoney(listAmount * (1 - value / 100));
    return charge >= MIN_RETAKE_CHARGE ? charge : null;
  }
  const charge = roundMoney(listAmount - value);
  return charge >= MIN_RETAKE_CHARGE ? charge : null;
}

export function parseRetakeDiscount(input: {
  discountType: unknown;
  discountValue: unknown;
}): { type: RetakeDiscountType; value: number } | { error: string } {
  const type = String(input.discountType ?? '').trim().toLowerCase();
  if (type !== 'percent' && type !== 'fixed') {
    return { error: 'Choose a percent or a fixed amount.' };
  }
  const value = typeof input.discountValue === 'number'
    ? input.discountValue
    : Number(String(input.discountValue ?? '').trim());
  if (!Number.isFinite(value) || value <= 0) {
    return { error: 'Enter a discount greater than zero.' };
  }
  const rounded = roundMoney(value);
  if (type === 'percent' && rounded >= 100) {
    return { error: 'A percent discount must be below 100 so a payment can still be taken.' };
  }
  return { type, value: rounded };
}
