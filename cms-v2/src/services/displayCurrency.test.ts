import assert from 'assert';
import {
  currencyForCountry,
  formatDisplayMoney,
  localizeDisplayMoney,
  normalizeCountryCode,
  presentCheckoutAmount,
} from './displayCurrency';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('displayCurrency tests');

run('maps India and Pakistan to local currency', () => {
  assert.strictEqual(currencyForCountry('IN'), 'INR');
  assert.strictEqual(currencyForCountry('in'), 'INR');
  assert.strictEqual(currencyForCountry('PK'), 'PKR');
  assert.strictEqual(normalizeCountryCode('UK'), 'GB');
  assert.strictEqual(currencyForCountry('UK'), 'GBP');
  assert.strictEqual(currencyForCountry('DE'), 'EUR');
  assert.strictEqual(currencyForCountry('US'), 'USD');
  assert.strictEqual(currencyForCountry('XX'), 'USD');
  assert.strictEqual(currencyForCountry(null), 'USD');
});

run('formats INR without paise when a local amount is already known', () => {
  const formatted = formatDisplayMoney(7390, 'INR');
  assert.match(formatted, /7,390/);
  assert.ok(!formatted.includes('.'), formatted);
});

run('keeps USD cents when present', () => {
  assert.strictEqual(formatDisplayMoney(89.5, 'USD'), '$89.50');
  assert.strictEqual(formatDisplayMoney(89, 'USD'), '$89');
});

run('localizeDisplayMoney keeps the dollar amount for every country', () => {
  const missing = localizeDisplayMoney(89, 120, 'INR', null);
  assert.strictEqual(missing.displayCurrency, 'USD');
  assert.strictEqual(missing.fxApplied, false);
  assert.strictEqual(missing.formattedChargeUsd, null);
  assert.strictEqual(missing.fxNote, null);
  assert.strictEqual(missing.formatted, '$89');
  assert.strictEqual(missing.formattedCompareAt, '$120');

  const india = localizeDisplayMoney(89.5, 120, 'INR', 83);
  assert.strictEqual(india.displayCurrency, 'USD');
  assert.strictEqual(india.fxApplied, false);
  assert.strictEqual(india.formatted, '$89.50');
  assert.strictEqual(india.formattedCompareAt, '$120');
});

run('keeps a checkout amount in its catalogue currency', () => {
  const gbp = presentCheckoutAmount({
    amount: 220,
    currency: 'USD',
    countryCode: 'GB',
    rates: { GBP: 0.8 },
  });
  assert.deepStrictEqual(gbp, { amount: 220, currency: 'USD' });

  const usd = presentCheckoutAmount({
    amount: 220,
    currency: 'USD',
    countryCode: 'US',
    rates: { GBP: 0.8 },
  });
  assert.deepStrictEqual(usd, { amount: 220, currency: 'USD' });

  const missing = presentCheckoutAmount({
    amount: 220,
    currency: 'USD',
    countryCode: 'GB',
    rates: null,
  });
  assert.deepStrictEqual(missing, { amount: 220, currency: 'USD' });

  const alreadyLocal = presentCheckoutAmount({
    amount: 90,
    currency: 'GBP',
    countryCode: 'DE',
    rates: { EUR: 0.9 },
  });
  assert.deepStrictEqual(alreadyLocal, { amount: 90, currency: 'GBP' });
});

console.log('All displayCurrency tests passed.');
