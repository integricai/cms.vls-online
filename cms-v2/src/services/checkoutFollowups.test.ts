import assert from 'node:assert/strict';
import { checkoutFollowupMessage } from './paymentEmails';
import { DEFAULT_FOLLOWUP_WHATSAPP, followupCourseUrl, followupUnsubscribeUrl, nextManualFollowupStep } from './checkoutFollowups';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const base = {
  courseTitle: 'ACCA FR (F7) - Financial Reporting',
  courseUrl: 'https://vls-online.com/courses/acca-fr-financial-reporting',
  unsubscribeUrl: 'https://api.cms.vls-online.com/api/public/checkout-followups/unsubscribe?token=abc',
  whatsappNumber: DEFAULT_FOLLOWUP_WHATSAPP,
};

console.log('checkout follow-up emails');

run('each step has its own subject and a tracked course link', () => {
  const subjects = new Set<string>();
  for (const step of [1, 2, 3] as const) {
    const message = checkoutFollowupMessage({ ...base, step });
    subjects.add(message.subject);
    assert.match(message.subject, /ACCA FR \(F7\)/);
    assert.match(message.text, new RegExp(`utm_campaign=checkout_followup_${step}`));
    assert.match(message.html, /utm_source=email/);
  }
  assert.equal(subjects.size, 3);
});

run('every email has the unsubscribe link and the WhatsApp link', () => {
  for (const step of [1, 2, 3] as const) {
    const message = checkoutFollowupMessage({ ...base, step });
    assert.match(message.text, /unsubscribe\?token=abc/);
    assert.match(message.html, /unsubscribe\?token=abc/);
    assert.match(message.text, /https:\/\/wa\.me\/447446426261/);
    assert.match(message.html, /https:\/\/wa\.me\/447446426261/);
  }
});

run('no email offers a discount', () => {
  for (const step of [1, 2, 3] as const) {
    const message = checkoutFollowupMessage({ ...base, step });
    assert.doesNotMatch(message.text, /discount|% off|coupon|promo/i);
  }
});

run('the greeting uses the first name when the checkout captured one', () => {
  const named = checkoutFollowupMessage({ ...base, step: 1, firstName: ' Ada ' });
  assert.match(named.text, /^Hello Ada,/);
  assert.match(named.html, /Hello Ada,/);
  const unnamed = checkoutFollowupMessage({ ...base, step: 2, firstName: '  ' });
  assert.match(unnamed.text, /^Hello,/);
  assert.doesNotMatch(unnamed.text, /Hello {2},/);
  const unsafe = checkoutFollowupMessage({ ...base, step: 3, firstName: '<b>Ada</b>' });
  assert.doesNotMatch(unsafe.html, /<b>Ada<\/b>/);
  assert.match(unsafe.html, /Hello &lt;b&gt;Ada&lt;\/b&gt;,/);
});

run('resend sends the next reminder, and the third again once all three have gone', () => {
  const none = { followup1SentAt: null, followup2SentAt: null, followup3SentAt: null };
  assert.equal(nextManualFollowupStep(none), 1);
  assert.equal(nextManualFollowupStep({ ...none, followup1SentAt: new Date() }), 2);
  assert.equal(nextManualFollowupStep({
    followup1SentAt: new Date(),
    followup2SentAt: new Date(),
    followup3SentAt: null,
  }), 3);
  assert.equal(nextManualFollowupStep({
    followup1SentAt: new Date(),
    followup2SentAt: new Date(),
    followup3SentAt: new Date(),
  }), 3);
});

run('the course title is escaped in the HTML', () => {
  const message = checkoutFollowupMessage({ ...base, step: 1, courseTitle: 'A <b>bold</b> course' });
  assert.doesNotMatch(message.html, /<b>bold<\/b>/);
  assert.match(message.html, /&lt;b&gt;bold/);
});

run('course page paths become full website links', () => {
  assert.equal(followupCourseUrl('/courses/acca-fr'), 'https://vls-online.com/courses/acca-fr');
  assert.equal(followupCourseUrl('courses/acca-fr'), 'https://vls-online.com/courses/acca-fr');
  assert.equal(followupCourseUrl('https://vls-online.com/x'), 'https://vls-online.com/x');
  assert.equal(followupCourseUrl(null), 'https://vls-online.com/');
});

run('the unsubscribe link points at the CMS', () => {
  assert.equal(
    followupUnsubscribeUrl('a b'),
    'https://api.cms.vls-online.com/api/public/checkout-followups/unsubscribe?token=a%20b',
  );
});
