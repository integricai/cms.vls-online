import type { CourseGeoPrice, ResolvedCoursePrice } from '../../shared/types';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import { normalizeCountryCode } from '../utils/isoCountryCodes';

export class PricingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingResolutionError';
  }
}

function normalizeText(value: string | null | undefined): string | null {
  const text = String(value ?? '').trim().toLowerCase();
  return text || null;
}

function pickHighestPriority(prices: CourseGeoPrice[]): CourseGeoPrice | null {
  if (prices.length === 0) return null;
  return [...prices].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id - b.id;
  })[0] ?? null;
}

function filterByDuration(prices: CourseGeoPrice[], durationMonths?: number | null): CourseGeoPrice[] {
  if (durationMonths == null || !Number.isInteger(durationMonths)) return prices;
  return prices.filter(p => p.durationMonths === durationMonths);
}

/**
 * Resolve the best matching active geo price for a course.
 *
 * Match order:
 * 1. Exact country_code
 * 2. Region / geo_group
 * 3. Currency
 * 4. Default price
 */
export function resolvePriceFromCandidates(
  prices: CourseGeoPrice[],
  input: {
    countryCode?: string | null;
    currency?: string | null;
    region?: string | null;
    geoGroup?: string | null;
    durationMonths?: number | null;
  },
): ResolvedCoursePrice {
  const candidates = filterByDuration(prices, input.durationMonths);
  if (candidates.length === 0) {
    throw new PricingResolutionError('No active price found for the selected duration');
  }

  const countryCode = normalizeCountryCode(input.countryCode);
  const currency = String(input.currency ?? '').trim().toUpperCase() || null;
  const region = normalizeText(input.region);
  const geoGroup = normalizeText(input.geoGroup);

  const byCountry = countryCode
    ? candidates.filter(p => normalizeCountryCode(p.countryCode) === countryCode)
    : [];
  const countryMatch = pickHighestPriority(byCountry);
  if (countryMatch) {
    return {
      price: countryMatch,
      matchReason: 'country',
      detectedCountryCode: countryCode,
      requestedCurrency: currency,
    };
  }

  const byRegionOrGroup = candidates.filter(p => {
    const priceRegion = normalizeText(p.region);
    const priceGroup = normalizeText(p.geoGroup);
    return (
      (region != null && priceRegion === region)
      || (geoGroup != null && priceGroup === geoGroup)
    );
  });
  const regionMatch = pickHighestPriority(byRegionOrGroup);
  if (regionMatch) {
    return {
      price: regionMatch,
      matchReason: 'region_or_geo_group',
      detectedCountryCode: countryCode,
      requestedCurrency: currency,
    };
  }

  const byCurrency = currency
    ? candidates.filter(p => p.currency.toUpperCase() === currency)
    : [];
  const currencyMatch = pickHighestPriority(byCurrency);
  if (currencyMatch) {
    return {
      price: currencyMatch,
      matchReason: 'currency',
      detectedCountryCode: countryCode,
      requestedCurrency: currency,
    };
  }

  const defaults = candidates.filter(p => p.isDefault);
  const defaultMatch = pickHighestPriority(defaults);
  if (defaultMatch) {
    return {
      price: defaultMatch,
      matchReason: 'default',
      detectedCountryCode: countryCode,
      requestedCurrency: currency,
    };
  }

  throw new PricingResolutionError('No active price found for this course');
}

export async function resolveCoursePrice(input: {
  courseId: number;
  countryCode?: string | null;
  currency?: string | null;
  region?: string | null;
  geoGroup?: string | null;
  durationMonths?: number | null;
  /** Reserved for future campaign/discount code matching. */
  campaignCode?: string | null;
}): Promise<ResolvedCoursePrice> {
  const prices = await listActiveGeoPricesForCourse(input.courseId);
  if (prices.length === 0) {
    throw new PricingResolutionError('No active prices configured for this course');
  }
  return resolvePriceFromCandidates(prices, input);
}
