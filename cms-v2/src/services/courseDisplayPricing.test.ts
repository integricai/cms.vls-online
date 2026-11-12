import assert from 'assert';
import type { CourseGeoPrice, QualificationOfferRule } from '../../shared/types';
import { effectiveAmount } from './courseGeoPriceValidation';
import {
  applyVisitorDealToPlan,
  buildCourseDisplayPricing,
  displayedExamSessionForPrice,
  getNextAccaExamSessions,
  monthsUntilExamSession,
  planDurationSortKey,
  resolveDisplayCountry,
  type PublishedCoursePricePlan,
} from './courseDisplayPricing';
import type { EvenDealsQuote } from './evenDeals';
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
    priceSubtitle: null,
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

function accaRule(
  cutoffDay: number | null = 12,
  courseIds: number[] = [],
): QualificationOfferRule {
  return {
    id: 1,
    qualification: 'ACCA',
    offerType: 'exam_sessions',
    durationDays: [90, 180],
    examMonths: [3, 6, 9, 12],
    cutoffDay,
    courseIds,
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
    courseIds: [],
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

await run('price card maps the shorter plan to the nearer sitting', () => {
  const prices = [
    geoPrice({ id: 1, name: 'Six months', amount: 180, durationDays: 180, isDefault: true }),
    geoPrice({ id: 2, name: 'Three months', amount: 120, durationDays: 90 }),
  ];
  const asOf = new Date('2026-10-30T12:00:00Z');
  assert.deepStrictEqual(
    displayedExamSessionForPrice(prices, accaRule(12), 1, 2, asOf),
    { month: 12, year: 2026 },
  );
  assert.deepStrictEqual(
    displayedExamSessionForPrice(prices, accaRule(12), 1, 1, asOf),
    { month: 3, year: 2027 },
  );
  assert.strictEqual(
    displayedExamSessionForPrice(prices, cimaRule(), 1, 2, asOf),
    null,
  );
});

await run('months until September from August is 1', () => {
  assert.strictEqual(monthsUntilExamSession(9, 2026, new Date('2026-08-15T12:00:00')), 1);
});

await run('FA1 with ACCA cutoff 12 on Aug 12: Sep + Dec use list amount (no CMS/late discount)', async () => {
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
  assert.strictEqual(session1.subtitle, 'Complete course with tutor support');
  assert.strictEqual(session1.effectiveAmount, 120);
  assert.strictEqual(session1.compareAt, null);
  assert.strictEqual(session1.discountPercent, null);
  assert.strictEqual(session1.lateEnrollmentDiscount, false);

  const session2 = result!.plans[1]!;
  assert.strictEqual(session2.planName, 'Six months');
  assert.strictEqual(session2.sessionTitle, 'December 2026 session');
  assert.strictEqual(session2.effectiveAmount, 180);
  assert.strictEqual(session2.lateEnrollmentDiscount, false);
  assert.strictEqual(session2.badge, 'Best value');
});

await run('FA1 with ACCA cutoff 12 on Aug 15: Dec + Mar, list amount only', async () => {
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
  assert.strictEqual(session1.effectiveAmount, 120);
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

await run('ACCA allowlist: selected course gets exam sessions', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '71086',
    courseSlug: 'fa1',
    courseName: 'ACCA FA1',
    courseId: 42,
    qualification: 'ACCA',
    offerRule: accaRule(12, [42, 99]),
    prices: [
      geoPrice({ id: 1, name: 'Three months', amount: 120, durationDays: 90, courseId: 42 }),
      geoPrice({ id: 2, name: 'Six months', amount: 180, durationDays: 180, courseId: 42, isDefault: true }),
    ],
  }, new Date('2026-08-12T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.plans[0]!.sessionTitle, 'September 2026 session');
  assert.strictEqual(result!.plans[1]!.sessionTitle, 'December 2026 session');
});

await run('ACCA allowlist: non-selected course keeps duration labels', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '99999',
    courseSlug: 'revision-pack',
    courseName: 'ACCA Revision Pack',
    courseId: 77,
    qualification: 'ACCA',
    offerRule: accaRule(12, [42, 99]),
    prices: [
      geoPrice({ id: 1, name: '90 days', amount: 80, durationDays: 90, courseId: 77 }),
      geoPrice({ id: 2, name: '180 days', amount: 140, durationDays: 180, courseId: 77, isDefault: true }),
    ],
  }, new Date('2026-08-12T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.plans[0]!.sessionTitle, '90 days');
  assert.strictEqual(result!.plans[0]!.sessionMonth, null);
  assert.strictEqual(result!.plans[0]!.lateEnrollmentDiscount, false);
  assert.strictEqual(result!.plans[1]!.sessionTitle, '180 days');
  assert.strictEqual(result!.plans[1]!.sessionMonth, null);
});

await run('ACCA empty allowlist still applies sessions to all courses', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '71086',
    courseSlug: 'fa1',
    courseName: 'ACCA FA1',
    courseId: 42,
    qualification: 'ACCA',
    offerRule: accaRule(12, []),
    prices: [
      geoPrice({ id: 1, name: 'Three months', amount: 120, durationDays: 90, courseId: 42 }),
      geoPrice({ id: 2, name: 'Six months', amount: 180, durationDays: 180, courseId: 42, isDefault: true }),
    ],
  }, new Date('2026-08-12T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.plans[0]!.sessionTitle, 'September 2026 session');
  assert.strictEqual(result!.plans[1]!.sessionTitle, 'December 2026 session');
});

await run('single plan uses list amount (ignores CMS campaign %)', async () => {
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
  assert.strictEqual(result!.plans[0]!.effectiveAmount, 200);
  assert.strictEqual(result!.plans[0]!.discountPercent, null);
  assert.strictEqual(result!.plans[0]!.lateEnrollmentDiscount, false);
});

await run('planDurationSortKey prefers duration_days', () => {
  assert.ok(planDurationSortKey(geoPrice({ id: 1, name: 'Six months', amount: 1, durationDays: 180 }))
    > planDurationSortKey(geoPrice({ id: 2, name: 'Three months', amount: 1, durationDays: 90 })));
});

await run('India visitor sees INR with charged-as USD; amount stays USD', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    offerRule: null,
    countryCode: 'IN',
    fxRates: { INR: 83 },
    prices: [
      geoPrice({ id: 10, name: 'Full access', amount: 89, durationDays: 365 }),
    ],
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.currency, 'USD');
  assert.strictEqual(result!.amount, 89);
  assert.strictEqual(result!.displayCurrency, 'INR');
  assert.strictEqual(result!.fxApplied, true);
  assert.strictEqual(result!.formattedChargeUsd, 'Charged as $89 USD');
  assert.match(result!.formatted, /7,390|₹/);
  assert.strictEqual(result!.plans[0]!.effectiveAmount, 89);
});

