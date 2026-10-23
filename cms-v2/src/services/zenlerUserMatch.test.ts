import assert from 'node:assert/strict';
import { zenlerUserMatchingEmail } from './zenlerApi';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('zenler email match');

run('matches the school account by exact email', () => {
  const match = zenlerUserMatchingEmail([
    { id: 'other', email: 'other@example.com' },
    { id: 'ada', email: 'Ada@Example.com' },
  ], 'ada@example.com');
  assert.equal(match?.id, 'ada');
});

run('does not treat a partial email as the same account', () => {
  const match = zenlerUserMatchingEmail([
    { id: 'ada', email: 'ada.lovelace@example.com' },
  ], 'ada@example.com');
  assert.equal(match, null);
});

console.log('zenler email match tests passed');
