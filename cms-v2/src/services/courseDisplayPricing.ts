import type { CourseGeoPrice, QualificationOfferRule } from '../../shared/types';
import { effectiveAmount, roundMoney } from './courseGeoPriceValidation';
import {
  applyEvenDealsQuote,
  fetchEvenDealsQuote,
  resolveEvenDealsProductId,
  type EvenDealsQuote,
} from './evenDeals';
import { getQualificationOfferRuleByQualification } from '../models/qualificationOfferRule';
import {
  formatExamSessionTitle,
  getNextOpenExamSessions,
  type ExamSession,
} from './qualificationOfferSessions';

/** ACCA exam sittings fallback when no qualification offer rule is configured. */
export const ACCA_EXAM_MONTHS = [3, 6, 9, 12] as const;

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

/**
 * Legacy helper: next ACCA sittings with no enrollment cutoff
 * (sitting month still offered until that month starts… kept for tests / fallback).
 */
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

  // CMS campaign / late-enrollment only — Evendeals applied in buildCourseDisplayPricing.
  const effective = campaignAmount;

  const compareAt = lateEnrollmentDiscount
    ? tableDiscount
    : strikethroughAmount(price.amount, price.compareAtAmount, effective);

  const sessionTitleText = options.sessionMonth != null && options.sessionYear != null
    ? formatExamSessionTitle(options.sessionMonth, options.sessionYear)
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

type SessionPlanMode =
  | { mode: 'sessions'; sessions: ExamSession[] }
  | { mode: 'duration' };

function resolveSessionPlanMode(
  rule: Pick<QualificationOfferRule, 'offerType' | 'examMonths' | 'cutoffDay'> | null,
  now: Date,
  planCount: number,
): SessionPlanMode {
  if (rule?.offerType === 'open') {
    return { mode: 'duration' };
  }

  if (rule?.offerType === 'exam_sessions') {
    return {
      mode: 'sessions',
      sessions: getNextOpenExamSessions(rule.examMonths, rule.cutoffDay, now, planCount),
    };
  }

  // No rule: keep legacy ACCA sitting labels (no cutoff).
  return {
    mode: 'sessions',
    sessions: getNextAccaExamSessions(now, planCount),
  };
}

export async function buildCourseDisplayPricing(
  input: {
    zenlerCourseId: string;
    courseSlug: string | null;
    courseName: string;
    prices: CourseGeoPrice[];
    qualification?: string | null;
    /** When set, skips DB lookup (tests / preview). */
    offerRule?: QualificationOfferRule | null;
    countryCode?: string | null;
    ipAddress?: string | null;
    ignoreVpnBlock?: boolean;
  },
  now: Date = new Date(),
): Promise<PublishedCoursePricing | null> {
  const active = input.prices.filter(p => p.isActive);
  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => planDurationSortKey(a) - planDurationSortKey(b));

  const rule = input.offerRule !== undefined
    ? input.offerRule
    : await getQualificationOfferRuleByQualification(input.qualification ?? null);

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
    const planSlice = sorted.slice(0, 2);
    const sessionMode = resolveSessionPlanMode(rule, now, planSlice.length);

    if (sessionMode.mode === 'duration' || sessionMode.sessions.length === 0) {
      plans = planSlice.map((price, index) => buildPlanFields(price, {
        sessionMonth: null,
        sessionYear: null,
        applyLateEnrollment: false,
        badge: index === 1 ? 'Best value' : null,
        countryCode: input.countryCode,
      }));
    } else {
      plans = planSlice.map((price, index) => {
        const session = sessionMode.sessions[index] ?? sessionMode.sessions[sessionMode.sessions.length - 1]!;
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
  }

  // Quote once per distinct Evendeals product id (plans may use different deals).
  const sourcePrices = sorted.length === 1 ? [sorted[0]!] : sorted.slice(0, 2);
  const quoteCache = new Map<string, EvenDealsQuote | null>();
  const ignoreVpnBlock = input.ignoreVpnBlock === true;
  const resolvedPlans: PublishedCoursePricePlan[] = [];

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const price = sourcePrices[index] ?? sourcePrices[0]!;
    const productKey = resolveEvenDealsProductId(price.evenDeals) ?? '';

    if (!quoteCache.has(productKey)) {
      quoteCache.set(productKey, await fetchEvenDealsQuote(input.ipAddress, price.evenDeals));
    }

    const quote = quoteCache.get(productKey);
    if (!quote || quote.discountPercentage <= 0) {
      resolvedPlans.push(plan);
      continue;
    }

    const regional = applyEvenDealsQuote(
      plan.effectiveAmount,
      quote,
      input.countryCode ?? null,
      ignoreVpnBlock,
    );
    if (!regional.regionalPricingApplied) {
      resolvedPlans.push(plan);
      continue;
    }

    const effective = regional.effectiveAmount;
    const compareAt = plan.compareAt != null && plan.compareAt > effective
      ? plan.compareAt
      : (plan.effectiveAmount > effective ? plan.effectiveAmount : plan.compareAt);

    resolvedPlans.push({
      ...plan,
      effectiveAmount: effective,
      compareAt,
      formatted: formatUsd(effective),
      formattedCompareAt: compareAt != null ? formatUsd(compareAt) : null,
      geoPricingApplied: true,
      geoRegionCode: regional.geoRegionCode,
    });
  }

  plans = resolvedPlans;

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
