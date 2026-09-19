import assert from 'assert';
import crypto from 'crypto';
import { resolveCheckoutEnvironment } from './attribution';
import { stripeSecretKeyForEnvironment, verifyStripeWebhook } from './stripeCheckout';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const previous = {
  secret: process.env.STRIPE_SECRET_KEY,
  liveSecret: process.env.STRIPE_SECRET_KEY_LIVE,
  webhook: process.env.STRIPE_WEBHOOK_SECRET,
  liveWebhook: process.env.STRIPE_WEBHOOK_SECRET_LIVE,
};

process.env.STRIPE_SECRET_KEY = 'sk_test_sandbox';
process.env.STRIPE_SECRET_KEY_LIVE = 'sk_live_prod';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
process.env.STRIPE_WEBHOOK_SECRET_LIVE = 'whsec_live';

function signedHeader(payload: string, secret: string): string {
  const timestamp = '1710000000';
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

console.log('stripeCheckout tests');

run('uses live secret for production checkouts', () => {
  assert.strictEqual(stripeSecretKeyForEnvironment('production'), 'sk_live_prod');
  assert.strictEqual(stripeSecretKeyForEnvironment('staging'), 'sk_test_sandbox');
  assert.strictEqual(stripeSecretKeyForEnvironment(null), 'sk_test_sandbox');
});

run('treats prod.vls-online.com origin as production', () => {
  assert.strictEqual(
    stripeSecretKeyForEnvironment(resolveCheckoutEnvironment({ origin: 'https://prod.vls-online.com' })),
    'sk_live_prod',
  );
});

run('accepts either live or sandbox webhook signatures', () => {
  const payload = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed' });
  const body = Buffer.from(payload);

  const liveEvent = verifyStripeWebhook(body, signedHeader(payload, 'whsec_live')) as { id?: string };
  assert.strictEqual(liveEvent.id, 'evt_1');

  const testEvent = verifyStripeWebhook(body, signedHeader(payload, 'whsec_test')) as { id?: string };
  assert.strictEqual(testEvent.id, 'evt_1');
});

run('rejects an unknown webhook signature', () => {
  const payload = JSON.stringify({ id: 'evt_2' });
  assert.throws(
    () => verifyStripeWebhook(Buffer.from(payload), signedHeader(payload, 'whsec_other')),
    /Invalid Stripe signature/,
  );
});

if (previous.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
else process.env.STRIPE_SECRET_KEY = previous.secret;
if (previous.liveSecret === undefined) delete process.env.STRIPE_SECRET_KEY_LIVE;
else process.env.STRIPE_SECRET_KEY_LIVE = previous.liveSecret;
if (previous.webhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET;
else process.env.STRIPE_WEBHOOK_SECRET = previous.webhook;
if (previous.liveWebhook === undefined) delete process.env.STRIPE_WEBHOOK_SECRET_LIVE;
else process.env.STRIPE_WEBHOOK_SECRET_LIVE = previous.liveWebhook;

console.log('stripeCheckout tests passed');
