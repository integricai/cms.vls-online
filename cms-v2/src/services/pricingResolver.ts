import type { CourseGeoPrice, ResolvedCoursePrice } from '../../shared/types';
import { listActiveGeoPricesForCourse } from '../models/courseGeoPrice';
import { effectiveAmount } from './courseGeoPriceValidation';

export class PricingResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PricingResolutionError';
  }
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

function toResolved(price: CourseGeoPrice, matchReason: ResolvedCoursePrice['matchReason'], detectedCountryCode: string | null): ResolvedCoursePrice {
  return {
    price,
    matchReason,
    effectiveAmount: effectiveAmount(price.amount, price.discountedPrice),
    detectedCountryCode,
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
    const durationMatch = pickHighestPriority(candidates);
    if (durationMatch) {
      return toResolved(durationMatch, options.matchReason ?? 'duration', detectedCountryCode);
    }
  }

  const defaults = candidates.filter(p => p.isDefault);
  const defaultMatch = pickHighestPriority(defaults);
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
