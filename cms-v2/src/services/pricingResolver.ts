import type { CourseGeoPrice, ResolvedCoursePrice } from '../../shared/types';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import { effectiveAmount } from './courseGeoPriceValidation';
import { applyGeoPricing } from './geoPricing';

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
  const campaignAmount = effectiveAmount(price.amount, price.discountedPrice);
  const geo = applyGeoPricing({
    listAmount: price.amount,
    campaignAmount,
    countryCode: detectedCountryCode,
  });

  return {
    price,
    matchReason,
    effectiveAmount: geo.effectiveAmount,
    detectedCountryCode,
    geoPricingApplied: geo.geoPricingApplied,
    geoRegionCode: geo.geoRegionCode,
    geoDiscountPercent: geo.geoDiscountPercent,
  };
}

/**
 * Resolve the best matching active USD price for a course.
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

export async function resolveCoursePrice(input: {
  courseId: number;
  durationMonths?: number | null;
  /** Reserved for future campaign/discount code matching. */
  campaignCode?: string | null;
  detectedCountryCode?: string | null;
}): Promise<ResolvedCoursePrice> {
  const prices = await listActiveGeoPricesForCourse(input.courseId);
  if (prices.length === 0) {
    throw new PricingResolutionError('No active prices configured for this course');
  }
  return resolvePriceFromCandidates(prices, input, {
    detectedCountryCode: input.detectedCountryCode ?? null,
  });
}
