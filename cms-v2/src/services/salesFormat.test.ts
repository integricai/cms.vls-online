import assert from 'assert';
import {
  addIsoDays,
  dashboardRangeBounds,
  percentChange,
  pickDashboardCurrency,
  saleSessionLabel,
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

run('picks the currency with the most sales, not the largest nominal total', () => {
  const rows = [
    { currency: 'TRY', count: 2, date: '2026-10-20' },
    { currency: 'USD', count: 19, date: '2026-10-20' },
  ];
  assert.strictEqual(pickDashboardCurrency(rows, '2026-10-01', '2026-10-25'), 'USD');
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
