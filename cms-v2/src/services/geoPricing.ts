import { listPricingRegions, type PricingRegionRow } from '../models/pricingRegionConfig';
import { roundMoney } from './courseGeoPriceValidation';

export type GeoPricingApplyResult = {
  effectiveAmount: number;
  geoPricingApplied: boolean;
  geoRegionCode: string | null;
  geoDiscountPercent: number | null;
};

type GeoPricingCache = {
  regions: PricingRegionRow[];
  countryToRegion: Map<string, PricingRegionRow>;
};

const FALLBACK_REGIONS: PricingRegionRow[] = [
  {
    code: 'SOUTH_ASIA',
    label: 'South Asia',
    discountPercent: 30,
    isActive: true,
    sortOrder: 10,
    countries: ['PK', 'IN', 'BD', 'LK', 'NP', 'BT', 'MV'],
  },
  {
    code: 'WEST_ASIA',
    label: 'West Asia',
    discountPercent: 25,
    isActive: true,
    sortOrder: 20,
    countries: ['BH', 'KW', 'SA', 'AE', 'QA', 'OM'],
  },
  {
    code: 'AFRICA',
    label: 'Africa',
    discountPercent: 25,
    isActive: true,
    sortOrder: 30,
    countries: ['KE', 'ZM', 'ZW'],
  },
];

let cache: GeoPricingCache = buildCache(FALLBACK_REGIONS);

function buildCache(regions: PricingRegionRow[]): GeoPricingCache {
  const countryToRegion = new Map<string, PricingRegionRow>();
  for (const region of regions) {
    if (!region.isActive) continue;
    for (const country of region.countries) {
      countryToRegion.set(country.toUpperCase(), region);
    }
  }
  return { regions, countryToRegion };
}

export async function refreshGeoPricingCache(): Promise<void> {
  try {
    const regions = await listPricingRegions();
    cache = buildCache(regions.length > 0 ? regions : FALLBACK_REGIONS);
  } catch (err) {
    console.warn('[geo-pricing] Failed to load regions from DB; using fallback defaults', err);
    cache = buildCache(FALLBACK_REGIONS);
  }
}

export function getGeoPricingRegions(): PricingRegionRow[] {
  return cache.regions;
}

function normalizeCountryCode(countryCode: string | null | undefined): string | null {
  const normalized = countryCode?.trim().toUpperCase();
  if (!normalized || normalized === 'XX') return null;
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

export function resolveGeoRegionForCountry(countryCode: string | null | undefined): PricingRegionRow | null {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) return null;
  return cache.countryToRegion.get(normalized) ?? null;
}

export function resolveGeoRegionCode(countryCode: string | null | undefined): string | null {
  return resolveGeoRegionForCountry(countryCode)?.code ?? null;
}

export function pricingRegionLabel(regionCode: string | null | undefined): string {
  if (!regionCode) return 'standard';
  return cache.regions.find(region => region.code === regionCode)?.label ?? regionCode;
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

/**
 * Apply geo regional discount off list price, then take the lower of geo vs campaign price.
 * Geo pricing is bypassed entirely for countries not mapped to an active region.
 */
export function applyGeoPricing(input: {
  listAmount: number;
  campaignAmount: number;
  countryCode: string | null | undefined;
}): GeoPricingApplyResult {
  const region = resolveGeoRegionForCountry(input.countryCode);
  if (!region) {
    return {
      effectiveAmount: input.campaignAmount,
      geoPricingApplied: false,
      geoRegionCode: null,
      geoDiscountPercent: null,
    };
  }

  const geoAmount = roundMoney(input.listAmount * (1 - region.discountPercent / 100));
  const effectiveAmount = Math.min(input.campaignAmount, geoAmount);

  return {
    effectiveAmount,
    geoPricingApplied: true,
    geoRegionCode: region.code,
    geoDiscountPercent: region.discountPercent,
  };
}
