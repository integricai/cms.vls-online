import assert from 'assert';
import type { CourseGeoPrice } from '../../shared/types';
import { PricingResolutionError, resolvePriceFromCandidates } from './pricingResolver';
import {
  computeDiscountedPrice,
  effectiveAmount,
  validateGeoPriceInput,
} from './courseGeoPriceValidation';
import { parseCsvText, parseImportRow } from './courseGeoPriceImport';

function price(partial: Partial<CourseGeoPrice> & Pick<CourseGeoPrice, 'id' | 'name' | 'amount'>): CourseGeoPrice {
  const amount = partial.amount;
  const discountedPrice = partial.discountedPrice ?? null;
  return {
    courseId: 1,
    currency: 'USD',
    compareAtAmount: null,
    discountPercent: null,
    discountedPrice,
    effectiveAmount: effectiveAmount(amount, discountedPrice),
    isDefault: false,
    isActive: true,
    stripePriceId: null,
    validFrom: null,
    validUntil: null,
    priority: 0,
    durationMonths: 6,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    amount,
  };
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('pricingResolver + validation tests');

run('resolves by duration when provided', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: '6 months', amount: 349, durationMonths: 6, isDefault: true }),
    price({ id: 2, name: '3 months', amount: 199, durationMonths: 3, isDefault: true, priority: 20 }),
  ], { durationMonths: 3 });
  assert.strictEqual(resolved.price.id, 2);
  assert.strictEqual(resolved.matchReason, 'duration');
});

run('falls back to default when duration not provided', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default', amount: 349, isDefault: true, priority: 1 }),
    price({ id: 2, name: 'Other', amount: 199, isDefault: false, priority: 50 }),
  ], {});
  assert.strictEqual(resolved.price.id, 1);
  assert.strictEqual(resolved.matchReason, 'default');
});

run('picks highest priority among duration matches', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: '6mo A', amount: 349, durationMonths: 6, priority: 10 }),
    price({ id: 2, name: '6mo B', amount: 299, durationMonths: 6, priority: 50 }),
  ], { durationMonths: 6 });
  assert.strictEqual(resolved.price.id, 2);
});

run('throws when no price matches duration', () => {
  assert.throws(
    () => resolvePriceFromCandidates([
      price({ id: 1, name: '3 months only', amount: 199, durationMonths: 3 }),
    ], { durationMonths: 6 }),
    PricingResolutionError,
  );
});

run('uses discounted price as effective amount', () => {
  const resolved = resolvePriceFromCandidates([
    price({
      id: 1,
      name: 'Sale',
      amount: 150,
      discountPercent: 10,
      discountedPrice: 135,
      isDefault: true,
    }),
  ], {});
  assert.strictEqual(resolved.effectiveAmount, 135);
});

run('computes discounted price from percent', () => {
  assert.strictEqual(computeDiscountedPrice(150, 10), 135);
  assert.strictEqual(computeDiscountedPrice(150, 0), null);
  assert.strictEqual(computeDiscountedPrice(150, null), null);
});

run('validates amount, discount, dates, compare-at', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad',
    amount: 10,
    compareAtAmount: 5,
    discountPercent: 150,
    validFrom: '2026-06-01',
    validUntil: '2026-01-01',
  });
  const fields = issues.map(i => i.field);
  assert.ok(fields.includes('discountPercent'));
  assert.ok(fields.includes('validUntil'));
  assert.ok(fields.includes('compareAtAmount'));
});

run('accepts a valid USD price input', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: '6 Months Access',
    amount: 150,
    compareAtAmount: 175,
    discountPercent: 10,
    isDefault: true,
    isActive: true,
  });
  assert.strictEqual(issues.length, 0);
});

run('parses CSV import rows', () => {
  const csv = [
    'zenler_course_id,course_slug,course_title,price_name,amount,discount_percent,compare_at_amount,duration_months,is_default,is_active,valid_from,valid_until,priority',
    '71086,fa1,ACCA FA1,6 Months Access,150.00,10,175.00,6,true,true,,,100',
  ].join('\n');
  const rows = parseCsvText(csv);
  assert.strictEqual(rows.length, 1);
  const parsed = parseImportRow(rows[0]!, 2);
  assert.strictEqual(parsed.zenlerCourseId, '71086');
  assert.strictEqual(parsed.priceName, '6 Months Access');
  assert.strictEqual(parsed.amount, 150);
  assert.strictEqual(parsed.discountPercent, 10);
  assert.strictEqual(parsed.isDefault, true);
});

run('validates duration months range', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad duration',
    amount: 100,
    durationMonths: 9,
  });
  assert.ok(issues.some(i => i.field === 'durationMonths'));
});

console.log('All tests passed.');
