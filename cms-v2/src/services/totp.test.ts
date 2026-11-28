import assert from 'assert';
import {
  base32Decode,
  base32Encode,
  openTotpSecret,
  otpauthUrl,
  roleRequiresTotp,
  sealTotpSecret,
  totpAt,
  verifyTotp,
} from './totp';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

console.log('totp tests');

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

run('base32 round-trips the RFC authenticator secret', () => {
  const decoded = base32Decode(RFC_SECRET);
  assert.strictEqual(decoded.toString('utf8'), '12345678901234567890');
  assert.strictEqual(base32Encode(Uint8Array.from(decoded)), RFC_SECRET);
});

run('matches the RFC 6238 SHA1 vector at 59 seconds', () => {
  assert.strictEqual(totpAt(RFC_SECRET, 1), '287082');
  assert.strictEqual(verifyTotp(RFC_SECRET, '287082', 59_000), true);
  assert.strictEqual(verifyTotp(RFC_SECRET, '000000', 59_000), false);
  assert.strictEqual(verifyTotp(RFC_SECRET, '287082', 59_000 + 30_000), true);
});

run('seals the secret so the database copy is not the authenticator key', () => {
  process.env.JWT_SECRET = 'totp-test-secret';
  const sealed = sealTotpSecret(RFC_SECRET);
  assert.ok(!sealed.includes(RFC_SECRET));
  assert.strictEqual(openTotpSecret(sealed), RFC_SECRET);
  assert.strictEqual(openTotpSecret(`${sealed}x`), null);
});

run('only admins must use an authenticator', () => {
  assert.strictEqual(roleRequiresTotp('admin'), true);
  assert.strictEqual(roleRequiresTotp('analyst'), false);
  assert.strictEqual(roleRequiresTotp('assistant'), false);
  assert.ok(otpauthUrl('ada@example.com', RFC_SECRET).startsWith('otpauth://totp/'));
});

console.log('totp tests ok');
