import assert from 'node:assert/strict';
import { decryptStudentPassword, encryptStudentPassword, parseChosenPassword } from './studentPasswordCrypto';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('student password');

const key = Buffer.alloc(32, 7);

run('rejects a short password and accepts a chosen one', () => {
  assert.deepStrictEqual(parseChosenPassword(''), { password: null, invalid: false });
  assert.deepStrictEqual(parseChosenPassword('short'), { password: null, invalid: true });
  assert.deepStrictEqual(parseChosenPassword('chosen-pass'), { password: 'chosen-pass', invalid: false });
});

run('round-trips a password without storing it in clear text', () => {
  const stored = encryptStudentPassword('chosen-pass', key);
  assert.equal(stored.includes('chosen-pass'), false);
  assert.equal(decryptStudentPassword(stored, key), 'chosen-pass');
});

console.log('student password tests passed');
