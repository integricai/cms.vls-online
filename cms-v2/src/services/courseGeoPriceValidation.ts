import type { CourseGeoPriceInput } from '../../shared/types';

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

function parseDate(value: unknown): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
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

  const validFrom = parseDate(input.validFrom);
  const validUntil = parseDate(input.validUntil);
  if (input.validFrom != null && input.validFrom !== '' && !validFrom) {
    issues.push({ field: 'validFrom', message: 'valid_from is not a valid date' });
  }
  if (input.validUntil != null && input.validUntil !== '' && !validUntil) {
    issues.push({ field: 'validUntil', message: 'valid_until is not a valid date' });
  }
  if (validFrom && validUntil && validUntil < validFrom) {
    issues.push({ field: 'validUntil', message: 'valid_until cannot be before valid_from' });
  }

  if (input.priority != null && input.priority !== undefined && !Number.isFinite(Number(input.priority))) {
    issues.push({ field: 'priority', message: 'priority must be a number' });
  }

  const durationMonths = Number(input.durationMonths ?? 6);
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 6) {
    issues.push({ field: 'durationMonths', message: 'duration must be between 1 and 6 months' });
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
    currency: 'USD',
    amount,
    compareAtAmount: input.compareAtAmount == null || input.compareAtAmount === undefined
      ? null
      : Number(input.compareAtAmount),
    discountPercent: normalizedDiscount,
    isDefault: Boolean(input.isDefault),
    isActive: input.isActive !== false,
    stripePriceId: input.stripePriceId?.trim() || null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
    durationMonths: Number.isFinite(Number(input.durationMonths))
      ? Math.min(6, Math.max(1, Number(input.durationMonths)))
      : 6,
  };
}

export function discountedPriceForInput(input: CourseGeoPriceInput): number | null {
  return computeDiscountedPrice(input.amount, input.discountPercent);
}
