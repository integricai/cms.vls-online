import assert from 'assert';
import crypto from 'crypto';
import { resolveCheckoutEnvironment } from './attribution';
import {
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  stripeSecretKeyForEnvironment,
  verifyStripeWebhook,
} from './stripeCheckout';

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

function signedHeader(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex');
  return `t=${timestamp},v1=${signature}`;
}

console.log('stripeCheckout tests');

run('uses live secret for production checkouts', () => {
  assert.strictEqual(stripeSecretKeyForEnvironment('production'), 'sk_live_prod');
  assert.strictEqual(stripeSecretKeyForEnvironment('staging'), 'sk_test_sandbox');
  assert.strictEqual(stripeSecretKeyForEnvironment(null), 'sk_test_sandbox');
});

function withDeploymentEnv(
  env: { CMS_ENV?: string; SITE_ENV?: string; VERCEL_ENV?: string },
  fn: () => void,
): void {
  const previous = {
    CMS_ENV: process.env.CMS_ENV,
    SITE_ENV: process.env.SITE_ENV,
    VERCEL_ENV: process.env.VERCEL_ENV,
  };
  for (const key of Object.keys(previous) as Array<keyof typeof previous>) {
    const next = env[key];
    if (next === undefined) delete process.env[key];
    else process.env[key] = next;
  }
  try {
    fn();
  } finally {
    for (const key of Object.keys(previous) as Array<keyof typeof previous>) {
      const prior = previous[key];
      if (prior === undefined) delete process.env[key];
      else process.env[key] = prior;
    }
  }
}

run('treats prod.vls-online.com origin as production', () => {
  withDeploymentEnv({}, () => {
    assert.strictEqual(
      stripeSecretKeyForEnvironment(resolveCheckoutEnvironment({ origin: 'https://prod.vls-online.com' })),
      'sk_live_prod',
    );
  });
});

run('accepts either live or sandbox webhook signatures', () => {
  withDeploymentEnv({}, () => {
    const livePayload = JSON.stringify({ id: 'evt_1', livemode: true, type: 'checkout.session.completed' });
    const liveEvent = verifyStripeWebhook(Buffer.from(livePayload), signedHeader(livePayload, 'whsec_live')) as { id?: string };
    assert.strictEqual(liveEvent.id, 'evt_1');

    const testPayload = JSON.stringify({ id: 'evt_1', livemode: false, type: 'checkout.session.completed' });
    const testEvent = verifyStripeWebhook(Buffer.from(testPayload), signedHeader(testPayload, 'whsec_test')) as { id?: string };
    assert.strictEqual(testEvent.id, 'evt_1');
  });
});

run('rejects a webhook whose livemode does not match the signing secret', () => {
  withDeploymentEnv({}, () => {
    const payload = JSON.stringify({ id: 'evt_3', livemode: true });
    assert.throws(
      () => verifyStripeWebhook(Buffer.from(payload), signedHeader(payload, 'whsec_test')),
      /Stripe livemode does not match the webhook secret/,
    );
  });
});

run('production deployment ignores the test webhook secret', () => {
  withDeploymentEnv({ VERCEL_ENV: 'production', SITE_ENV: 'staging' }, () => {
    const testPayload = JSON.stringify({ id: 'evt_live', livemode: false });
    assert.throws(
      () => verifyStripeWebhook(Buffer.from(testPayload), signedHeader(testPayload, 'whsec_test')),
      /Invalid Stripe signature/,
    );

    const livePayload = JSON.stringify({ id: 'evt_live', livemode: true });
    const liveEvent = verifyStripeWebhook(
      Buffer.from(livePayload),
      signedHeader(livePayload, 'whsec_live'),
    ) as { id?: string };
    assert.strictEqual(liveEvent.id, 'evt_live');
  });
});

run('rejects a replayed webhook outside the tolerance window', () => {
  withDeploymentEnv({}, () => {
    const payload = JSON.stringify({ id: 'evt_old', livemode: false });
    const stale = Math.floor(Date.now() / 1000) - STRIPE_WEBHOOK_TOLERANCE_SECONDS - 60;
    assert.throws(
      () => verifyStripeWebhook(Buffer.from(payload), signedHeader(payload, 'whsec_test', stale)),
      /Stripe webhook timestamp is outside the tolerance window/,
    );
  });
});

run('accepts any v1 signature when the header carries several', () => {
  withDeploymentEnv({}, () => {
    const payload = JSON.stringify({ id: 'evt_multi', livemode: false });
    const timestamp = Math.floor(Date.now() / 1000);
    const valid = crypto.createHmac('sha256', 'whsec_test').update(`${timestamp}.${payload}`).digest('hex');
    const other = 'ab'.repeat(32);
    const header = `t=${timestamp},v1=${valid},v1=${other}`;
    const event = verifyStripeWebhook(Buffer.from(payload), header) as { id?: string };
    assert.strictEqual(event.id, 'evt_multi');

    const reversed = `t=${timestamp},v1=${other},v1=${valid}`;
    const reversedEvent = verifyStripeWebhook(Buffer.from(payload), reversed) as { id?: string };
    assert.strictEqual(reversedEvent.id, 'evt_multi');
  });
});

run('rejects an unknown webhook signature', () => {
  withDeploymentEnv({}, () => {
    const payload = JSON.stringify({ id: 'evt_2' });
    assert.throws(
      () => verifyStripeWebhook(Buffer.from(payload), signedHeader(payload, 'whsec_other')),
      /Invalid Stripe signature/,
    );
  });
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
