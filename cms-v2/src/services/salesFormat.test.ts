import assert from 'assert';
import {
  addCrossCurrencyEarnings,
  addIsoDays,
  dashboardRangeBounds,
  percentChange,
  foldTotalsToUsd,
  formatVaultPrice,
  pickDashboardCurrency,
  saleSessionLabel,
  salesPresetBounds,
  shiftMonth,
} from '../../shared/salesFormat';
import {
  sessionAccessDayCount,
  sessionAccessEndsAt,
  sessionSaleLabel,
  parseSessionLabel,
} from '../../shared/sessionAccess';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('salesFormat tests');

run('adds days across a month boundary', () => {
  assert.strictEqual(addIsoDays('2026-10-30', 3), '2026-11-02');
});

run('clamps the same day last month to the shorter month', () => {
  assert.strictEqual(shiftMonth('2026-03-31', -1), '2026-02-28');
});

run('this month runs from the first through today', () => {
  assert.deepStrictEqual(dashboardRangeBounds('this_month', '2026-10-25'), {
    start: '2026-10-01',
    end: '2026-10-25',
  });
});

run('last month is the full previous month', () => {
  assert.deepStrictEqual(dashboardRangeBounds('last_month', '2026-10-25'), {
    start: '2026-09-01',
    end: '2026-09-30',
  });
});

run('percent change is null when the earlier period was empty', () => {
  assert.strictEqual(percentChange(10, 0), null);
  assert.strictEqual(percentChange(0, 0), 0);
  assert.strictEqual(percentChange(110, 100), 10);
});

run('adds a foreign settlement onto the currency Stripe actually paid', () => {
  const rows = addCrossCurrencyEarnings(
    [
      { date: '2026-10-28', currency: 'usd', count: 2, gross: 157.5, earnings: 151.93 },
      { date: '2026-10-28', currency: 'SAR', count: 1, gross: 335.25, earnings: 0 },
    ],
    [{ date: '2026-10-28', currency: 'usd', earnings: 84.44 }],
  );
  const dollars = rows.find(row => row.currency === 'USD' && row.date === '2026-10-28');
  const riyals = rows.find(row => row.currency === 'SAR');
  assert.strictEqual(dollars?.earnings, 236.37);
  assert.strictEqual(dollars?.gross, 157.5);
  assert.strictEqual(riyals?.earnings, 0);
  assert.strictEqual(riyals?.count, 1);
});

run('keeps earnings for a settlement currency that had no sale of its own', () => {
  const rows = addCrossCurrencyEarnings(
    [{ date: '2026-10-28', currency: 'EUR', count: 1, gross: 62.82, earnings: 0 }],
    [{ date: '2026-10-28', currency: 'USD', earnings: 66.45 }],
  );
  const dollars = rows.find(row => row.currency === 'USD');
  assert.deepStrictEqual(dollars, {
    date: '2026-10-28',
    currency: 'USD',
    count: 0,
    gross: 0,
    earnings: 66.45,
  });
});

run('picks the currency with the most sales, not the largest nominal total', () => {
  const rows = [
    { currency: 'TRY', count: 2, date: '2026-10-20' },
    { currency: 'USD', count: 19, date: '2026-10-20' },
  ];
  assert.strictEqual(pickDashboardCurrency(rows, '2026-10-01', '2026-10-25'), 'USD');
});

run('sales presets use London days, with last week as the last 7 days', () => {
  assert.deepStrictEqual(salesPresetBounds('today', '2026-10-28'), {
    start: '2026-10-28',
    end: '2026-10-28',
  });
  assert.deepStrictEqual(salesPresetBounds('yesterday', '2026-10-28'), {
    start: '2026-10-27',
    end: '2026-10-27',
  });
  assert.deepStrictEqual(salesPresetBounds('last_week', '2026-10-28'), {
    start: '2026-10-22',
    end: '2026-10-28',
  });
  assert.deepStrictEqual(salesPresetBounds('last_month', '2026-10-28'), {
    start: '2026-09-01',
    end: '2026-09-30',
  });
  assert.deepStrictEqual(salesPresetBounds('last_year', '2026-10-28'), {
    start: '2025-01-01',
    end: '2025-12-31',
  });
});

run('folds a pound day into the dollar total', () => {
  const rows = foldTotalsToUsd(
    [
      { date: '2026-10-28', currency: 'USD', count: 2, gross: 200, earnings: 190 },
      { date: '2026-10-28', currency: 'GBP', count: 1, gross: 80, earnings: 76 },
    ],
    { GBP: 0.8 },
  );
  assert.deepStrictEqual(rows, [{
    date: '2026-10-28',
    currency: 'USD',
    count: 3,
    gross: 300,
    earnings: 285,
  }]);
});

run('shows the local price and the dollar charge together', () => {
  assert.strictEqual(formatVaultPrice({
    amount: 61,
    currency: 'USD',
    presentmentAmount: 48.82,
    presentmentCurrency: 'GBP',
  }), '£48.82 (US$61.00)');
  assert.strictEqual(formatVaultPrice({ amount: 61, currency: 'USD' }), 'US$61.00');
});

run('session label keeps the month length and the valid-to date', () => {
  assert.strictEqual(
    saleSessionLabel(180, '2027-04-25T12:00:00.000Z'),
    '6 months · valid to 25 Apr 2027',
  );
  assert.strictEqual(
    saleSessionLabel(120, '2027-02-25T12:00:00.000Z'),
    '4 months · valid to 25 Feb 2027',
  );
});

run('exam sitting label is the month and year', () => {
  assert.strictEqual(sessionSaleLabel(12, 2026), 'Dec 2026');
  assert.strictEqual(sessionSaleLabel(3, 2027), 'March 2027');
  assert.strictEqual(
    saleSessionLabel(90, '2026-12-15T23:59:59.999Z', 12, 2026),
    'Dec 2026',
  );
});

run('a stored plan name can name the sitting', () => {
  assert.deepStrictEqual(parseSessionLabel('December 2026 session'), { month: 12, year: 2026 });
  assert.deepStrictEqual(parseSessionLabel('Dec 2026'), { month: 12, year: 2026 });
  assert.deepStrictEqual(parseSessionLabel('March 2027'), { month: 3, year: 2027 });
  assert.strictEqual(parseSessionLabel('Three months'), null);
  assert.strictEqual(parseSessionLabel('12 months access – launch offer May 2025'), null);
});

run('access runs from the purchase date to the 15th', () => {
  const sold = new Date('2026-10-30T12:00:00.000Z');
  assert.strictEqual(sessionAccessDayCount(sold, 12, 2026), 46);
  assert.strictEqual(sessionAccessEndsAt(12, 2026).toISOString(), '2026-12-15T23:59:59.999Z');
  assert.strictEqual(sessionAccessEndsAt(3, 2027).toISOString(), '2027-03-15T23:59:59.999Z');
  assert.strictEqual(sessionAccessEndsAt(9, 2026).toISOString(), '2026-09-15T22:59:59.999Z');
  const onTheFifteenth = new Date('2026-12-15T12:00:00.000Z');
  assert.strictEqual(sessionAccessDayCount(onTheFifteenth, 12, 2026), 0);
  assert.ok(sessionAccessEndsAt(12, 2026).getTime() > onTheFifteenth.getTime());
});
