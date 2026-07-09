import type { CourseGeoPriceInput } from '../../shared/types';
import { isValidIsoCountryCode, normalizeCountryCode } from '../utils/isoCountryCodes';

export interface ValidationIssue {
  field?: string;
  message: string;
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

  const currency = String(input.currency ?? '').trim().toUpperCase();
  if (!currency) {
    issues.push({ field: 'currency', message: 'currency is required' });
  } else if (!/^[A-Z]{3}$/.test(currency)) {
    issues.push({ field: 'currency', message: 'currency must be a 3-letter ISO code' });
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

  const countryCode = normalizeCountryCode(input.countryCode);
  if (countryCode && !isValidIsoCountryCode(countryCode)) {
    issues.push({ field: 'countryCode', message: `invalid ISO country code: ${countryCode}` });
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

  return issues;
}

export function normalizeGeoPriceInput(input: CourseGeoPriceInput): CourseGeoPriceInput {
  return {
    ...input,
    courseId: Number(input.courseId),
    name: String(input.name).trim(),
    currency: String(input.currency).trim().toUpperCase(),
    amount: Number(input.amount),
    compareAtAmount: input.compareAtAmount == null || input.compareAtAmount === undefined
      ? null
      : Number(input.compareAtAmount),
    countryCode: normalizeCountryCode(input.countryCode),
    region: input.region?.trim() || null,
    geoGroup: input.geoGroup?.trim() || null,
    isDefault: Boolean(input.isDefault),
    isActive: input.isActive !== false,
    stripePriceId: input.stripePriceId?.trim() || null,
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    priority: Number.isFinite(Number(input.priority)) ? Number(input.priority) : 0,
  };
}
