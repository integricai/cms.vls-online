import assert from 'node:assert/strict';
import { buildDiscountPayEmail } from './retakeDiscountEmail';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`fail ${name}`);
    throw err;
  }
}

const message = buildDiscountPayEmail({
  firstName: 'Amina',
  courseName: 'ACCA AFM',
  priceLabel: '$80.00',
  payUrl: 'https://staging.vls-online.com/pay/abc123token',
  expiresAt: new Date('2026-11-10T12:00:00.000Z'),
});

run('names the course, the price, and the payment link', () => {
  assert.match(message.subject, /ACCA AFM/);
  assert.match(message.text, /Course: ACCA AFM/);
  assert.match(message.text, /Price: \$80\.00/);
  assert.match(message.text, /https:\/\/staging\.vls-online\.com\/pay\/abc123token/);
  assert.match(message.html, /ACCA AFM/);
  assert.match(message.html, /\$80\.00/);
  assert.match(message.html, /href="https:\/\/staging\.vls-online\.com\/pay\/abc123token"/);
});

run('says when the link expires and does not include a typed code', () => {
  assert.match(message.text, /expires on 10 November 2026/);
  assert.doesNotMatch(message.text, /RT-/);
  assert.doesNotMatch(message.text, /discount code/i);
  assert.doesNotMatch(message.html, /RT-/);
  assert.doesNotMatch(message.html, /discount code/i);
});
