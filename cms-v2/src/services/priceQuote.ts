import crypto from 'crypto';
import { roundMoney } from './courseGeoPriceValidation';

/** How long the enrol button may reuse the price the course page showed. */
export const PRICE_QUOTE_TTL_MS = 3 * 60 * 60 * 1000;

export type PriceQuotePayload = {
  coursePriceId: number;
  /** Discounted catalogue amount, in US dollars. */
  amountUsd: number;
  /** Catalogue amount before the discount, in US dollars. */
  listAmountUsd: number;
  /** Amount the course page showed, in displayCurrency. */
  displayAmount: number;
  displayCurrency: string;
  exp: number;
};

function priceQuoteSecret(): string | null {
  const dedicated = String(process.env.PRICE_QUOTE_SECRET ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (dedicated) return dedicated;
  const proxy = String(process.env.VLS_PROXY_SECRET ?? '').trim().replace(/^['"]|['"]$/g, '');
  return proxy || null;
}

function signBody(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

/**
 * Binds the discounted dollar amount and the pound (or other local) amount
 * the course page showed. Checkout verifies this instead of asking Evendeals again.
 * Returns null when no signing secret is configured.
 */
export function signPriceQuote(
  input: Omit<PriceQuotePayload, 'exp'> & { exp?: number },
  now = Date.now(),
): string | null {
  const secret = priceQuoteSecret();
  if (!secret) return null;
  const payload: PriceQuotePayload = {
    coursePriceId: input.coursePriceId,
    amountUsd: roundMoney(input.amountUsd),
    listAmountUsd: roundMoney(input.listAmountUsd),
    displayAmount: roundMoney(input.displayAmount),
    displayCurrency: input.displayCurrency.toUpperCase(),
    exp: input.exp ?? now + PRICE_QUOTE_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signBody(body, secret)}`;
}

function isPayload(value: unknown): value is PriceQuotePayload {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<PriceQuotePayload>;
  return Number.isInteger(record.coursePriceId)
    && (record.coursePriceId ?? 0) > 0
    && typeof record.amountUsd === 'number'
    && Number.isFinite(record.amountUsd)
    && typeof record.listAmountUsd === 'number'
    && Number.isFinite(record.listAmountUsd)
    && typeof record.displayAmount === 'number'
    && Number.isFinite(record.displayAmount)
    && typeof record.displayCurrency === 'string'
    && /^[A-Z]{3}$/.test(record.displayCurrency)
    && typeof record.exp === 'number'
    && Number.isFinite(record.exp);
}

/** Null when the token is missing, altered, or expired. */
export function verifyPriceQuote(token: unknown, now = Date.now()): PriceQuotePayload | null {
  const secret = priceQuoteSecret();
  if (!secret || typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed || trimmed.length > 2000) return null;
  const separator = trimmed.lastIndexOf('.');
  if (separator <= 0) return null;
  const body = trimmed.slice(0, separator);
  const signature = trimmed.slice(separator + 1);
  const expected = signBody(body, secret);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!isPayload(parsed) || parsed.exp <= now) return null;
  return parsed;
}

/** The quote belongs to this catalogue row and does not exceed its list price. */
export function quoteMatchesCataloguePrice(
  quote: PriceQuotePayload,
  coursePriceId: number,
  listAmount: number,
): boolean {
  if (quote.coursePriceId !== coursePriceId) return false;
  if (!Number.isFinite(listAmount) || listAmount <= 0) return false;
  if (Math.abs(quote.listAmountUsd - roundMoney(listAmount)) > 0.009) return false;
  if (!(quote.amountUsd > 0) || quote.amountUsd > listAmount + 0.009) return false;
  if (!(quote.displayAmount > 0)) return false;
  if (quote.displayCurrency === 'USD' && Math.abs(quote.displayAmount - quote.amountUsd) > 0.009) {
    return false;
  }
  return true;
}
