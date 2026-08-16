import type { CourseGeoPriceInput } from '../../shared/types';
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

export function deriveLegacyDurationMonths(
  _pricingMode: 'duration' | 'session' | undefined,
  durationDays: number | null | undefined,
): number {
  if (Number.isFinite(Number(durationDays)) && Number(durationDays) > 0) {
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

  if (input.pricingMode != null && input.pricingMode !== 'duration') {
    issues.push({ field: 'pricingMode', message: 'only duration-based pricing is supported' });
  }

  const durationDays = Number(input.durationDays);
  if (!Number.isInteger(durationDays) || durationDays <= 0) {
    issues.push({ field: 'durationDays', message: 'duration (days) must be a whole number greater than 0' });
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

  return {
    ...input,
    courseId: Number(input.courseId),
    name: String(input.name).trim(),
    priceSubtitle: input.priceSubtitle == null || String(input.priceSubtitle).trim() === ''
      ? null
      : String(input.priceSubtitle).trim(),
    currency: 'USD',
    amount,
    compareAtAmount: null,
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
    pricingMode: 'duration',
    examSessionMonth: null,
    examSessionYear: null,
    durationDays: Number.isFinite(Number(input.durationDays)) ? Number(input.durationDays) : null,
  };
}

export function discountedPriceForInput(input: CourseGeoPriceInput): number | null {
  return computeDiscountedPrice(input.amount, input.discountPercent);
}
