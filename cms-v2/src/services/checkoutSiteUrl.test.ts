import assert from 'assert';
import { defaultCheckoutSiteUrl, resolveCheckoutSiteUrl } from './checkoutSiteUrl';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('checkoutSiteUrl tests');

const previousPublicSiteUrl = process.env.PUBLIC_SITE_URL;
process.env.PUBLIC_SITE_URL = 'https://vls-online.com';

run('falls back to PUBLIC_SITE_URL when origin is missing or invalid', () => {
  assert.strictEqual(resolveCheckoutSiteUrl(undefined), 'https://vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl(''), 'https://vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('not-a-url'), 'https://vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('https://evil.example'), 'https://vls-online.com');
});

run('allows known VLS hosts including prod.vls-online.com', () => {
  assert.strictEqual(resolveCheckoutSiteUrl('https://prod.vls-online.com'), 'https://prod.vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('https://prod.vls-online.com/'), 'https://prod.vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('https://staging.vls-online.com'), 'https://staging.vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('https://www.vls-online.com'), 'https://www.vls-online.com');
  assert.strictEqual(resolveCheckoutSiteUrl('https://vls-online.com'), 'https://vls-online.com');
});

run('allows local http only for localhost', () => {
  assert.strictEqual(resolveCheckoutSiteUrl('http://localhost:3000'), 'http://localhost:3000');
  assert.strictEqual(resolveCheckoutSiteUrl('http://prod.vls-online.com'), 'https://vls-online.com');
});

run('defaultCheckoutSiteUrl strips trailing slash', () => {
  process.env.PUBLIC_SITE_URL = 'https://vls-online.com/';
  assert.strictEqual(defaultCheckoutSiteUrl(), 'https://vls-online.com');
});

if (previousPublicSiteUrl === undefined) {
  delete process.env.PUBLIC_SITE_URL;
} else {
  process.env.PUBLIC_SITE_URL = previousPublicSiteUrl;
}
