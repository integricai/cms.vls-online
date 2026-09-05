import assert from 'assert';
import {
  BANK_FX_NOTE,
  convertUsdAmount,
  currencyForCountry,
  formatChargedAsUsd,
  formatDisplayMoney,
  localizeDisplayMoney,
  normalizeCountryCode,
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

console.log('All displayCurrency tests passed.');
