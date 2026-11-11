import assert from 'assert';
import { priceWriteFailure } from './coursePriceWriteError';

const slot = Object.assign(new Error('duplicate key value violates unique constraint "course_geo_prices_active_slot_idx"'), {
  code: '23505',
  constraint: 'course_geo_prices_active_slot_idx',
});

const slotMessage = priceWriteFailure(slot, 365);
assert.strictEqual(slotMessage.status, 409);
assert.strictEqual(
  slotMessage.error,
  'This course already has an active price for 365 days. Deactivate that price or choose a different duration.',
);

const wrapped = priceWriteFailure({
  message: 'query failed',
  cause: { code: '23505', constraint: 'course_geo_prices_zenler_pricing_code_idx' },
});
assert.strictEqual(wrapped.status, 409);
assert.match(wrapped.error, /Zenler pricing code/);

const check = priceWriteFailure({
  code: '23514',
  constraint: 'course_geo_prices_discounted_price_valid',
  message: 'check constraint',
});
assert.strictEqual(check.status, 400);
assert.match(check.error, /discounted price/);

const unexpected = priceWriteFailure(new Error('column "price_subtitle" does not exist'));
assert.strictEqual(unexpected.status, 500);
assert.strictEqual(unexpected.error, 'column "price_subtitle" does not exist');

const empty = priceWriteFailure('nope');
assert.strictEqual(empty.status, 500);
assert.strictEqual(empty.error, 'The price could not be saved.');

console.log('coursePriceWriteError.test.ts passed');
