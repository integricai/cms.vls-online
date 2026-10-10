import assert from 'assert';
import {
  comboDiscountedAmount,
  ComboBundlePriceError,
  quoteComboCharge,
  resolveComboDiscountPercent,
  sharedComboSessions,
  type ComboPlanAmount,
} from './comboBundlePrice';

function plan(partial: Partial<ComboPlanAmount> & Pick<ComboPlanAmount, 'amount'>): ComboPlanAmount {
  return {
    sessionMonth: null,
    sessionYear: null,
    sessionTitle: 'Full access',
    isDefault: true,
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

console.log('comboBundlePrice tests');

run('35% off a summed total rounds to cents', () => {
  assert.strictEqual(comboDiscountedAmount(180), 117);
  assert.strictEqual(comboDiscountedAmount(99.98), 64.99);
});

run('custom discount percent applies to the list total', () => {
  assert.strictEqual(comboDiscountedAmount(200, 20), 160);
  const quote = quoteComboCharge([[plan({ amount: 100 })], [plan({ amount: 100 })]], null, 20);
  assert.strictEqual(quote.discountPercent, 20);
  assert.strictEqual(quote.chargeAmountUsd, 160);
});

run('a Storyblok discount of 0 charges the full list total', () => {
  assert.strictEqual(resolveComboDiscountPercent(0), 0);
  assert.strictEqual(resolveComboDiscountPercent('0'), 0);
  assert.strictEqual(resolveComboDiscountPercent(''), 35);
  assert.strictEqual(comboDiscountedAmount(180, 0), 180);
  const quote = quoteComboCharge([[plan({ amount: 15 })], [plan({ amount: 15 })]], null, 0);
  assert.strictEqual(quote.discountPercent, 0);
  assert.strictEqual(quote.listAmountUsd, 30);
  assert.strictEqual(quote.chargeAmountUsd, 30);
});

run('Evendeals is ignored and 35% comes off the catalogue price', () => {
  const paper = plan({
    amount: 130,
    effectiveAmount: 91,
    displayAmount: 68.84,
    displayCurrency: 'GBP',
    fxApplied: true,
  });
  const quote = quoteComboCharge([[paper], [{ ...paper }]], null);
  assert.strictEqual(quote.listAmountUsd, 260);
  assert.strictEqual(quote.chargeAmountUsd, 169);
  assert.strictEqual(quote.listAmount, 196.68);
  assert.strictEqual(quote.chargeAmount, 127.84);
  assert.strictEqual(quote.chargeCurrency, 'GBP');
});

run('courses without sessions sum their default prices', () => {
  const quote = quoteComboCharge([
    [plan({ amount: 100, isDefault: true }), plan({ amount: 140, isDefault: false, sessionTitle: 'Annual' })],
    [plan({ amount: 80 })],
  ], { month: 12, year: 2026 });
  assert.strictEqual(quote.listAmountUsd, 180);
  assert.strictEqual(quote.chargeAmountUsd, 117);
  assert.strictEqual(quote.discountPercent, 35);
  assert.strictEqual(quote.sessionTitle, null);
});

run('session prices are summed for the sitting the student picks', () => {
  const december = plan({
    amount: 100,
    sessionMonth: 12,
    sessionYear: 2026,
    sessionTitle: 'December 2026 session',
    isDefault: true,
  });
  const march = plan({
    amount: 80,
    sessionMonth: 3,
    sessionYear: 2027,
    sessionTitle: 'March 2027 session',
    isDefault: false,
  });
  const open = plan({ amount: 50, sessionTitle: 'On demand' });
  const quote = quoteComboCharge([[december, march], [open]], { month: 3, year: 2027 });
  assert.strictEqual(quote.listAmountUsd, 130);
  assert.strictEqual(quote.chargeAmountUsd, 84.5);
  assert.strictEqual(quote.sessionTitle, 'March 2027 session');
  assert.deepStrictEqual(
    sharedComboSessions([[december, march], [open]]).map(item => item.month),
    [12, 3],
  );
});

run('session titles without month/year still count as sittings', () => {
  const quote = quoteComboCharge([
    [
      plan({ amount: 220, sessionTitle: 'December 2026 session' }),
      plan({ amount: 250, sessionTitle: 'March 2027 session' }),
    ],
    [
      plan({ amount: 220, sessionTitle: 'December 2026 session' }),
      plan({ amount: 260, sessionTitle: 'March 2027 session' }),
    ],
  ], { month: 3, year: 2027 });
  assert.strictEqual(quote.listAmountUsd, 510);
  assert.strictEqual(quote.chargeAmountUsd, 331.5);
});

run('only sittings shared by every session course are offered', () => {
  const sessions = sharedComboSessions([
    [
      plan({ amount: 1, sessionMonth: 12, sessionYear: 2026, sessionTitle: 'December 2026 session' }),
      plan({ amount: 1, sessionMonth: 3, sessionYear: 2027, sessionTitle: 'March 2027 session' }),
    ],
    [
      plan({ amount: 1, sessionMonth: 3, sessionYear: 2027, sessionTitle: 'March 2027 session' }),
    ],
  ]);
  assert.deepStrictEqual(sessions.map(item => `${item.month}-${item.year}`), ['3-2027']);
});

run('an unknown sitting falls back to the earliest shared session', () => {
  const quote = quoteComboCharge([
    [plan({ amount: 40, sessionMonth: 12, sessionYear: 2026, sessionTitle: 'December 2026 session' })],
    [plan({ amount: 40, sessionMonth: 12, sessionYear: 2026, sessionTitle: 'December 2026 session' })],
  ], { month: 6, year: 2027 });
  assert.strictEqual(quote.sessionTitle, 'December 2026 session');
  assert.strictEqual(quote.chargeAmountUsd, 52);
});

run('missing sitting picks the earliest shared session automatically', () => {
  const quote = quoteComboCharge([
    [
      plan({ amount: 100, sessionMonth: 12, sessionYear: 2026, sessionTitle: 'December 2026 session', isDefault: true }),
      plan({ amount: 80, sessionMonth: 3, sessionYear: 2027, sessionTitle: 'March 2027 session' }),
    ],
    [plan({ amount: 50 })],
  ], null);
  assert.strictEqual(quote.sessionTitle, 'December 2026 session');
  assert.strictEqual(quote.listAmountUsd, 150);
});

run('fewer than two courses is rejected', () => {
  assert.throws(
    () => quoteComboCharge([[plan({ amount: 40 })]], null),
    (err: unknown) => err instanceof ComboBundlePriceError,
  );
});

console.log('comboBundlePrice tests passed');