await run('Pakistan visitor sees PKR; US visitor stays on USD', async () => {
  const pk = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    offerRule: null,
    countryCode: 'PK',
    fxRates: { PKR: 278 },
    prices: [geoPrice({ id: 10, name: 'Full access', amount: 89, durationDays: 365 })],
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(pk);
  assert.strictEqual(pk!.displayCurrency, 'PKR');
  assert.strictEqual(pk!.fxApplied, true);
  assert.strictEqual(pk!.formattedChargeUsd, 'Charged as $89 USD');
  assert.strictEqual(pk!.amount, 89);

  const us = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    offerRule: null,
    countryCode: 'US',
    fxRates: { INR: 83 },
    prices: [geoPrice({ id: 10, name: 'Full access', amount: 89, durationDays: 365 })],
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(us);
  assert.strictEqual(us!.displayCurrency, 'USD');
  assert.strictEqual(us!.fxApplied, false);
  assert.strictEqual(us!.formattedChargeUsd, null);
  assert.strictEqual(us!.formatted, '$89');
});

await run('missing FX rate falls back to USD', async () => {
  const result = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cima',
    courseName: 'CIMA',
    offerRule: null,
    countryCode: 'IN',
    fxRates: {},
    prices: [geoPrice({ id: 10, name: 'Full access', amount: 89, durationDays: 365 })],
  }, new Date('2026-08-15T12:00:00'));

  assert.ok(result);
  assert.strictEqual(result!.displayCurrency, 'USD');
  assert.strictEqual(result!.fxApplied, false);
  assert.strictEqual(result!.formatted, '$89');
});

