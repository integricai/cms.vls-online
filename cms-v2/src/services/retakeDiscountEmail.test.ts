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
  fullPriceLabel: '£100',
  discountLabel: '20%',
  payableLabel: '£80',
  payUrl: 'https://staging.vls-online.com/pay/abc123token',
  expiresAt: new Date('2026-11-10T12:00:00.000Z'),
});

run('names the course, the discount, and the payment link', () => {
  assert.match(message.subject, /ACCA AFM/);
  assert.match(message.text, /Course: ACCA AFM/);
  assert.match(message.text, /Full price: £100/);
  assert.match(message.text, /Discount: 20%/);
  assert.match(message.text, /You pay: £80/);
  assert.match(message.text, /https:\/\/staging\.vls-online\.com\/pay\/abc123token/);
  assert.match(message.html, /Full price:/);
  assert.match(message.html, /Discount:/);
  assert.match(message.html, /You pay:/);
  assert.match(message.html, /href="https:\/\/staging\.vls-online\.com\/pay\/abc123token"/);
});

run('states that the payable amount is charged in US dollars', () => {
  const dollarMessage = buildDiscountPayEmail({
    firstName: 'Amina',
    courseName: 'ACCA AFM',
    fullPriceLabel: 'US$200.00',
    discountLabel: '25%',
    payableLabel: 'US$150.00',
    chargeNote: 'You will be charged in US dollars.',
    payUrl: 'https://staging.vls-online.com/pay/abc123token',
    expiresAt: new Date('2026-11-10T12:00:00.000Z'),
  });
  assert.match(dollarMessage.text, /You pay: US\$150\.00/);
  assert.match(dollarMessage.text, /You will be charged in US dollars/);
  assert.match(dollarMessage.html, /You will be charged in US dollars/);
});

run('says when the link expires and does not include a typed code', () => {
  assert.match(message.text, /expires on 10 November 2026/);
  assert.doesNotMatch(message.text, /RT-/);
  assert.doesNotMatch(message.text, /discount code/i);
  assert.doesNotMatch(message.html, /RT-/);
  assert.doesNotMatch(message.html, /discount code/i);
});
