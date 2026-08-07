import type { CourseGeoPrice, ResolvedCoursePrice } from '../../shared/types';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import { applyEvenDealsPricing } from './evenDeals';

export class PricingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingResolutionError';
  }
}

function pickLowestId(prices: CourseGeoPrice[]): CourseGeoPrice | null {
  if (prices.length === 0) return null;
  return [...prices].sort((a, b) => a.id - b.id)[0] ?? null;
}

function filterByDuration(prices: CourseGeoPrice[], durationMonths?: number | null): CourseGeoPrice[] {
  if (durationMonths == null || !Number.isInteger(durationMonths)) return prices;
  return prices.filter(p => p.durationMonths === durationMonths);
}

function toResolved(
  price: CourseGeoPrice,
  matchReason: ResolvedCoursePrice['matchReason'],
  detectedCountryCode: string | null,
): ResolvedCoursePrice {
  // List amount only — CMS campaign % is ignored; Evendeals applied via applyParityDealsToResolved.
  return {
    price,
    matchReason,
    effectiveAmount: price.amount,
    detectedCountryCode,
    geoPricingApplied: false,
    geoRegionCode: null,
    geoDiscountPercent: null,
  };
}

/**
 * Resolve the best matching active USD price for a course (list amount only).
 * Evendeals regional discounts are applied separately via applyParityDealsToResolved.
 *
 * Match order:
 * 1. Duration (when provided)
 * 2. Default price
 */
export function resolvePriceFromCandidates(
  prices: CourseGeoPrice[],
  input: {
    durationMonths?: number | null;
  },
  options: {
    matchReason?: ResolvedCoursePrice['matchReason'];
    detectedCountryCode?: string | null;
  } = {},
): ResolvedCoursePrice {
  const detectedCountryCode = options.detectedCountryCode ?? null;
  const candidates = filterByDuration(prices, input.durationMonths);
  if (candidates.length === 0) {
    throw new PricingResolutionError('No active price found for the selected duration');
  }

  if (input.durationMonths != null) {
    const durationMatch = pickLowestId(candidates);
    if (durationMatch) {
      return toResolved(durationMatch, options.matchReason ?? 'duration', detectedCountryCode);
    }
  }

  const defaults = candidates.filter(p => p.isDefault);
  const defaultMatch = pickLowestId(defaults);
  if (defaultMatch) {
    return toResolved(defaultMatch, options.matchReason ?? 'default', detectedCountryCode);
  }

  throw new PricingResolutionError('No active price found for this course');
}

export async function applyParityDealsToResolved(
  resolved: ResolvedCoursePrice,
  input: {
    ipAddress?: string | null;
    ignoreVpnBlock?: boolean;
  } = {},
): Promise<ResolvedCoursePrice> {
  const regional = await applyEvenDealsPricing({
    campaignAmount: resolved.effectiveAmount,
    ipAddress: input.ipAddress,
    fallbackCountryCode: resolved.detectedCountryCode,
    productId: resolved.price.evenDeals,
    ignoreVpnBlock: input.ignoreVpnBlock === true,
  });

  return {
    ...resolved,
    effectiveAmount: regional.effectiveAmount,
    detectedCountryCode: regional.quotedCountryCode ?? resolved.detectedCountryCode,
    geoPricingApplied: regional.geoPricingApplied,
    geoRegionCode: regional.geoRegionCode,
    geoDiscountPercent: regional.geoDiscountPercent,
  };
}

export async function resolveCoursePrice(input: {
  courseId: number;
  durationMonths?: number | null;
  /** Reserved for future campaign/discount code matching. */
  campaignCode?: string | null;
  detectedCountryCode?: string | null;
  ipAddress?: string | null;
  ignoreVpnBlock?: boolean;
}): Promise<ResolvedCoursePrice> {
  const prices = await listActiveGeoPricesForCourse(input.courseId);
  if (prices.length === 0) {
    throw new PricingResolutionError('No active prices configured for this course');
  }
  const resolved = resolvePriceFromCandidates(prices, input, {
    detectedCountryCode: input.detectedCountryCode ?? null,
  });
  return applyParityDealsToResolved(resolved, {
    ipAddress: input.ipAddress,
    ignoreVpnBlock: input.ignoreVpnBlock === true,
  });
}
