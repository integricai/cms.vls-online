import assert from 'assert';
import { buildSessionCookie, VAULT_SESSION_COOKIE } from './vaultSession';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

console.log('vault session tests');

run('localhost cookie stays on this host and lasts a day', () => {
  const cookie = buildSessionCookie('abc.def', 'localhost:3001');
  assert.ok(cookie.startsWith(`${VAULT_SESSION_COOKIE}=abc.def`));
  assert.ok(cookie.includes('HttpOnly'));
  assert.ok(cookie.includes('SameSite=Lax'));
  assert.ok(cookie.includes('Max-Age=86400'));
  assert.ok(!cookie.includes('Secure'));
  assert.ok(!cookie.includes('Domain='));
});

run('production cookie is shared by the vault site and the api host', () => {
  const cookie = buildSessionCookie('abc.def', 'api.cms.vls-online.com');
  assert.ok(cookie.includes('Secure'));
  assert.ok(cookie.includes('Domain=.cms.vls-online.com'));
  assert.ok(cookie.includes('HttpOnly'));
});

console.log('vault session tests ok');
