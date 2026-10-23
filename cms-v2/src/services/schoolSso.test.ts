import assert from 'node:assert/strict';
import { schoolSsoTokenClaims, schoolSsoUrl } from './schoolSso';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('school SSO');

const previous = process.env.ZENLER_API_KEY;
process.env.ZENLER_API_KEY = 'zenler-test-key';

run('builds a two-minute school sign-in link for the paid student', () => {
  const before = Math.floor(Date.now() / 1000);
  const url = new URL(schoolSsoUrl({
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'Ada@Example.com',
    errorUrl: 'https://staging.vls-online.com/en/payment-success?session_id=cs_test',
  }));
  assert.equal(url.origin + url.pathname, 'https://school.vls-online.com/api/sso/v1');
  const token = url.searchParams.get('token') ?? '';
  const claims = schoolSsoTokenClaims(token, 'zenler-test-key');
  assert.equal(claims.first_name, 'Ada');
  assert.equal(claims.last_name, 'Lovelace');
  assert.equal(claims.email, 'ada@example.com');
  assert.ok((claims.exp ?? 0) >= before + 110);
  assert.ok((claims.exp ?? 0) <= before + 130);
  assert.equal(url.searchParams.get('return_to'), 'https://school.vls-online.com/mycourse');
  assert.equal(url.searchParams.get('error_url'), 'https://staging.vls-online.com/en/payment-success?session_id=cs_test');
});

if (previous === undefined) delete process.env.ZENLER_API_KEY;
else process.env.ZENLER_API_KEY = previous;

console.log('school SSO tests passed');
