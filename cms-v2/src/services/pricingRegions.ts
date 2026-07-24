import {
  geoPricingRegionsMatch,
  pricingRegionLabel as geoPricingRegionLabel,
  resolveGeoRegionCode,
} from './geoPricing';

export {
  applyGeoPricing,
  countryDisplayName,
  geoPricingRegionsMatch,
  getGeoPricingRegions,
  refreshGeoPricingCache,
  resolveGeoRegionCode,
  resolveGeoRegionForCountry,
  type GeoPricingApplyResult,
} from './geoPricing';

export type PricingRegion = string;

export function resolvePricingRegion(countryCode: string | null | undefined): PricingRegion {
  return resolveGeoRegionCode(countryCode) ?? 'DEFAULT';
}

export function pricingRegionsMatch(
  quotedCountryCode: string | null | undefined,
  paymentCountryCode: string | null | undefined,
): boolean {
  return geoPricingRegionsMatch(quotedCountryCode, paymentCountryCode);
}

export function pricingRegionLabel(region: PricingRegion): string {
  if (region === 'DEFAULT') return 'standard';
  return geoPricingRegionLabel(region);
}

export function isDiscountedPricingRegion(region: PricingRegion): boolean {
  return region !== 'DEFAULT';
}