await run('resolveDisplayCountry prefers Evendeals quoted country', () => {
  assert.strictEqual(resolveDisplayCountry('US', [{ geoRegionCode: 'PK' }]), 'PK');
  assert.strictEqual(resolveDisplayCountry('IN', [{ geoRegionCode: null }]), 'IN');
  assert.strictEqual(resolveDisplayCountry(null, [{ geoRegionCode: null }]), null);
});

function samplePlan(amount = 100): PublishedCoursePricePlan {
  return {
    id: 1,
    coursePriceId: 1,
    planName: 'Four months',
    sessionTitle: 'December 2026 session',
    sessionMonth: 12,
    sessionYear: 2026,
    subtitle: 'Complete course with tutor support',
    amount,
    compareAt: null,
    discountPercent: null,
    effectiveAmount: amount,
    formatted: `$${amount}`,
    formattedCompareAt: null,
    formattedChargeUsd: null,
    displayAmount: amount,
    displayCurrency: 'USD',
    fxApplied: false,
    lateEnrollmentDiscount: false,
    isDefault: true,
    badge: null,
    geoPricingApplied: false,
    geoRegionCode: null,
    isVpn: false,
  };
}

function dealQuote(partial: Partial<EvenDealsQuote>): EvenDealsQuote {
  return {
    discountPercentage: 40,
    countryCode: 'TR',
    couponCode: null,
    isVpn: false,
    blockVpn: true,
    raw: null,
    ...partial,
  };
}

await run('discounted dollar price rounds up to the next multiple of 5', () => {
  const priced = applyVisitorDealToPlan(
    samplePlan(150),
    dealQuote({ discountPercentage: 45 }),
    'TR',
    false,
  );
  assert.strictEqual(priced.effectiveAmount, 85);
  assert.strictEqual(priced.discountPercent, 45);
  assert.strictEqual(priced.compareAt, 150);
});

await run('Evendeals discount percent is kept for the price card', () => {
  const priced = applyVisitorDealToPlan(samplePlan(100), dealQuote({}), 'TR', false);
  assert.strictEqual(priced.discountPercent, 40);
  assert.strictEqual(priced.effectiveAmount, 60);
  assert.strictEqual(priced.geoPricingApplied, true);
  assert.strictEqual(priced.isVpn, false);
  assert.strictEqual(priced.compareAt, 100);
});

await run('VPN visitors keep the flag and lose the discount when the deal blocks VPNs', () => {
  const priced = applyVisitorDealToPlan(
    samplePlan(100),
    dealQuote({ isVpn: true, blockVpn: true }),
    'TR',
    false,
  );
  assert.strictEqual(priced.isVpn, true);
  assert.strictEqual(priced.discountPercent, null);
  assert.strictEqual(priced.effectiveAmount, 100);
  assert.strictEqual(priced.geoPricingApplied, false);
});

