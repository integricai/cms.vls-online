import assert from 'assert';
import {
  BANK_FX_NOTE,
  convertUsdAmount,
  currencyForCountry,
  formatChargedAsUsd,
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

run('converts and formats INR without paise', () => {
  const amount = convertUsdAmount(89, 83);
  assert.strictEqual(amount, 7387);
  const formatted = formatDisplayMoney(amount, 'INR');
  assert.match(formatted, /7,387/);
  assert.ok(!formatted.includes('.'), formatted);
});

run('keeps USD cents when present', () => {
  assert.strictEqual(formatDisplayMoney(89.5, 'USD'), '$89.50');
  assert.strictEqual(formatDisplayMoney(89, 'USD'), '$89');
});

run('localizeDisplayMoney keeps USD when rate is missing', () => {
  const localized = localizeDisplayMoney(89, 120, 'INR', null);
  assert.strictEqual(localized.displayCurrency, 'USD');
  assert.strictEqual(localized.fxApplied, false);
  assert.strictEqual(localized.formattedChargeUsd, null);
  assert.strictEqual(localized.formatted, '$89');
  assert.strictEqual(localized.formattedCompareAt, '$120');
});

run('localizeDisplayMoney shows local price plus charged-as USD', () => {
  const localized = localizeDisplayMoney(89, 120, 'INR', 83);
  assert.strictEqual(localized.displayCurrency, 'INR');
  assert.strictEqual(localized.fxApplied, true);
  assert.strictEqual(localized.fxNote, BANK_FX_NOTE);
  assert.strictEqual(localized.formattedChargeUsd, formatChargedAsUsd(89));
  assert.strictEqual(localized.formattedChargeUsd, 'Charged as $89 USD');
  assert.match(localized.formatted, /7,387|₹/);
  assert.match(localized.formattedCompareAt ?? '', /9,960|₹/);
});

run('charges payment-first checkout in the visitor currency', () => {
  const gbp = presentCheckoutAmount({
    amount: 220,
    currency: 'USD',
    countryCode: 'GB',
    rates: { GBP: 0.8 },
  });
  assert.deepStrictEqual(gbp, { amount: 176, currency: 'GBP' });

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
