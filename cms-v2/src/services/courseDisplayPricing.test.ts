import assert from 'assert';
import type { CourseGeoPrice, QualificationOfferRule } from '../../shared/types';
import { effectiveAmount } from './courseGeoPriceValidation';
import {
  buildCourseDisplayPricing,
  getNextAccaExamSessions,
  monthsUntilExamSession,
  planDurationSortKey,
} from './courseDisplayPricing';
import {
  getNextOpenExamSessions,
  isExamSessionOpen,
  previewQualificationOffers,
} from './qualificationOfferSessions';

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

function accaRule(cutoffDay: number | null = 12): QualificationOfferRule {
  return {
    id: 1,
    qualification: 'ACCA',
    offerType: 'exam_sessions',
    durationDays: [90, 180],
    examMonths: [3, 6, 9, 12],
    cutoffDay,
    isActive: true,
    sortOrder: 10,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function cimaRule(): QualificationOfferRule {
  return {
    id: 2,
    qualification: 'CIMA',
    offerType: 'open',
    durationDays: [180, 365],
    examMonths: [],
    cutoffDay: null,
    isActive: true,
    sortOrder: 20,
    createdAt: new Date(),
    updatedAt: new Date(),
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

await run('Legacy August (no cutoff) → September and December', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-08-15T12:00:00'));
  assert.deepStrictEqual(sessions, [{ month: 9, year: 2026 }, { month: 12, year: 2026 }]);
});

await run('Legacy October → December and March', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-10-01T12:00:00'));
  assert.deepStrictEqual(sessions, [{ month: 12, year: 2026 }, { month: 3, year: 2027 }]);
});

await run('Legacy January → March and June', () => {
  const sessions = getNextAccaExamSessions(new Date('2026-01-10T12:00:00'));
  assert.deepStrictEqual(sessions, [{ month: 3, year: 2026 }, { month: 6, year: 2026 }]);
});

await run('cutoff: Aug 12 still offers September', () => {
  assert.strictEqual(
    isExamSessionOpen({ month: 9, year: 2026 }, 12, new Date('2026-08-12T23:59:59')),
    true,
  );
  const sessions = getNextOpenExamSessions([3, 6, 9, 12], 12, new Date('2026-08-12T12:00:00'), 2);
  assert.deepStrictEqual(sessions, [{ month: 9, year: 2026 }, { month: 12, year: 2026 }]);
});

await run('cutoff: Aug 13 rolls to December and March', () => {
  assert.strictEqual(
    isExamSessionOpen({ month: 9, year: 2026 }, 12, new Date('2026-08-13T00:00:00')),
    false,
  );
  const sessions = getNextOpenExamSessions([3, 6, 9, 12], 12, new Date('2026-08-13T12:00:00'), 2);
  assert.deepStrictEqual(sessions, [{ month: 12, year: 2026 }, { month: 3, year: 2027 }]);
});

await run('preview ACCA as of Aug 1 → Sep + Dec', () => {
  const preview = previewQualificationOffers(accaRule(12), new Date('2026-08-01T12:00:00'));
  assert.strictEqual(preview.plans[0]!.sessionTitle, 'September 2026 session');
  assert.strictEqual(preview.plans[1]!.sessionTitle, 'December 2026 session');
});

await run('preview ACCA as of Aug 13 → Dec + Mar', () => {
  const preview = previewQualificationOffers(accaRule(12), new Date('2026-08-13T12:00:00'));
  assert.strictEqual(preview.plans[0]!.sessionTitle, 'December 2026 session');
  assert.strictEqual(preview.plans[1]!.sessionTitle, 'March 2027 session');
});

await run('preview CIMA uses duration labels', () => {
  const preview = previewQualificationOffers(cimaRule(), new Date('2026-08-15T12:00:00'));
  assert.strictEqual(preview.plans[0]!.sessionTitle, '6 months');
  assert.strictEqual(preview.plans[1]!.sessionTitle, '1 year');
});

await run('months until September from August is 1', () => {
  assert.strictEqual(monthsUntilExamSession(9, 2026, new Date('2026-08-15T12:00:00')), 1);
});

await run('FA1 with ACCA cutoff 12 on Aug 12: Sep late 50% + Dec', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '71086',
    courseSlug: 'fa1',
    courseName: 'ACCA FA1',
    qualification: 'ACCA',
    offerRule: accaRule(12),
    prices: [
      geoPrice({
        id: 1,
        name: 'Six months',
        amount: 180,
        discountPercent: 20,
        discountedPrice: 144,
        durationDays: 180,
        isDefault: true,
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
  }, new Date('2026-08-12T12:00:00'));

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
  assert.strictEqual(session2.lateEnrollmentDiscount, false);
  assert.strictEqual(session2.badge, 'Best value');
});

await run('FA1 with ACCA cutoff 12 on Aug 15: Dec + Mar, no late discount', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '71086',
    courseSlug: 'fa1',
    courseName: 'ACCA FA1',
    qualification: 'ACCA',
    offerRule: accaRule(12),
    prices: [
      geoPrice({
        id: 1,
        name: 'Six months',
        amount: 180,
        discountPercent: 20,
        discountedPrice: 144,
        durationDays: 180,
        isDefault: true,
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
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(result);
  const session1 = result!.plans[0]!;
  assert.strictEqual(session1.sessionTitle, 'December 2026 session');
  assert.strictEqual(session1.effectiveAmount, 96);
  assert.strictEqual(session1.lateEnrollmentDiscount, false);

  const session2 = result!.plans[1]!;
  assert.strictEqual(session2.sessionTitle, 'March 2027 session');
  assert.strictEqual(session2.badge, 'Best value');
});

await run('CIMA dual plans keep duration labels', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima-p1',
    courseName: 'CIMA P1',
    qualification: 'CIMA',
    offerRule: cimaRule(),
    prices: [
      geoPrice({ id: 10, name: 'Six months', amount: 200, durationDays: 180 }),
      geoPrice({ id: 11, name: 'Annual', amount: 300, durationDays: 365, isDefault: true }),
    ],
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.plans[0]!.sessionTitle, 'Six months');
  assert.strictEqual(result!.plans[0]!.sessionMonth, null);
  assert.strictEqual(result!.plans[1]!.sessionTitle, 'Annual');
  assert.strictEqual(result!.plans[1]!.lateEnrollmentDiscount, false);
});

await run('single plan has no session labels or late discount', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    offerRule: null,
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
  }, new Date('2026-08-15T12:00:00'));

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
