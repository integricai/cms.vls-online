import assert from 'node:assert/strict';
import {
  discountLinkExpiresAt,
  discountLinkStatus,
  discountOfferLabel,
  discountPayUrl,
  generateDiscountToken,
  hashDiscountToken,
  offeredStripeCharge,
  presentDiscountPrices,
  quoteDiscountedPrice,
  DISCOUNT_LINK_DAYS,
} from './discountPayLink';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`fail ${name}`);
    throw err;
  }
}

run('stores a hash instead of the link token', () => {
  const token = generateDiscountToken();
  const hash = hashDiscountToken(token);
  assert.notEqual(hash, token);
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hashDiscountToken(token), hash);
});

run('rejects a missing, used, or expired link', () => {
  const now = new Date('2026-10-27T12:00:00.000Z');
  assert.equal(discountLinkStatus(null, now), 'invalid');
  assert.equal(discountLinkStatus({ used: true, expiresAt: '2026-11-10T00:00:00.000Z' }, now), 'used');
  assert.equal(discountLinkStatus({ used: false, expiresAt: null }, now), 'expired');
  assert.equal(discountLinkStatus({ used: false, expiresAt: '2026-10-27T12:00:00.000Z' }, now), 'expired');
  assert.equal(discountLinkStatus({ used: false, expiresAt: '2026-10-27T12:00:01.000Z' }, now), 'valid');
});

run('expires fourteen days after it is sent', () => {
  const sent = new Date('2026-10-27T12:00:00.000Z');
  const expires = discountLinkExpiresAt(sent);
  assert.equal(expires.getTime() - sent.getTime(), DISCOUNT_LINK_DAYS * 24 * 60 * 60 * 1000);
});

run('builds the pay link without the price or the email', () => {
  const previous = process.env.DISCOUNT_PAY_BASE_URL;
  process.env.DISCOUNT_PAY_BASE_URL = 'https://staging.vls-online.com/';
  try {
    assert.equal(
      discountPayUrl('abc123'),
      'https://staging.vls-online.com/pay/abc123',
    );
  } finally {
    if (previous == null) delete process.env.DISCOUNT_PAY_BASE_URL;
    else process.env.DISCOUNT_PAY_BASE_URL = previous;
  }
});

run('snapshots the discounted catalogue price in the same currency', () => {
  assert.equal(quoteDiscountedPrice(100, 'percent', 20), 80);
  assert.equal(quoteDiscountedPrice(100, 'fixed', 25), 75);
  assert.equal(quoteDiscountedPrice(100, 'percent', 100), null);
  assert.equal(quoteDiscountedPrice(10, 'fixed', 9.6), null);
});

run('locks the full price and the payable price in the student currency', () => {
  assert.deepEqual(presentDiscountPrices({
    fullAmount: 100,
    finalAmount: 70,
    currency: 'USD',
    countryCode: 'GB',
    rates: { GBP: 0.8 },
  }), { fullAmount: 80, finalAmount: 56, currency: 'GBP' });
});

run('keeps US dollars when the local currency cannot be charged', () => {
  assert.deepEqual(presentDiscountPrices({
    fullAmount: 100,
    finalAmount: 70,
    currency: 'USD',
    countryCode: 'ID',
    rates: { IDR: 16000 },
  }), { fullAmount: 100, finalAmount: 70, currency: 'USD' });
});

run('charges the dollar amount saved with the offer, not a later catalogue price', () => {
  assert.deepEqual(offeredStripeCharge({
    finalAmount: 120,
    currency: 'GBP',
    usdFinalAmount: 150,
  }), {
    amount: 150,
    currency: 'USD',
    presentment: { amount: 120, currency: 'GBP' },
  });
  assert.deepEqual(offeredStripeCharge({
    finalAmount: 150,
    currency: 'USD',
    usdFinalAmount: null,
  }), { amount: 150, currency: 'USD', presentment: null });
});

run('an older local offer keeps the amount from the email', () => {
  assert.deepEqual(offeredStripeCharge({
    finalAmount: 120,
    currency: 'GBP',
    usdFinalAmount: null,
  }), { amount: 120, currency: 'GBP', presentment: null });
});

run('shows the form percent, or the equivalent percent for a fixed discount', () => {
  assert.equal(discountOfferLabel({
    discountType: 'percent',
    discountValue: 30,
    fullAmount: 80,
    payableAmount: 56,
  }), '30%');
  assert.equal(discountOfferLabel({
    discountType: 'fixed',
    discountValue: 25,
    fullAmount: 80,
    payableAmount: 60,
  }), '25%');
});
