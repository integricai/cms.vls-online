import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { roundMoney } from './courseGeoPriceValidation';

export type EvenDealsQuote = {
  discountPercentage: number;
  countryCode: string | null;
  couponCode: string | null;
  isVpn: boolean;
  blockVpn: boolean;
  raw: Record<string, unknown> | null;
};

export type RegionalPricingApplyResult = {
  effectiveAmount: number;
  regionalPricingApplied: boolean;
  /** Kept for API compatibility with existing publish/checkout payloads. */
  geoPricingApplied: boolean;
  geoRegionCode: string | null;
  geoDiscountPercent: number | null;
  quotedCountryCode: string | null;
  evenDealsCouponCode: string | null;
  /** The discount service did not answer. Callers must not invent a full-price charge. */
  lookupFailed: boolean;
};

export class EvenDealsUnavailableError extends Error {
  constructor(message = 'Evendeals discount lookup failed') {
    super(message);
    this.name = 'EvenDealsUnavailableError';
  }
}

function envTrim(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function apiKey(): string | null {
  const key = envTrim(process.env.EVENDEALS_API_KEY);
  return key || null;
}

function defaultProductId(): string | null {
  const id = envTrim(process.env.EVENDEALS_PRODUCT_ID);
  return id || null;
}

/** Prefer per-price product id; fall back to EVENDEALS_PRODUCT_ID. */
export function resolveEvenDealsProductId(productId?: string | null): string | null {
  const override = String(productId ?? '').trim();
  if (override) return override;
  return defaultProductId();
}

function normalizeCountry(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

/** Evendeals returns discountAmount as "30", "30%", or similar. */
function parseDiscountPercent(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.min(100, value);
  }
  const raw = String(value ?? '').trim();
  if (!raw) return 0;
  const n = Number.parseFloat(raw.replace(/%/g, ''));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

function parseQuoteBody(body: Record<string, unknown>): EvenDealsQuote | null {
  const discount = body.discount;
  if (!discount || typeof discount !== 'object') return null;
  const d = discount as Record<string, unknown>;
  const percent = parseDiscountPercent(d.discountAmount ?? d.discountPercentage);
  if (percent <= 0) return null;

  const settings = body.settings && typeof body.settings === 'object'
    ? body.settings as Record<string, unknown>
    : null;

  return {
    discountPercentage: percent,
    countryCode: normalizeCountry(d.countryCode),
    couponCode: d.couponCode != null ? String(d.couponCode) : null,
    isVpn: body.isVpn === true,
    blockVpn: settings?.blockVpn === true,
    raw: body,
  };
}

/**
 * Server-side Evendeals discount lookup by visitor IP.
 * Requires EVENDEALS_API_KEY and a product id (per-price or EVENDEALS_PRODUCT_ID).
 * Throws when the service does not answer. A 204 or a zero discount returns null.
 */
async function requestEvenDealsQuote(
  ipAddress: string | null | undefined,
  productId?: string | null,
): Promise<EvenDealsQuote | null> {
  const key = apiKey();
  const product = resolveEvenDealsProductId(productId);
  const ip = String(ipAddress ?? '').trim();
  if (!key || !product || !ip) return null;

  const url = new URL('https://www.evendeals.com/api/discount');
  url.searchParams.set('ip', ip);
  url.searchParams.set('productId', product);

  let response: Awaited<ReturnType<typeof fetchWithTimeout>>;
  try {
    response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': key,
      },
      timeoutMs: 8_000,
    });
  } catch (err) {
    console.warn('[evendeals] Discount API error', err);
    throw new EvenDealsUnavailableError();
  }

  if (response.status === 204) return null;
  if (!response.ok) {
    console.warn('[evendeals] Discount API failed', response.status);
    throw new EvenDealsUnavailableError(`Evendeals discount lookup failed (${response.status})`);
  }

  const body = await response.json() as Record<string, unknown>;
  return parseQuoteBody(body);
}

