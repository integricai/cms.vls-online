import assert from 'assert';
import { selectUsdRates } from './fxRates';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const rates = { USD: 1, GBP: 0.8 };
const now = 1_700_000_000_000;
const hour = 60 * 60 * 1000;

console.log('fxRates tests');

run('uses a fresh cache without a new fetch', () => {
  assert.strictEqual(selectUsdRates({ rates, fetchedAt: now - hour }, null, now), rates);
});

run('keeps the last good rates when a refresh fails', () => {
  const cached = { rates, fetchedAt: now - 7 * hour };
  assert.strictEqual(selectUsdRates(cached, null, now), rates);
});

run('drops rates that have been stale for more than a day', () => {
  const cached = { rates, fetchedAt: now - 31 * hour };
  assert.strictEqual(selectUsdRates(cached, null, now), null);
});

run('stores a successful fetch', () => {
  const next = { USD: 1, GBP: 0.79 };
  assert.strictEqual(selectUsdRates({ rates, fetchedAt: now - 7 * hour }, next, now), next);
});

console.log('fxRates tests passed');