await run('CMA Part 1 and Part 2 packs show One Year Access', async () => {
  const asOf = new Date('2026-11-12T12:00:00');
  const packPrices = [
    geoPrice({
      id: 1,
      name: 'Gold Pack',
      priceSubtitle: 'Vertex Course with Tutor Support',
      amount: 260,
      durationDays: 365,
      isDefault: true,
      courseSlug: 'cma1clp',
      courseName: 'Complete Learning Pack - CMA Part 1',
    }),
    geoPrice({
      id: 2,
      name: 'Platinum Pack',
      priceSubtitle: 'Vertex Course with Hock Access',
      amount: 349,
      durationDays: 365,
      courseSlug: 'cma1clp',
      courseName: 'Complete Learning Pack - CMA Part 1',
    }),
  ];

  const part1 = await buildCourseDisplayPricing({
    zenlerCourseId: '31679',
    courseSlug: 'cma1clp',
    courseName: 'Complete Learning Pack - CMA Part 1',
    qualification: 'CMA',
    offerRule: null,
    prices: packPrices,
  }, asOf);

  assert.ok(part1);
  assert.strictEqual(part1!.plans[0]!.sessionTitle, 'One Year Access');
  assert.strictEqual(part1!.plans[0]!.planName, 'Gold Pack');
  assert.strictEqual(part1!.plans[0]!.subtitle, 'Vertex Course with Tutor Support');
  assert.strictEqual(part1!.plans[0]!.sessionMonth, null);
  assert.strictEqual(part1!.plans[0]!.sessionYear, null);
  assert.strictEqual(part1!.plans[1]!.sessionTitle, 'One Year Access');
  assert.strictEqual(part1!.plans[1]!.planName, 'Platinum Pack');
  assert.strictEqual(part1!.plans[1]!.subtitle, 'Vertex Course with Hock Access');
  assert.strictEqual(part1!.plans[1]!.sessionMonth, null);
  assert.strictEqual(part1!.plans[1]!.badge, 'Best value');

  const part2 = await buildCourseDisplayPricing({
    zenlerCourseId: '31681',
    courseSlug: 'cma2clp',
    courseName: 'Complete Learning Pack - CMA Part 2',
    qualification: 'CMA',
    offerRule: null,
    prices: packPrices.map(price => ({
      ...price,
      courseSlug: 'cma2clp',
      courseName: 'Complete Learning Pack - CMA Part 2',
    })),
  }, asOf);

  assert.ok(part2);
  assert.strictEqual(part2!.plans[0]!.sessionTitle, 'One Year Access');
  assert.strictEqual(part2!.plans[1]!.sessionTitle, 'One Year Access');
  assert.strictEqual(part2!.plans[0]!.sessionMonth, null);

  const byName = await buildCourseDisplayPricing({
    zenlerCourseId: '31679',
    courseSlug: null,
    courseName: 'Complete Learning Pack - CMA Part 1',
    qualification: 'CMA',
    offerRule: null,
    prices: packPrices,
  }, asOf);
  assert.strictEqual(byName!.plans[0]!.sessionTitle, 'One Year Access');
  assert.strictEqual(byName!.plans[1]!.sessionMonth, null);

  assert.strictEqual(displayedExamSessionForPrice(packPrices, null, 1, 1, asOf), null);
  assert.strictEqual(displayedExamSessionForPrice(packPrices, accaRule(), 1, 2, asOf), null);

  const revision = await buildCourseDisplayPricing({
    zenlerCourseId: '1',
    courseSlug: 'cma1rev',
    courseName: 'CMA Part 1 - Revisions Course',
    qualification: 'CMA',
    offerRule: null,
    prices: [
      geoPrice({ id: 3, name: 'Six months', amount: 80, durationDays: 180 }),
      geoPrice({ id: 4, name: 'Annual', amount: 120, durationDays: 365, isDefault: true }),
    ],
  }, asOf);
  assert.strictEqual(revision!.plans[0]!.sessionTitle, 'December 2026 session');
  assert.strictEqual(revision!.plans[1]!.sessionTitle, 'March 2027 session');
});

await run('VPN visitors with no country discount still carry the flag', () => {
  const priced = applyVisitorDealToPlan(
    samplePlan(100),
    dealQuote({ discountPercentage: 0, isVpn: true }),
    'US',
    false,
  );
  assert.strictEqual(priced.isVpn, true);
  assert.strictEqual(priced.discountPercent, null);
  assert.strictEqual(priced.effectiveAmount, 100);
});

console.log('All courseDisplayPricing tests passed.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