/** Course-page lookup. A failed request shows the list price so the page still loads. */
export async function fetchEvenDealsQuote(
  ipAddress: string | null | undefined,
  productId?: string | null,
): Promise<EvenDealsQuote | null> {
  try {
    return await requestEvenDealsQuote(ipAddress, productId);
  } catch (err) {
    if (err instanceof EvenDealsUnavailableError) return null;
    throw err;
  }
}

export function applyEvenDealsQuote(
  campaignAmount: number,
  quote: EvenDealsQuote,
  fallbackCountry: string | null,
  ignoreVpnBlock: boolean,
): RegionalPricingApplyResult {
  const blocked = !ignoreVpnBlock && quote.isVpn && quote.blockVpn;
  const quotedCountryCode = ignoreVpnBlock
    ? (fallbackCountry ?? quote.countryCode)
    : (quote.countryCode ?? fallbackCountry);

  if (blocked || quote.discountPercentage <= 0) {
    return {
      effectiveAmount: campaignAmount,
      regionalPricingApplied: false,
      geoPricingApplied: false,
      geoRegionCode: null,
      geoDiscountPercent: null,
      quotedCountryCode,
      evenDealsCouponCode: null,
      lookupFailed: false,
    };
  }

  const discounted = roundMoney(campaignAmount * (1 - quote.discountPercentage / 100));
  const effectiveAmount = Math.max(0.5, Math.min(campaignAmount, discounted));

  return {
    effectiveAmount,
    regionalPricingApplied: effectiveAmount < campaignAmount,
    geoPricingApplied: effectiveAmount < campaignAmount,
    geoRegionCode: quotedCountryCode,
    geoDiscountPercent: quote.discountPercentage,
    quotedCountryCode,
    evenDealsCouponCode: quote.couponCode,
    lookupFailed: false,
  };
}

/**
 * Apply Evendeals localized discount on top of the CMS campaign/base amount.
 * VPN visitors get no regional discount unless ignoreVpnBlock (staging ?test=true).
 */
export async function applyEvenDealsPricing(input: {
  campaignAmount: number;
  ipAddress?: string | null;
  fallbackCountryCode?: string | null;
  /** Per-price Evendeals product id; falls back to EVENDEALS_PRODUCT_ID. */
  productId?: string | null;
  /** Staging ?test=true only — trust Cloudflare country and ignore VPN flags. */
  ignoreVpnBlock?: boolean;
}): Promise<RegionalPricingApplyResult> {
  const campaignAmount = input.campaignAmount;
  const fallbackCountry = normalizeCountry(input.fallbackCountryCode);
  const ignoreVpnBlock = input.ignoreVpnBlock === true;

  let quote: EvenDealsQuote | null = null;
  try {
    quote = await requestEvenDealsQuote(input.ipAddress, input.productId);
  } catch (err) {
    if (err instanceof EvenDealsUnavailableError) {
      return {
        effectiveAmount: campaignAmount,
        regionalPricingApplied: false,
        geoPricingApplied: false,
        geoRegionCode: null,
        geoDiscountPercent: null,
        quotedCountryCode: fallbackCountry,
        evenDealsCouponCode: null,
        lookupFailed: true,
      };
    }
    throw err;
  }
  if (quote && quote.discountPercentage > 0) {
    return applyEvenDealsQuote(campaignAmount, quote, fallbackCountry, ignoreVpnBlock);
  }

  return {
    effectiveAmount: campaignAmount,
    regionalPricingApplied: false,
    geoPricingApplied: false,
    geoRegionCode: null,
    geoDiscountPercent: null,
    quotedCountryCode: fallbackCountry,
    evenDealsCouponCode: null,
    lookupFailed: false,
  };
}

/** @deprecated Use applyEvenDealsPricing — kept for call-site compatibility. */
export const applyParityDealsPricing = applyEvenDealsPricing;
