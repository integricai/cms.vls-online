import assert from 'node:assert/strict';
import {
  applyRetakeDiscount,
  normalizeRetakeCode,
  parseRetakeDiscount,
  retakeEmailsMatch,
} from './retakeDiscountMath';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`fail ${name}`);
    throw err;
  }
}

run('normalizes a typed code', () => {
  assert.equal(normalizeRetakeCode(' rt-7k2m '), 'RT-7K2M');
});

run('matches the issued email ignoring case', () => {
  assert.equal(retakeEmailsMatch('Ada@Vls-Online.com', 'ada@vls-online.com'), true);
  assert.equal(retakeEmailsMatch('ada@vls-online.com', 'other@vls-online.com'), false);
});

run('applies a percent to the catalogue price', () => {
  assert.equal(applyRetakeDiscount(200, 'percent', 25), 150);
});

run('applies a fixed amount to the catalogue price', () => {
  assert.equal(applyRetakeDiscount(200, 'fixed', 40), 160);
});

run('rejects a discount that leaves nothing to charge', () => {
  assert.equal(applyRetakeDiscount(200, 'percent', 100), null);
  assert.equal(applyRetakeDiscount(20, 'fixed', 20), null);
});

run('rejects a percent of 100 at issue time', () => {
  const parsed = parseRetakeDiscount({ discountType: 'percent', discountValue: 100 });
  assert.equal('error' in parsed, true);
});

console.log('retake discount math ok');
