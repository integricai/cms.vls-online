import { listActiveGeoPricesByZenlerCourseId } from '../models/courseGeoPrice';
import { buildCourseDisplayPricing } from './courseDisplayPricing';

/** Standard combo discount applied to the sum of the selected course prices. */
export const COMBO_DISCOUNT_PERCENT = 35;
export const COMBO_MIN_COURSES = 2;

export class ComboBundlePriceError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export type ComboPlanAmount = {
  /** USD amount the student would pay for this plan on its own. */
  amount: number;
  sessionMonth: number | null;
  sessionYear: number | null;
  sessionTitle: string;
  isDefault: boolean;
};

export type ComboChargeQuote = {
  listAmountUsd: number;
  chargeAmountUsd: number;
  discountPercent: number;
  sessionTitle: string | null;
};

export function roundComboMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function comboDiscountedAmount(listAmountUsd: number): number {
  return roundComboMoney(listAmountUsd * (1 - COMBO_DISCOUNT_PERCENT / 100));
}

function isSessionPlan(plan: ComboPlanAmount): boolean {
  return plan.sessionMonth != null
    && plan.sessionYear != null
    && plan.sessionMonth >= 1
    && plan.sessionMonth <= 12
    && plan.sessionYear >= 2000;
}

/** Exam sittings shared by every selected course that has sessions. */
export function sharedComboSessions(
  courses: ComboPlanAmount[][],
): Array<{ month: number; year: number; title: string }> {
  const sessionCourses = courses.filter(plans => plans.some(isSessionPlan));
  if (sessionCourses.length === 0) return [];

  const [first, ...rest] = sessionCourses;
  const shared = first.filter(isSessionPlan).filter(plan => rest.every(plans => (
    plans.some(other => other.sessionMonth === plan.sessionMonth && other.sessionYear === plan.sessionYear)
  )));

  const seen = new Set<string>();
  const sessions: Array<{ month: number; year: number; title: string }> = [];
  for (const plan of shared) {
    const month = plan.sessionMonth!;
    const year = plan.sessionYear!;
    const key = `${year}-${month}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sessions.push({ month, year, title: plan.sessionTitle });
  }
  sessions.sort((a, b) => a.year - b.year || a.month - b.month);
  return sessions;
}

/**
 * Sum the selected courses for one sitting, then apply the standard combo discount.
 * Courses without exam sessions contribute their default plan to every sitting.
 */
export function quoteComboCharge(
  courses: ComboPlanAmount[][],
  session: { month: number; year: number } | null,
): ComboChargeQuote {
  if (courses.length < COMBO_MIN_COURSES) {
    throw new ComboBundlePriceError(
      `Select at least ${COMBO_MIN_COURSES} courses for this combo pack.`,
    );
  }

  const sessions = sharedComboSessions(courses);
  let chosenSession = session;
  if (sessions.length === 0) {
    chosenSession = null;
  } else if (
    !chosenSession
    || !sessions.some(item => item.month === chosenSession!.month && item.year === chosenSession!.year)
  ) {
    throw new ComboBundlePriceError(
      'Choose an exam session that is available for every selected course.',
    );
  }

  const sessionTitle = chosenSession
    ? sessions.find(item => item.month === chosenSession!.month && item.year === chosenSession!.year)?.title ?? null
    : null;

  let list = 0;
  for (const plans of courses) {
    const sessionPlans = plans.filter(isSessionPlan);
    const plan = sessionPlans.length > 0
      ? sessionPlans.find(item => (
        item.sessionMonth === chosenSession!.month && item.sessionYear === chosenSession!.year
      ))
      : plans.find(item => item.isDefault) ?? plans[0];
    if (!plan || !Number.isFinite(plan.amount)) {
      throw new ComboBundlePriceError('Pricing is unavailable for one of the selected courses.');
    }
    list += plan.amount;
  }

  const listAmountUsd = roundComboMoney(list);
  const chargeAmountUsd = comboDiscountedAmount(listAmountUsd);
  if (!(chargeAmountUsd > 0)) {
    throw new ComboBundlePriceError('Pricing is unavailable for this selection.');
  }

  return {
    listAmountUsd,
    chargeAmountUsd,
    discountPercent: COMBO_DISCOUNT_PERCENT,
    sessionTitle,
  };
}

export async function priceComboAccessSelection(input: {
  zenlerCourseIds: string[];
  session: { month: number; year: number } | null;
  countryCode: string | null;
  ipAddress: string | null;
  ignoreVpnBlock: boolean;
}): Promise<ComboChargeQuote> {
  const ids: string[] = [];
  for (const raw of input.zenlerCourseIds) {
    const id = String(raw ?? '').trim();
    if (!/^\d+$/.test(id) || ids.includes(id)) continue;
    ids.push(id);
  }

  const courses = await Promise.all(ids.map(async (zenlerCourseId) => {
    const course = await listActiveGeoPricesByZenlerCourseId(zenlerCourseId);
    if (!course) {
      throw new ComboBundlePriceError('Pricing is unavailable for one of the selected courses.');
    }
    const pricing = await buildCourseDisplayPricing({
      zenlerCourseId: course.zenlerCourseId,
      courseSlug: course.courseSlug,
      courseName: course.courseName,
      courseId: course.courseId,
      qualification: course.qualification,
      prices: course.prices,
      countryCode: input.countryCode,
      ipAddress: input.ipAddress,
      ignoreVpnBlock: input.ignoreVpnBlock,
    });
    if (!pricing || pricing.plans.length === 0) {
      throw new ComboBundlePriceError('Pricing is unavailable for one of the selected courses.');
    }
    return pricing.plans.map(plan => ({
      amount: plan.effectiveAmount,
      sessionMonth: plan.sessionMonth,
      sessionYear: plan.sessionYear,
      sessionTitle: plan.sessionTitle,
      isDefault: plan.isDefault,
    }));
  }));

  return quoteComboCharge(courses, input.session);
}
