import assert from 'assert';
import type { CourseGeoPrice } from '../../shared/types';
import { PricingResolutionError, resolvePriceFromCandidates } from './pricingResolver';
import { validateGeoPriceInput } from './courseGeoPriceValidation';
import { parseCsvText, parseImportRow } from './courseGeoPriceImport';

function price(partial: Partial<CourseGeoPrice> & Pick<CourseGeoPrice, 'id' | 'name' | 'amount' | 'currency'>): CourseGeoPrice {
  return {
    courseId: 1,
    compareAtAmount: null,
    countryCode: null,
    region: null,
    geoGroup: null,
    isDefault: false,
    isActive: true,
    stripePriceId: null,
    validFrom: null,
    validUntil: null,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
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

run('prefers exact country match over default', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default USD', amount: 349, currency: 'USD', isDefault: true, priority: 10 }),
    price({ id: 2, name: 'UK GBP', amount: 299, currency: 'GBP', countryCode: 'GB', priority: 5 }),
  ], { countryCode: 'GB' });
  assert.strictEqual(resolved.price.id, 2);
  assert.strictEqual(resolved.matchReason, 'country');
});

run('falls back to region/geo group when country missing', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default', amount: 349, currency: 'USD', isDefault: true }),
    price({ id: 2, name: 'GCC', amount: 1299, currency: 'AED', geoGroup: 'gcc', priority: 20 }),
  ], { geoGroup: 'gcc' });
  assert.strictEqual(resolved.price.id, 2);
  assert.strictEqual(resolved.matchReason, 'region_or_geo_group');
});

run('falls back to currency then default', () => {
  const byCurrency = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default', amount: 349, currency: 'USD', isDefault: true, priority: 1 }),
    price({ id: 2, name: 'EUR list', amount: 279, currency: 'EUR', priority: 5 }),
  ], { currency: 'EUR' });
  assert.strictEqual(byCurrency.price.id, 2);
  assert.strictEqual(byCurrency.matchReason, 'currency');

  const byDefault = resolvePriceFromCandidates([
    price({ id: 1, name: 'Default', amount: 349, currency: 'USD', isDefault: true }),
    price({ id: 2, name: 'PK', amount: 45000, currency: 'PKR', countryCode: 'PK' }),
  ], { countryCode: 'US' });
  assert.strictEqual(byDefault.price.id, 1);
  assert.strictEqual(byDefault.matchReason, 'default');
});

run('picks highest priority among equal matches', () => {
  const resolved = resolvePriceFromCandidates([
    price({ id: 1, name: 'UK A', amount: 299, currency: 'GBP', countryCode: 'GB', priority: 10 }),
    price({ id: 2, name: 'UK B', amount: 249, currency: 'GBP', countryCode: 'GB', priority: 50 }),
  ], { countryCode: 'GB' });
  assert.strictEqual(resolved.price.id, 2);
});

run('throws when no price matches', () => {
  assert.throws(
    () => resolvePriceFromCandidates([
      price({ id: 1, name: 'PK only', amount: 100, currency: 'PKR', countryCode: 'PK', isDefault: false }),
    ], { countryCode: 'US' }),
    PricingResolutionError,
  );
});

run('validates amount, currency, country, dates, compare-at', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad',
    currency: 'XX',
    amount: 10,
    compareAtAmount: 5,
    countryCode: 'ZZ',
    validFrom: '2026-06-01',
    validUntil: '2026-01-01',
  });
  const fields = issues.map(i => i.field);
  assert.ok(fields.includes('currency'));
  assert.ok(fields.includes('countryCode'));
  assert.ok(fields.includes('validUntil'));
  assert.ok(fields.includes('compareAtAmount'));

  const amountIssues = validateGeoPriceInput({
    courseId: 1,
    name: 'Bad amount',
    currency: 'GBP',
    amount: 0,
  });
  assert.ok(amountIssues.some(i => i.field === 'amount'));
});

run('accepts a valid geo price input', () => {
  const issues = validateGeoPriceInput({
    courseId: 1,
    name: 'UK Standard',
    currency: 'GBP',
    amount: 299,
    compareAtAmount: 349,
    countryCode: 'GB',
    isDefault: true,
    isActive: true,
  });
  assert.strictEqual(issues.length, 0);
});

run('parses CSV import rows', () => {
  const csv = [
    'zenler_course_id,course_slug,course_title,price_name,country_code,region,geo_group,currency,amount,compare_at_amount,is_default,is_active,valid_from,valid_until,priority',
    '101,acca-fa1,ACCA FA1,UK Standard Price,GB,Europe,uk_eu,GBP,299.00,349.00,true,true,,,100',
  ].join('\n');
  const rows = parseCsvText(csv);
  assert.strictEqual(rows.length, 1);
  const parsed = parseImportRow(rows[0]!, 2);
  assert.strictEqual(parsed.zenlerCourseId, '101');
  assert.strictEqual(parsed.priceName, 'UK Standard Price');
  assert.strictEqual(parsed.countryCode, 'GB');
  assert.strictEqual(parsed.amount, 299);
  assert.strictEqual(parsed.isDefault, true);
  assert.strictEqual(parsed.priority, 100);
});

console.log('All tests passed.');
