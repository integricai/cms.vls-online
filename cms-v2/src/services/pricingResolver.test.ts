import assert from 'assert';
import type { CourseGeoPrice } from '../../shared/types';
import { PricingResolutionError, resolvePriceFromCandidates } from './pricingResolver';
import {
  computeDiscountedPrice,
  effectiveAmount,
  validateGeoPriceInput,
} from './courseGeoPriceValidation';
import { parseCsvText, parseImportRow, defaultPriorityScore } from './courseGeoPriceImport';

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
    zenlerPricingCode: null,
    pricingMode: 'duration',
    examSessionMonth: null,
    examSessionYear: null,
    durationDays: 180,
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
    price({ id: 2, name: '3 months', amount: 199, durationMonths: 3, isDefault: true }),
  ], { durationMonths: 3 });
  assert.strictEqual(resolved.price.id, 2);
  assert.strictEqual(resolved.matchReason, 'duration');
});

run('falls back to default when duration not provided', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default', amount: 349, isDefault: true }),
    price({ id: 2, name: 'Other', amount: 199, isDefault: false }),
  ], {});
  assert.strictEqual(resolved.price.id, 1);
  assert.strictEqual(resolved.matchReason, 'default');
});

run('picks lowest id among duration matches', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 2, name: '6mo B', amount: 299, durationMonths: 6 }),
    price({ id: 1, name: '6mo A', amount: 349, durationMonths: 6 }),
  ], { durationMonths: 6 });
  assert.strictEqual(resolved.price.id, 1);
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

run('validates amount, discount, compare-at, and session fields', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad',
    amount: 10,
    compareAtAmount: 5,
    discountPercent: 150,
    pricingMode: 'session',
    examSessionMonth: 13,
    examSessionYear: 1999,
  });
  const fields = issues.map(i => i.field);
  assert.ok(fields.includes('discountPercent'));
  assert.ok(fields.includes('compareAtAmount'));
  assert.ok(fields.includes('examSessionMonth'));
  assert.ok(fields.includes('examSessionYear'));
});

run('accepts a valid USD price input', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: '180 Days Access',
    amount: 150,
    compareAtAmount: 175,
    discountPercent: 10,
    isDefault: true,
    isActive: true,
    pricingMode: 'duration',
    durationDays: 180,
  });
  assert.strictEqual(issues.length, 0);
});

run('parses CSV import rows', () => {
  const csv = [
    'zenler_course_id,course_slug,course_title,price_name,amount,discount_percent,compare_at_amount,pricing_mode,duration_days,is_default,is_active',
    '71086,fa1,ACCA FA1,180 Days Access,150.00,10,175.00,duration,180,true,true',
  ].join('\n');
  const rows = parseCsvText(csv);
  assert.strictEqual(rows.length, 1);
  const parsed = parseImportRow(rows[0]!, 2);
  assert.strictEqual(parsed.zenlerCourseId, '71086');
  assert.strictEqual(parsed.priceName, '180 Days Access');
  assert.strictEqual(parsed.amount, 150);
  assert.strictEqual(parsed.discountPercent, 10);
  assert.strictEqual(parsed.isDefault, true);
  assert.strictEqual(parsed.durationDays, 180);
});

run('parses discount percent with % suffix', () => {
  const parsed = parseImportRow({
    zenler_course_id: '71086',
    price_name: 'Six Months Access',
    amount: '150',
    discount_percent: '20%',
    pricing_mode: 'duration',
    duration_days: '180',
  }, 2);
  assert.strictEqual(parsed.discountPercent, 20);
});

run('treats blank is_default as unspecified', () => {
  const parsed = parseImportRow({
    zenler_course_id: '71086',
    price_name: 'Six Months Access',
    amount: '150',
    pricing_mode: 'duration',
    duration_days: '180',
    is_default: '',
    is_active: 'TRUE',
  }, 2);
  assert.strictEqual(parsed.isDefault, undefined);
  assert.strictEqual(parsed.isActive, true);
});

run('scores longer duration higher for auto-default', () => {
  const short = defaultPriorityScore({ pricingMode: 'duration', durationDays: 120, examSessionMonth: null, examSessionYear: null });
  const long = defaultPriorityScore({ pricingMode: 'duration', durationDays: 180, examSessionMonth: null, examSessionYear: null });
  assert.ok(long > short);
});

run('validates duration days must be a positive whole number', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad duration',
    amount: 100,
    pricingMode: 'duration',
    durationDays: -5,
  });
  assert.ok(issues.some(i => i.field === 'durationDays'));
});

console.log('All tests passed.');
