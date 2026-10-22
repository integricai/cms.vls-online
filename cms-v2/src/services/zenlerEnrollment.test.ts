import assert from 'assert';
import { zenlerCreateStudentBody } from './zenlerApi';
import { zenlerStudentNames } from './zenlerEnrollment';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('zenler student name');

run('splits a full name into first and last', () => {
  assert.deepStrictEqual(zenlerStudentNames('Ada Lovelace', 'ada@example.com'), {
    firstName: 'Ada',
    lastName: 'Lovelace',
  });
});

run('fills a last name when the checkout only has one word', () => {
  assert.deepStrictEqual(zenlerStudentNames('Ada', 'ada@example.com'), {
    firstName: 'Ada',
    lastName: 'Student',
  });
});

run('uses the email and a last name when the checkout has no name', () => {
  assert.deepStrictEqual(zenlerStudentNames(null, 'travlr152@gmail.com'), {
    firstName: 'travlr152',
    lastName: 'Student',
  });
});

run('sends Zenler the required name and a zero commission', () => {
  assert.deepStrictEqual(zenlerCreateStudentBody({
    email: ' Ada@Example.com ',
    firstName: 'Ada',
    lastName: '',
    password: 'temp-secret',
  }), {
    first_name: 'Ada',
    last_name: 'Student',
    email: 'ada@example.com',
    password: 'temp-secret',
    commission: 0,
    roles: [4],
  });
});
