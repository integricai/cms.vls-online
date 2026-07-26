import type { CoursePricingMode, CourseGeoPriceInput } from '../../shared/types';
import { isEvenDealsProductId } from '../../shared/evenDealsProducts';

export interface ValidationIssue {
  field?: string;
  message: string;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function computeDiscountedPrice(amount: number, discountPercent: number | null | undefined): number | null {
  if (discountPercent == null || discountPercent <= 0) return null;
  return roundMoney(amount * (1 - discountPercent / 100));
}

export function effectiveAmount(amount: number, discountedPrice: number | null | undefined): number {
  return discountedPrice != null && discountedPrice > 0 ? discountedPrice : amount;
}

const CURRENT_YEAR = new Date().getFullYear();
export const EXAM_SESSION_MIN_YEAR = CURRENT_YEAR;
export const EXAM_SESSION_MAX_YEAR = CURRENT_YEAR + 10;

export function deriveLegacyDurationMonths(
  pricingMode: CoursePricingMode,
  durationDays: number | null | undefined,
): number {
  if (pricingMode === 'duration' && Number.isFinite(Number(durationDays)) && Number(durationDays) > 0) {
    return Math.min(6, Math.max(1, Math.round(Number(durationDays) / 30)));
  }
  return 6;
}

export function validateGeoPriceInput(
  input: Partial<CourseGeoPriceInput>,
  options: { requireCourseId?: boolean } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const requireCourseId = options.requireCourseId !== false;

  if (requireCourseId) {
    const courseId = Number(input.courseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
      issues.push({ field: 'courseId', message: 'course_id is required' });
    }
  }

  const name = String(input.name ?? '').trim();
  if (!name) {
    issues.push({ field: 'name', message: 'price name is required' });
  }

  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    issues.push({ field: 'amount', message: 'amount must be greater than 0' });
  }

  if (input.compareAtAmount != null && input.compareAtAmount !== undefined) {
    const compareAt = Number(input.compareAtAmount);
    if (!Number.isFinite(compareAt)) {
      issues.push({ field: 'compareAtAmount', message: 'compare_at_amount must be a number' });
    } else if (Number.isFinite(amount) && compareAt < amount) {
      issues.push({
        field: 'compareAtAmount',
        message: 'compare_at_amount must be greater than or equal to amount',
      });
    }
  }

  if (input.discountPercent != null && input.discountPercent !== undefined) {
    const discountPercent = Number(input.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      issues.push({ field: 'discountPercent', message: 'discount must be between 0 and 100' });
    } else if (Number.isFinite(amount) && discountPercent > 0) {
      const discounted = computeDiscountedPrice(amount, discountPercent);
      if (discounted != null && discounted <= 0) {
        issues.push({ field: 'discountPercent', message: 'discount results in a non-positive price' });
      }
    }
  }

  const pricingMode = input.pricingMode ?? 'duration';
  if (pricingMode !== 'session' && pricingMode !== 'duration') {
    issues.push({ field: 'pricingMode', message: 'pricing_mode must be "session" or "duration"' });
  } else if (pricingMode === 'session') {
    const month = Number(input.examSessionMonth);
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      issues.push({ field: 'examSessionMonth', message: 'exam session month must be between 1 and 12' });
    }
    const year = Number(input.examSessionYear);
    if (!Number.isInteger(year) || year < EXAM_SESSION_MIN_YEAR || year > EXAM_SESSION_MAX_YEAR) {
      issues.push({
        field: 'examSessionYear',
        message: `exam session year must be between ${EXAM_SESSION_MIN_YEAR} and ${EXAM_SESSION_MAX_YEAR}`,
      });
    }
  } else {
    const durationDays = Number(input.durationDays);
    if (!Number.isInteger(durationDays) || durationDays <= 0) {
      issues.push({ field: 'durationDays', message: 'duration (days) must be a whole number greater than 0' });
    }
  }

  if (input.evenDeals != null && String(input.evenDeals).trim() !== '') {
    const evenDeals = String(input.evenDeals).trim();
    if (!isEvenDealsProductId(evenDeals)) {
      issues.push({ field: 'evenDeals', message: 'evendeals must be one of the configured product IDs' });
    }
  }

  return issues;
}

export function normalizeGeoPriceInput(input: CourseGeoPriceInput): CourseGeoPriceInput {
  const amount = Number(input.amount);
  const discountPercentRaw = input.discountPercent;
  const discountPercent = discountPercentRaw == null || String(discountPercentRaw).trim() === ''
    ? null
    : roundMoney(Number(discountPercentRaw));
  const normalizedDiscount = discountPercent != null && discountPercent > 0 ? discountPercent : null;
  const pricingMode: CoursePricingMode = input.pricingMode === 'session' ? 'session' : 'duration';

  return {
    ...input,
    courseId: Number(input.courseId),
    name: String(input.name).trim(),
    currency: 'USD',
    amount,
    compareAtAmount: input.compareAtAmount == null || input.compareAtAmount === undefined
      ? null
      : Number(input.compareAtAmount),
    discountPercent: normalizedDiscount,
    isDefault: Boolean(input.isDefault),
    isActive: input.isActive !== false,
    stripePriceId: input.stripePriceId?.trim() || null,
    ...(input.evenDeals !== undefined
      ? {
          evenDeals: input.evenDeals == null || String(input.evenDeals).trim() === ''
            ? null
            : String(input.evenDeals).trim(),
        }
      : {}),
    pricingMode,
    examSessionMonth: pricingMode === 'session' && Number.isFinite(Number(input.examSessionMonth))
      ? Number(input.examSessionMonth)
      : null,
    examSessionYear: pricingMode === 'session' && Number.isFinite(Number(input.examSessionYear))
      ? Number(input.examSessionYear)
      : null,
    durationDays: pricingMode === 'duration' && Number.isFinite(Number(input.durationDays))
      ? Number(input.durationDays)
      : null,
  };
}

export function discountedPriceForInput(input: CourseGeoPriceInput): number | null {
  return computeDiscountedPrice(input.amount, input.discountPercent);
}
