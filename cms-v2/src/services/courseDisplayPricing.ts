import type { CourseGeoPrice } from '../../shared/types';
import { effectiveAmount, roundMoney } from './courseGeoPriceValidation';
import { applyParityDealsPricing } from './parityDeals';
/** ACCA exam sittings: March, June, September, December. */
export const ACCA_EXAM_MONTHS = [3, 6, 9, 12] as const;

const MONTH_LABELS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export type PublishedCoursePricePlan = {
  id: number;
  coursePriceId: number;
  planName: string;
  sessionTitle: string;
  sessionMonth: number | null;
  sessionYear: number | null;
  subtitle: string;
  amount: number;
  compareAt: number | null;
  discountPercent: number | null;
  effectiveAmount: number;
  formatted: string;
  formattedCompareAt: string | null;
  lateEnrollmentDiscount: boolean;
  isDefault: boolean;
  badge: string | null;
  geoPricingApplied: boolean;
  geoRegionCode: string | null;
};

export type PublishedCoursePricing = {
  zenlerCourseId: string;
  courseSlug: string | null;
  courseName: string;
  currency: 'USD';
  plans: PublishedCoursePricePlan[];
  /** Top-level quote for single-plan courses or default plan. */
  amount: number;
  compareAt: number | null;
  formatted: string;
  formattedCompareAt: string | null;
};

export function formatUsd(amount: number): string {
  const hasCents = Math.round(amount * 100) % 100 !== 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Next upcoming ACCA exam sessions from the given date. */
export function getNextAccaExamSessions(
  now: Date = new Date(),
  count = 2,
): Array<{ month: number; year: number }> {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const sessions: Array<{ month: number; year: number }> = [];

  for (let year = currentYear; year <= currentYear + 2 && sessions.length < count; year += 1) {
    for (const month of ACCA_EXAM_MONTHS) {
      if (year === currentYear && month < currentMonth) continue;
      sessions.push({ month, year });
      if (sessions.length >= count) break;
    }
  }

  return sessions;
}

export function monthsUntilExamSession(
  sessionMonth: number,
  sessionYear: number,
  now: Date = new Date(),
): number {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return (sessionYear - currentYear) * 12 + (sessionMonth - currentMonth);
}

function sessionTitle(month: number, year: number): string {
  return `${MONTH_LABELS[month] ?? month} ${year} session`;
}

/** Infer access length for ordering plans (shorter plan → nearer exam session). */
export function planDurationSortKey(price: CourseGeoPrice): number {
  if (price.durationDays != null && price.durationDays > 0) return price.durationDays;
  const match = price.name.match(/(\d+)\s*month/i);
  if (match) return Number(match[1]) * 30;
  return price.id;
}

function strikethroughAmount(listAmount: number, compareAt: number | null, effective: number): number | null {
  const crossed = compareAt ?? listAmount;
  if (crossed > effective) return crossed;
  return null;
}

function buildPlanFields(
  price: CourseGeoPrice,
  options: {
    sessionMonth: number | null;
    sessionYear: number | null;
    applyLateEnrollment: boolean;
    badge: string | null;
    countryCode?: string | null;
  },
): PublishedCoursePricePlan {
  const tableDiscount = effectiveAmount(price.amount, price.discountedPrice);
  const lateEnrollmentDiscount = options.applyLateEnrollment && options.sessionMonth != null;
  const campaignAmount = lateEnrollmentDiscount
    ? roundMoney(tableDiscount * 0.5)
    : tableDiscount;

  // CMS campaign / late-enrollment only — ParityDeals applied in buildCourseDisplayPricing.
  const effective = campaignAmount;

  const compareAt = lateEnrollmentDiscount
    ? tableDiscount
    : strikethroughAmount(price.amount, price.compareAtAmount, effective);

  const sessionTitleText = options.sessionMonth != null && options.sessionYear != null
    ? sessionTitle(options.sessionMonth, options.sessionYear)
    : price.name;

  return {
    id: price.id,
    coursePriceId: price.id,
    planName: price.name,
    sessionTitle: sessionTitleText,
    sessionMonth: options.sessionMonth,
    sessionYear: options.sessionYear,
    subtitle: price.name,
    amount: price.amount,
    compareAt,
    discountPercent: price.discountPercent,
    effectiveAmount: effective,
    formatted: formatUsd(effective),
    formattedCompareAt: compareAt != null ? formatUsd(compareAt) : null,
    lateEnrollmentDiscount,
    isDefault: price.isDefault,
    badge: options.badge,
    geoPricingApplied: false,
    geoRegionCode: null,
  };
}

export async function buildCourseDisplayPricing(
  input: {
    zenlerCourseId: string;
    courseSlug: string | null;
    courseName: string;
    prices: CourseGeoPrice[];
    countryCode?: string | null;
    ipAddress?: string | null;
  },
  now: Date = new Date(),
): Promise<PublishedCoursePricing | null> {
  const active = input.prices.filter(p => p.isActive);
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => planDurationSortKey(a) - planDurationSortKey(b));
  const sessions = getNextAccaExamSessions(now, 2);

  let plans: PublishedCoursePricePlan[];

  if (sorted.length === 1) {
    const only = sorted[0]!;
    plans = [buildPlanFields(only, {
      sessionMonth: null,
      sessionYear: null,
      applyLateEnrollment: false,
      badge: null,
      countryCode: input.countryCode,
    })];
  } else {
    plans = sorted.slice(0, 2).map((price, index) => {
      const session = sessions[index] ?? sessions[sessions.length - 1]!;
      const monthsUntil = monthsUntilExamSession(session.month, session.year, now);
      return buildPlanFields(price, {
        sessionMonth: session.month,
        sessionYear: session.year,
        applyLateEnrollment: index === 0 && monthsUntil <= 1,
        badge: index === 1 ? 'Best value' : null,
        countryCode: input.countryCode,
      });
    });
  }

  // One ParityDeals lookup per request — apply the same localized % to every plan.
  const sample = await applyParityDealsPricing({
    campaignAmount: plans[0]!.effectiveAmount,
    ipAddress: input.ipAddress,
    fallbackCountryCode: input.countryCode,
  });

  if (sample.regionalPricingApplied && sample.geoDiscountPercent != null) {
    const percent = sample.geoDiscountPercent;
    plans = plans.map(plan => {
      const effective = roundMoney(plan.effectiveAmount * (1 - percent / 100));
      const compareAt = plan.compareAt != null && plan.compareAt > effective
        ? plan.compareAt
        : (plan.effectiveAmount > effective ? plan.effectiveAmount : plan.compareAt);
      return {
        ...plan,
        effectiveAmount: effective,
        compareAt,
        formatted: formatUsd(effective),
        formattedCompareAt: compareAt != null ? formatUsd(compareAt) : null,
        geoPricingApplied: true,
        geoRegionCode: sample.geoRegionCode,
      };
    });
  }

  const defaultPlan = plans.find(p => p.isDefault) ?? plans[0]!;

  return {
    zenlerCourseId: input.zenlerCourseId,
    courseSlug: input.courseSlug,
    courseName: input.courseName,
    currency: 'USD',
    plans,
    amount: defaultPlan.effectiveAmount,
    compareAt: defaultPlan.compareAt,
    formatted: defaultPlan.formatted,
    formattedCompareAt: defaultPlan.formattedCompareAt,
  };
}
