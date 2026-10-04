import assert from 'node:assert/strict';
import { studentPaymentAccessInstructions } from './paymentEmails';
import { VLS_SCHOOL_LOGIN_URL, VLS_SCHOOL_PASSWORD_RESET_URL } from './schoolAccess';

const login = VLS_SCHOOL_LOGIN_URL;

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('payment email access instructions');

run('gives a new student their temporary password on the first email', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: true,
      temporaryPassword: 'temp-secret',
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'enrolled_new',
    },
  });
  assert.match(message.text, /Temporary password: temp-secret/);
  assert.match(message.html, /temp-secret/);
  assert.doesNotMatch(message.text, /Set your password/);
  assert.doesNotMatch(message.text, /existing VLS school account/);
});

run('tells a new student how to set a password when the retry has none', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: true,
      temporaryPassword: null,
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'enrolled',
    },
  });
  assert.match(message.text, /does not include a temporary password/);
  assert.match(message.text, new RegExp(VLS_SCHOOL_PASSWORD_RESET_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(message.text, /ada@vls-online\.com/);
  assert.match(message.html, /Set your password/);
  assert.match(message.html, new RegExp(VLS_SCHOOL_PASSWORD_RESET_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(message.text, /existing VLS school account/);
  assert.doesNotMatch(message.html, /existing VLS school account/);
  assert.doesNotMatch(message.text, /Temporary password:/);
});

run('keeps the existing-account instructions for a returning student', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: false,
      temporaryPassword: null,
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'enrolled',
    },
  });
  assert.match(message.text, /existing VLS school account/);
  assert.doesNotMatch(message.text, /Set your password/);
  assert.doesNotMatch(message.text, new RegExp(VLS_SCHOOL_PASSWORD_RESET_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
