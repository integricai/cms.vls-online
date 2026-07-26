import assert from 'assert';
import type { CourseGeoPrice } from '../../shared/types';
import { effectiveAmount } from './courseGeoPriceValidation';
import {
  buildCourseDisplayPricing,
  getNextAccaExamSessions,
  monthsUntilExamSession,
  planDurationSortKey,
} from './courseDisplayPricing';

function geoPrice(partial: Partial<CourseGeoPrice> & Pick<CourseGeoPrice, 'id' | 'name' | 'amount'>): CourseGeoPrice {
  const amount = partial.amount;
  const discountedPrice = partial.discountedPrice ?? null;
  return {
    courseId: 1,
    currency: 'USD',
    compareAtAmount: null,
    discountPercent: partial.discountPercent ?? null,
    discountedPrice,
    effectiveAmount: effectiveAmount(amount, discountedPrice),
    isDefault: false,
    isActive: true,
    stripePriceId: null,
    zenlerPricingCode: null,
    evenDeals: null,
    pricingMode: 'duration',
    examSessionMonth: null,
    examSessionYear: null,
    durationDays: partial.durationDays ?? null,
    durationMonths: 6,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...partial,
    amount,
  };
}

function run(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      console.log(`  ✓ ${name}`);
    })
    .catch(err => {
      console.error(`  ✗ ${name}`);
      throw err;
    });
}

async function main() {
console.log('courseDisplayPricing tests');

await run('August → September and December sessions', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-08-15T12:00:00Z'));
  assert.deepStrictEqual(sessions, [{ month: 9, year: 2026 }, { month: 12, year: 2026 }]);
});

await run('October → December and March', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-10-01T12:00:00Z'));
  assert.deepStrictEqual(sessions, [{ month: 12, year: 2026 }, { month: 3, year: 2027 }]);
});

await run('January → March and June', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-01-10T12:00:00Z'));
  assert.deepStrictEqual(sessions, [{ month: 3, year: 2026 }, { month: 6, year: 2026 }]);
});

await run('months until September from August is 1', () => {
  assert.strictEqual(monthsUntilExamSession(9, 2026, new Date('2026-08-15T12:00:00Z')), 1);
});

await run('FA1 dual plans: shorter → September with late 50%, longer → December', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '71086',
    courseSlug: 'fa1',
    courseName: 'ACCA FA1',
    prices: [
      geoPrice({
        id: 1,
        name: 'Six months',
        amount: 180,
        discountPercent: 20,
        discountedPrice: 144,
        durationDays: 180,
        isDefault: true,
        pricingMode: 'session',
        examSessionMonth: 9,
        examSessionYear: 2026,
      }),
      geoPrice({
        id: 2,
        name: 'Three months',
        amount: 120,
        discountPercent: 20,
        discountedPrice: 96,
        durationDays: 90,
      }),
    ],
  }, new Date('2026-08-15T12:00:00Z'));

  assert.ok(result);
  assert.strictEqual(result!.plans.length, 2);

  const session1 = result!.plans[0]!;
  assert.strictEqual(session1.planName, 'Three months');
  assert.strictEqual(session1.sessionTitle, 'September 2026 session');
  assert.strictEqual(session1.effectiveAmount, 48);
  assert.strictEqual(session1.compareAt, 96);
  assert.strictEqual(session1.lateEnrollmentDiscount, true);

  const session2 = result!.plans[1]!;
  assert.strictEqual(session2.planName, 'Six months');
  assert.strictEqual(session2.sessionTitle, 'December 2026 session');
  assert.strictEqual(session2.effectiveAmount, 144);
  assert.strictEqual(session2.compareAt, 180);
  assert.strictEqual(session2.lateEnrollmentDiscount, false);
  assert.strictEqual(session2.badge, 'Best value');
});

await run('single plan has no session labels or late discount', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    prices: [
      geoPrice({
        id: 10,
        name: 'Full access',
        amount: 200,
        discountPercent: 10,
        discountedPrice: 180,
        durationDays: 365,
      }),
    ],
  }, new Date('2026-08-15T12:00:00Z'));

  assert.ok(result);
  assert.strictEqual(result!.plans.length, 1);
  assert.strictEqual(result!.plans[0]!.sessionTitle, 'Full access');
  assert.strictEqual(result!.plans[0]!.effectiveAmount, 180);
  assert.strictEqual(result!.plans[0]!.lateEnrollmentDiscount, false);
});

await run('planDurationSortKey prefers duration_days', () => {
  assert.ok(planDurationSortKey(geoPrice({ id: 1, name: 'Six months', amount: 1, durationDays: 180 }))
    > planDurationSortKey(geoPrice({ id: 2, name: 'Three months', amount: 1, durationDays: 90 })));
});

console.log('All courseDisplayPricing tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
