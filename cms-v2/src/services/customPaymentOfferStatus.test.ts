import assert from 'node:assert/strict';
import {
  CUSTOM_PAYMENT_LINK_MS,
  customPaymentOfferCanResend,
  customPaymentOfferLinkStatus,
} from '../../shared/customPaymentOfferStatus';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const now = new Date('2026-11-14T12:00:00.000Z');

console.log('custom payment offer link status');

run('marks a paid offer accepted and a refunded offer refunded', () => {
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Paid',
    checkoutIssuedAt: '2026-11-01T00:00:00.000Z',
  }, now), 'Accepted');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Refunded',
    checkoutIssuedAt: now.toISOString(),
  }, now), 'Refunded');
});

run('keeps a failed payment failed and a cancelled direct Stripe link expired', () => {
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Failed',
    checkoutIssuedAt: now.toISOString(),
  }, now), 'Failed');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Cancelled',
    checkoutIssuedAt: now.toISOString(),
  }, now), 'Expired');
});

run('keeps our own pay link waiting until the student pays', () => {
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Pending',
    checkoutIssuedAt: '2026-01-01T00:00:00.000Z',
    durablePayLink: true,
  }, now), 'Waiting');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Cancelled',
    durablePayLink: true,
  }, now), 'Waiting');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Paid',
    durablePayLink: true,
  }, now), 'Accepted');
});

run('stays waiting until a direct Stripe session is 24 hours old', () => {
  const fresh = new Date(now.getTime() - CUSTOM_PAYMENT_LINK_MS + 1000);
  const due = new Date(now.getTime() - CUSTOM_PAYMENT_LINK_MS);
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Pending',
    checkoutIssuedAt: fresh,
  }, now), 'Waiting');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Pending',
    checkoutIssuedAt: due,
  }, now), 'Expired');
  assert.equal(customPaymentOfferLinkStatus({
    orderStatus: 'Pending',
    checkoutIssuedAt: null,
  }, now), 'Expired');
});

run('allows resend until the payment is accepted or refunded', () => {
  assert.equal(customPaymentOfferCanResend('Waiting'), true);
  assert.equal(customPaymentOfferCanResend('Expired'), true);
  assert.equal(customPaymentOfferCanResend('Failed'), true);
  assert.equal(customPaymentOfferCanResend('Accepted'), false);
  assert.equal(customPaymentOfferCanResend('Refunded'), false);
});

console.log('custom payment offer link status passed');
