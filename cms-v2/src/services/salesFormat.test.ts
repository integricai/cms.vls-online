import assert from 'assert';
import {
  addCrossCurrencyEarnings,
  addIsoDays,
  dashboardRangeBounds,
  percentChange,
  foldTotalsToUsd,
  amountInUsd,
  formatPlainAmount,
  matchesSaleReportQuery,
  formatVaultPrice,
  sumAmountsInUsd,
  pickDashboardCurrency,
  saleListSessionLabel,
  saleSessionLabel,
  salesPresetBounds,
  shiftMonth,
} from '../../shared/salesFormat';

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

run('sales presets use Monday weeks and inclusive recent months', () => {
  assert.deepStrictEqual(salesPresetBounds('today', '2026-10-31'), {
    start: '2026-10-31',
    end: '2026-10-31',
  });
  assert.deepStrictEqual(salesPresetBounds('yesterday', '2026-10-31'), {
    start: '2026-10-30',
    end: '2026-10-30',
  });
  assert.deepStrictEqual(salesPresetBounds('this_week', '2026-10-31'), {
    start: '2026-10-26',
    end: '2026-10-31',
  });
  assert.deepStrictEqual(salesPresetBounds('last_week', '2026-10-31'), {
    start: '2026-10-19',
    end: '2026-10-25',
  });
  assert.deepStrictEqual(salesPresetBounds('this_month', '2026-10-31'), {
    start: '2026-10-01',
    end: '2026-10-31',
  });
  assert.deepStrictEqual(salesPresetBounds('last_month', '2026-10-31'), {
    start: '2026-09-01',
    end: '2026-09-30',
  });
  assert.deepStrictEqual(salesPresetBounds('last_3_months', '2026-10-31'), {
    start: '2026-08-01',
    end: '2026-10-31',
  });
  assert.deepStrictEqual(salesPresetBounds('last_6_months', '2026-10-31'), {
    start: '2026-05-01',
    end: '2026-10-31',
  });
  assert.deepStrictEqual(salesPresetBounds('last_year', '2026-10-31'), {
    start: '2025-01-01',
    end: '2025-12-31',
  });
  assert.deepStrictEqual(salesPresetBounds('this_year', '2026-10-31'), {
    start: '2026-01-01',
    end: '2026-10-31',
  });
  assert.strictEqual(salesPresetBounds('all_time', '2026-10-31'), null);
});

run('a Monday starts a new week and a Sunday closes the current one', () => {
  assert.deepStrictEqual(salesPresetBounds('this_week', '2026-11-02'), {
    start: '2026-11-02',
    end: '2026-11-02',
  });
  assert.deepStrictEqual(salesPresetBounds('last_week', '2026-11-02'), {
    start: '2026-10-26',
    end: '2026-11-01',
  });
  assert.deepStrictEqual(salesPresetBounds('this_week', '2026-11-01'), {
    start: '2026-10-26',
    end: '2026-11-01',
  });
});

run('foreign gross amounts convert into the dollar total', () => {
  assert.strictEqual(amountInUsd(375, 'SAR', { SAR: 3.75 }), 100);
  assert.strictEqual(amountInUsd(80, 'EUR', { EUR: 0.8 }), 100);
  assert.deepStrictEqual(sumAmountsInUsd([
    { amount: 50, currency: 'USD' },
    { amount: 375, currency: 'SAR' },
    { amount: 80, currency: 'EUR' },
  ], { SAR: 3.75, EUR: 0.8 }), {
    usd: 250,
    missingCurrencies: [],
  });
});

run('a currency with no rate is named and left out of the dollar total', () => {
  assert.strictEqual(amountInUsd(10, 'SAR', null), null);
  assert.deepStrictEqual(sumAmountsInUsd([
    { amount: 20, currency: 'USD' },
    { amount: 10, currency: 'SAR' },
  ], null), {
    usd: 20,
    missingCurrencies: ['SAR'],
  });
});

run('a report query matches email, course, country, or session', () => {
  const fields = ['student@gmail.com', 'ACCA FR', 'Oman', 'OM', '6 months · valid to 28 Apr 2027'];
  assert.strictEqual(matchesSaleReportQuery('', fields), true);
  assert.strictEqual(matchesSaleReportQuery('  GMAIL ', fields), true);
  assert.strictEqual(matchesSaleReportQuery('acca', fields), true);
  assert.strictEqual(matchesSaleReportQuery('oman', fields), true);
  assert.strictEqual(matchesSaleReportQuery('om', fields), true);
  assert.strictEqual(matchesSaleReportQuery('apr 2027', fields), true);
  assert.strictEqual(matchesSaleReportQuery('belgium', fields), false);
});

run('plain export amounts keep two decimals and drop the currency sign', () => {
  assert.strictEqual(formatPlainAmount(243.7), '243.70');
  assert.strictEqual(formatPlainAmount(0), '0.00');
  assert.strictEqual(formatPlainAmount(null), '');
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

run('a payment order session is the reason the form was created', () => {
  assert.strictEqual(
    saleListSessionLabel(null, null, 'Student failed exams and requested a resit'),
    'Student failed exams and requested a resit',
  );
  assert.strictEqual(saleListSessionLabel(null, null, '  '), '—');
  assert.strictEqual(
    saleListSessionLabel(180, '2027-04-25T12:00:00.000Z', null),
    '6 months · valid to 25 Apr 2027',
  );
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
