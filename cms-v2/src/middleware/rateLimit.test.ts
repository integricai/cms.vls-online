import assert from 'node:assert/strict';
import { nextRateLimitState } from './rateLimitState';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('rate limit tests');

run('opens a new window on the first hit', () => {
  const now = 1_000_000;
  const result = nextRateLimitState(null, now, 60_000, 3);
  assert.equal(result.allowed, true);
  assert.equal(result.hitCount, 1);
  assert.equal(result.windowStartedAt, now);
});

run('counts hits inside the current window', () => {
  const now = 1_000_000;
  const result = nextRateLimitState({ windowStartedAt: now, hitCount: 2 }, now + 1_000, 60_000, 3);
  assert.equal(result.allowed, true);
  assert.equal(result.hitCount, 3);
  assert.equal(result.windowStartedAt, now);
});

run('rejects the hit that exceeds the limit', () => {
  const now = 1_000_000;
  const result = nextRateLimitState({ windowStartedAt: now, hitCount: 3 }, now + 1_000, 60_000, 3);
  assert.equal(result.allowed, false);
  assert.equal(result.hitCount, 4);
  assert.equal(result.retryAfterSec, 59);
});

run('resets after the window elapses', () => {
  const now = 1_000_000;
  const result = nextRateLimitState({ windowStartedAt: now, hitCount: 8 }, now + 60_000, 60_000, 3);
  assert.equal(result.allowed, true);
  assert.equal(result.hitCount, 1);
  assert.equal(result.windowStartedAt, now + 60_000);
});

console.log('rate limit tests passed');
