/**
 * Maps ISO country codes to PPP pricing regions.
 * Used to verify that the payment method country matches the region quoted at checkout.
 */

export type PricingRegion =
  | 'EUROPE'
  | 'US'
  | 'SOUTH_ASIA'
  | 'GCC'
  | 'DEFAULT';

const COUNTRY_TO_REGION: Record<string, PricingRegion> = {
  // UK — grouped with Europe for pricing-tier matching
  GB: 'EUROPE',
  UK: 'EUROPE',

  // Europe
  AT: 'EUROPE', BE: 'EUROPE', BG: 'EUROPE', CH: 'EUROPE', CY: 'EUROPE', CZ: 'EUROPE',
  DE: 'EUROPE', DK: 'EUROPE', EE: 'EUROPE', ES: 'EUROPE', FI: 'EUROPE', FR: 'EUROPE',
  GR: 'EUROPE', HR: 'EUROPE', HU: 'EUROPE', IE: 'EUROPE', IS: 'EUROPE', IT: 'EUROPE',
  LI: 'EUROPE', LT: 'EUROPE', LU: 'EUROPE', LV: 'EUROPE', MT: 'EUROPE', NL: 'EUROPE',
  NO: 'EUROPE', PL: 'EUROPE', PT: 'EUROPE', RO: 'EUROPE', SE: 'EUROPE', SI: 'EUROPE',
  SK: 'EUROPE',

  // North America (base tier)
  US: 'US',
  CA: 'US',

  // South Asia (PPP discount tier)
  IN: 'SOUTH_ASIA',
  PK: 'SOUTH_ASIA',
  BD: 'SOUTH_ASIA',
  LK: 'SOUTH_ASIA',
  NP: 'SOUTH_ASIA',
  BT: 'SOUTH_ASIA',
  MV: 'SOUTH_ASIA',

  // Gulf
  AE: 'GCC',
  SA: 'GCC',
  QA: 'GCC',
  KW: 'GCC',
  BH: 'GCC',
  OM: 'GCC',
};

export function resolvePricingRegion(countryCode: string | null | undefined): PricingRegion {
  if (!countryCode) return 'DEFAULT';
  const normalized = countryCode.trim().toUpperCase();
  if (!normalized) return 'DEFAULT';
  return COUNTRY_TO_REGION[normalized] ?? 'DEFAULT';
}

/** True when quoted and payment countries belong to the same pricing tier. */
export function pricingRegionsMatch(
  quotedCountryCode: string | null | undefined,
  paymentCountryCode: string | null | undefined,
): boolean {
  const quoted = resolvePricingRegion(quotedCountryCode);
  const payment = resolvePricingRegion(paymentCountryCode);
  return quoted === payment;
}

export function pricingRegionLabel(region: PricingRegion): string {
  switch (region) {
    case 'EUROPE': return 'Europe';
    case 'US': return 'North America';
    case 'SOUTH_ASIA': return 'South Asia';
    case 'GCC': return 'Gulf region';
    default: return 'standard';
  }
}

/** Regions that receive PPP / regional discounts and require payment-method verification. */
export function isDiscountedPricingRegion(region: PricingRegion): boolean {
  return region === 'SOUTH_ASIA' || region === 'GCC';
}

export function countryDisplayName(countryCode: string | null | undefined): string {
  if (!countryCode) return 'unknown';
  try {
    const name = new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode.toUpperCase());
    return name ?? countryCode.toUpperCase();
  } catch {
    return countryCode.toUpperCase();
  }
}
