import assert from 'assert';
import type { Request } from 'express';
import { isParityDealsTestAllowed, isParityDealsTestRequest } from './parityDealsTest';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

function withEnv(
  env: {
    CMS_ENV?: string;
    SITE_ENV?: string;
    VERCEL_ENV?: string;
    ALLOW_PARITYDEALS_TEST?: string;
    ALLOW_EVENDEALS_TEST?: string;
  },
  fn: () => void,
): void {
  const keys = ['CMS_ENV', 'SITE_ENV', 'VERCEL_ENV', 'ALLOW_PARITYDEALS_TEST', 'ALLOW_EVENDEALS_TEST'] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) {
    const next = env[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      const prior = previous[key];
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
  }
}

function request(input: {
  header?: string;
  query?: string;
  body?: Record<string, unknown>;
}): Request {
  return {
    get(name: string) {
      return name.toLowerCase() === 'x-vls-parity-test' ? input.header : undefined;
    },
    query: input.query === undefined ? {} : { test: input.query },
    body: input.body ?? {},
  } as Request;
}

console.log('parityDealsTest');

run('production deployment ignores body, header, query, and test env flags', () => {
  withEnv({
    VERCEL_ENV: 'production',
    SITE_ENV: 'staging',
    ALLOW_PARITYDEALS_TEST: 'true',
    ALLOW_EVENDEALS_TEST: 'true',
  }, () => {
    assert.strictEqual(isParityDealsTestAllowed(), false);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { test: 'true' } })), false);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { parityDealsTest: true } })), false);
    assert.strictEqual(isParityDealsTestRequest(request({ header: 'true' })), false);
    assert.strictEqual(isParityDealsTestRequest(request({ query: 'true' })), false);
  });

  withEnv({ CMS_ENV: 'production', ALLOW_PARITYDEALS_TEST: 'true' }, () => {
    assert.strictEqual(isParityDealsTestAllowed(), false);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { test: 'true' } })), false);
  });
});

run('body flags follow the same allow check as header and query', () => {
  withEnv({ ALLOW_PARITYDEALS_TEST: 'true' }, () => {
    assert.strictEqual(isParityDealsTestAllowed(), true);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { test: 'true' } })), true);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { parityDealsTest: true } })), true);
    assert.strictEqual(isParityDealsTestRequest(request({ header: 'true' })), true);
    assert.strictEqual(isParityDealsTestRequest(request({})), false);
  });

  withEnv({}, () => {
    assert.strictEqual(isParityDealsTestAllowed(), false);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { test: 'true' } })), false);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { parityDealsTest: true } })), false);
  });

  withEnv({ SITE_ENV: 'staging' }, () => {
    assert.strictEqual(isParityDealsTestRequest(request({ query: 'true' })), true);
    assert.strictEqual(isParityDealsTestRequest(request({ body: { test: 'TRUE' } })), true);
  });
});

console.log('parityDealsTest passed');
