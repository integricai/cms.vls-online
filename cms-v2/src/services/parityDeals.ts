import { fetchWithTimeout } from '../utils/fetchWithTimeout';
import { roundMoney } from './courseGeoPriceValidation';

export type ParityDealsQuote = {
  discountPercentage: number;
  countryCode: string | null;
  currencyCode: string | null;
  isVpn: boolean;
  isProxy: boolean;
  isTor: boolean;
  couponCode: string | null;
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
  parityDealsCouponCode: string | null;
};

function pdIdentifier(): string | null {
  const id = process.env.PARITYDEALS_PD_IDENTIFIER?.trim();
  return id || null;
}

function parsePercent(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, n);
}

function normalizeCountry(value: unknown): string | null {
  const code = String(value ?? '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? code : null;
}

function parseQuoteBody(body: Record<string, unknown>): ParityDealsQuote {
  return {
    discountPercentage: parsePercent(body.discountPercentage),
    countryCode: normalizeCountry(body.countryCode),
    currencyCode: body.currencyCode != null ? String(body.currencyCode) : null,
    isVpn: body.isVpn === true,
    isProxy: body.isProxy === true,
    isTor: body.isTor === true,
    couponCode: body.couponCode != null ? String(body.couponCode) : null,
    raw: body,
  };
}

/**
 * Server-side ParityDeals discount lookup by visitor IP.
 * Requires PARITYDEALS_PD_IDENTIFIER and the visitor IP.
 */
export async function fetchParityDealsQuote(ipAddress: string | null | undefined): Promise<ParityDealsQuote | null> {
  const identifier = pdIdentifier();
  const ip = String(ipAddress ?? '').trim();
  if (!identifier || !ip) return null;

  const url = new URL('https://api.paritydeals.com/api/v1/deals/discount/');
  url.searchParams.set('pd_identifier', identifier);
  url.searchParams.set('ip_address', ip);

  try {
    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: 8_000,
    });
    if (!response.ok) {
      console.warn('[paritydeals] Discount API failed', response.status);
      return null;
    }
    const body = await response.json() as Record<string, unknown>;
    return parseQuoteBody(body);
  } catch (err) {
    console.warn('[paritydeals] Discount API error', err);
    return null;
  }
}

/**
 * Country-based discount lookup (optional staging fallback).
 * Skipped unless PARITYDEALS_API_KEY is set — primary path is the IP API (no key).
 */
export async function fetchParityDealsQuoteByCountry(
  countryCode: string | null | undefined,
): Promise<ParityDealsQuote | null> {
  const identifier = pdIdentifier();
  const country = normalizeCountry(countryCode);
  const apiKey = process.env.PARITYDEALS_API_KEY?.trim();
  if (!identifier || !country || !apiKey) return null;

  const url = new URL('https://api.paritydeals.com/api/v1/deals/country/discount/');
  url.searchParams.set('pd_identifier', identifier);
  url.searchParams.set('country_code', country);

  try {
    const response = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      timeoutMs: 8_000,
    });
    if (!response.ok) {
      console.warn('[paritydeals] Country discount API failed', response.status);
      return null;
    }
    const body = await response.json() as Record<string, unknown>;
    const quote = parseQuoteBody(body);
    return {
      ...quote,
      countryCode: quote.countryCode ?? country,
      // Country API is explicit — do not treat as VPN-blocked.
      isVpn: false,
      isProxy: false,
      isTor: false,
    };
  } catch (err) {
    console.warn('[paritydeals] Country discount API error', err);
    return null;
  }
}

function applyQuote(
  campaignAmount: number,
  quote: ParityDealsQuote,
  fallbackCountry: string | null,
  ignoreVpnBlock: boolean,
): RegionalPricingApplyResult {
  const blocked = !ignoreVpnBlock && (quote.isVpn || quote.isProxy || quote.isTor);
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
      parityDealsCouponCode: null,
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
    parityDealsCouponCode: quote.couponCode,
  };
}

/**
 * Apply ParityDeals localized discount on top of the CMS campaign/base amount.
 * VPN/proxy/Tor visitors get no regional discount unless ignoreVpnBlock (staging test only).
 *
 * No PARITYDEALS_API_KEY required for the IP discount API (pd_identifier only).
 * Country API is an optional fallback (uses API key only when configured).
 */
export async function applyParityDealsPricing(input: {
  campaignAmount: number;
  ipAddress?: string | null;
  fallbackCountryCode?: string | null;
  /** Staging ?test=true only — trust Cloudflare country and ignore VPN flags. */
  ignoreVpnBlock?: boolean;
}): Promise<RegionalPricingApplyResult> {
  const campaignAmount = input.campaignAmount;
  const fallbackCountry = normalizeCountry(input.fallbackCountryCode);
  const ignoreVpnBlock = input.ignoreVpnBlock === true;

  // Primary path: IP discount API — works with pd_identifier only (no API key).
  // In staging test mode, VPN/proxy flags are ignored so PK VPN still gets the %.
  const quote = await fetchParityDealsQuote(input.ipAddress);
  if (quote && quote.discountPercentage > 0) {
    return applyQuote(campaignAmount, quote, fallbackCountry, ignoreVpnBlock);
  }

  // Optional fallback for staging test when IP lookup fails: country discount API.
  if (ignoreVpnBlock && fallbackCountry) {
    const byCountry = await fetchParityDealsQuoteByCountry(fallbackCountry);
    if (byCountry && byCountry.discountPercentage > 0) {
      return applyQuote(campaignAmount, byCountry, fallbackCountry, true);
    }
  }

  return {
    effectiveAmount: campaignAmount,
    regionalPricingApplied: false,
    geoPricingApplied: false,
    geoRegionCode: null,
    geoDiscountPercent: null,
    quotedCountryCode: fallbackCountry,
    parityDealsCouponCode: null,
  };
}
