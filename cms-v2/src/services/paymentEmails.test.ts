import assert from 'node:assert/strict';
import { stagingPurchaseConfirmation, studentPaymentAccessInstructions } from './paymentEmails';
import { enrollmentStatusBlocksAccessEmail, VLS_SCHOOL_LOGIN_URL, VLS_SCHOOL_PASSWORD_RESET_URL } from './schoolAccess';

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

run('tells a new student to sign in with the password they chose', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: true,
      temporaryPassword: null,
      studentChosePassword: true,
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'enrolled_new',
    },
  });
  assert.match(message.text, /password you chose when you paid/);
  assert.match(message.html, /Log in to the school/);
  assert.doesNotMatch(message.text, /Temporary password:/);
  assert.doesNotMatch(message.text, /Set your password/);
  assert.doesNotMatch(message.text, /register/);
});

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

run('keeps the temporary password when enrolment failed after the account was created', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: true,
      temporaryPassword: 'temp-secret',
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'failed',
    },
  });
  assert.match(message.text, /Temporary password: temp-secret/);
  assert.doesNotMatch(message.text, /existing VLS school account/);
});

run('sends password-reset instructions when a new account has no password left', () => {
  const message = studentPaymentAccessInstructions({
    email: 'ada@vls-online.com',
    access: {
      isNewZenlerUser: true,
      temporaryPassword: null,
      courseAccessUrl: login,
      zenlerEnrollmentStatus: 'failed',
    },
  });
  assert.match(message.text, /Set your password/);
  assert.match(message.text, /ada@vls-online\.com/);
  assert.doesNotMatch(message.text, /existing VLS school account/);
  assert.doesNotMatch(message.text, /Temporary password:/);
});

run('holds the access email only until enrolment is attempted', () => {
  assert.equal(enrollmentStatusBlocksAccessEmail(null), true);
  assert.equal(enrollmentStatusBlocksAccessEmail(''), true);
  assert.equal(enrollmentStatusBlocksAccessEmail('pending'), true);
  assert.equal(enrollmentStatusBlocksAccessEmail('failed'), false);
  assert.equal(enrollmentStatusBlocksAccessEmail('skipped'), false);
  assert.equal(enrollmentStatusBlocksAccessEmail('enrolled'), false);
  assert.equal(enrollmentStatusBlocksAccessEmail('enrolled_new'), false);
});

run('gives a new staging student the course, price, email, and a temporary password', () => {
  const message = stagingPurchaseConfirmation({
    name: 'Ada',
    email: 'ada@vls-online.com',
    courseTitle: 'ACCA FA',
    amountLabel: '£199.00',
    loginUrl: login,
    isNewZenlerUser: true,
    temporaryPassword: 'temp-secret',
    zenlerEnrollmentStatus: 'enrolled_new',
  });
  assert.ok(message);
  assert.match(message.text, /Course: ACCA FA/);
  assert.match(message.text, /Price: £199\.00/);
  assert.match(message.text, /Email: ada@vls-online\.com/);
  assert.match(message.text, /Temporary password: temp-secret/);
  assert.match(message.text, /change this password/);
  assert.match(message.html, /temp-secret/);
});

run('thanks a returning staging student and omits a temporary password', () => {
  const message = stagingPurchaseConfirmation({
    name: 'Ada',
    email: 'ada@vls-online.com',
    courseTitle: 'ACCA FA',
    amountLabel: '£199.00',
    loginUrl: login,
    isNewZenlerUser: false,
    temporaryPassword: null,
    zenlerEnrollmentStatus: 'enrolled',
  });
  assert.ok(message);
  assert.match(message.text, /Thank you! Your purchase was successful/);
  assert.match(message.text, /same login information/);
  assert.match(message.text, /Course: ACCA FA/);
  assert.match(message.text, /Price: £199\.00/);
  assert.doesNotMatch(message.text, /Temporary password/);
  assert.doesNotMatch(message.html, /Temporary password/);
});

run('leaves other staging enrolment cases on the existing email', () => {
  assert.equal(stagingPurchaseConfirmation({
    name: 'Ada',
    email: 'ada@vls-online.com',
    courseTitle: 'ACCA FA',
    amountLabel: '£199.00',
    loginUrl: login,
    isNewZenlerUser: true,
    temporaryPassword: null,
    zenlerEnrollmentStatus: 'enrolled_new',
  }), null);
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
