import assert from 'assert';
import crypto from 'crypto';
import { resolveCheckoutEnvironment } from './attribution';
import {
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  appendStripeAdaptivePricing,
  appendStripeOrderSummaryNote,
  appendStripeStudentNameFields,
  buildLocalCurrencyPriceParams,
  classifyPaidAmount,
  locksLocalPresentment,
  majorAmountFromStripeMinor,
  resolveStripeStudentNameDefaults,
  safeCheckoutCancelPath,
  STRIPE_PAYPAL_CURRENCY_NOTE,
  STRIPE_RETURNING_STUDENT_MESSAGE,
  stripePaymentMethodTypes,
  stripeUnitAmount,
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

run('uses the sandbox key for a trusted staging host on a production deployment', () => {
  withDeploymentEnv({ VERCEL_ENV: 'production' }, () => {
    assert.strictEqual(
      stripeSecretKeyForEnvironment(resolveCheckoutEnvironment({
        origin: 'https://staging.vls-online.com',
        trustedStagingHost: true,
      })),
      'sk_test_sandbox',
    );
    assert.strictEqual(
      stripeSecretKeyForEnvironment(resolveCheckoutEnvironment({
        origin: 'https://staging.vls-online.com',
      })),
      'sk_live_prod',
    );
    assert.strictEqual(
      stripeSecretKeyForEnvironment(resolveCheckoutEnvironment({
        origin: 'https://vls-online.com',
        trustedStagingHost: true,
      })),
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

run('production deployment accepts the sandbox webhook and the live webhook', () => {
  withDeploymentEnv({ VERCEL_ENV: 'production', SITE_ENV: 'staging' }, () => {
    const testPayload = JSON.stringify({ id: 'evt_test', livemode: false });
    const testEvent = verifyStripeWebhook(
      Buffer.from(testPayload),
      signedHeader(testPayload, 'whsec_test'),
    ) as { id?: string };
    assert.strictEqual(testEvent.id, 'evt_test');

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

run('adds the PayPal currency note to the left order summary', () => {
  const params = new URLSearchParams();
  appendStripeOrderSummaryNote(params);
  assert.strictEqual(
    params.get('line_items[0][price_data][product_data][description]'),
    STRIPE_PAYPAL_CURRENCY_NOTE,
  );
  assert.strictEqual(
    STRIPE_PAYPAL_CURRENCY_NOTE,
    'To pay by PayPal, please select the USD price, provided PayPal is available in your country.',
  );
});

run('asks Stripe for the local price and the dollar price on a US dollar charge', () => {
  const usd = new URLSearchParams();
  appendStripeAdaptivePricing(usd, 'USD');
  assert.strictEqual(usd.get('adaptive_pricing[enabled]'), 'true');

  const gbp = new URLSearchParams();
  appendStripeAdaptivePricing(gbp, 'gbp');
  assert.strictEqual(gbp.get('adaptive_pricing[enabled]'), null);
  assert.strictEqual(majorAmountFromStripeMinor(6100, 'USD'), 61);
  assert.strictEqual(majorAmountFromStripeMinor(14850, 'JPY'), 14850);
});

run('asks Stripe for a required first name and last name', () => {
  const params = new URLSearchParams();
  appendStripeStudentNameFields(params);
  assert.strictEqual(params.get('custom_fields[0][key]'), 'first_name');
  assert.strictEqual(params.get('custom_fields[0][label][custom]'), 'First name');
  assert.strictEqual(params.get('custom_fields[0][optional]'), 'false');
  assert.strictEqual(params.get('custom_fields[0][text][default_value]'), null);
  assert.strictEqual(params.get('custom_fields[1][key]'), 'last_name');
  assert.strictEqual(params.get('custom_fields[1][label][custom]'), 'Last name');
  assert.strictEqual(params.get('custom_fields[1][optional]'), 'false');
  assert.strictEqual(params.get('custom_fields[1][text][default_value]'), null);
});

run('prefills Stripe name fields without locking them', () => {
  const params = new URLSearchParams();
  appendStripeStudentNameFields(params, { firstName: ' Ada ', lastName: '' });
  assert.strictEqual(params.get('custom_fields[0][text][default_value]'), 'Ada');
  assert.strictEqual(params.get('custom_fields[0][optional]'), 'false');
  assert.strictEqual(params.get('custom_fields[1][text][default_value]'), null);
});

run('leaves Stripe name defaults empty when the form already has both names', () => {
  assert.deepStrictEqual(resolveStripeStudentNameDefaults({
    formFirstName: 'Ada',
    formLastName: 'Lovelace',
    schoolFirstName: 'School',
    schoolLastName: 'Name',
    codeFirstName: 'Code',
    codeLastName: 'Person',
  }), {});
});

run('prefers the school account, then the discount code, for an empty form name', () => {
  assert.deepStrictEqual(resolveStripeStudentNameDefaults({
    schoolFirstName: ' Grace ',
    schoolLastName: '',
    codeFirstName: 'Code',
    codeLastName: 'Hopper',
  }), { studentFirstName: 'Grace', studentLastName: 'Hopper' });
});

run('keeps a single name typed on the form and fills only the other box', () => {
  assert.deepStrictEqual(resolveStripeStudentNameDefaults({
    formFirstName: 'Ada',
    schoolFirstName: 'School',
    schoolLastName: 'Lovelace',
  }), { studentFirstName: 'Ada', studentLastName: 'Lovelace' });
});

run('adds Link only when Stripe collects the email', () => {
  assert.deepStrictEqual(stripePaymentMethodTypes(true), ['card', 'link', 'paypal', 'klarna']);
  assert.deepStrictEqual(stripePaymentMethodTypes(true, 'GBP'), ['card', 'link']);
  assert.deepStrictEqual(stripePaymentMethodTypes(false), ['card', 'paypal', 'klarna']);
  assert.strictEqual(stripeUnitAmount(176, 'GBP'), 17600);
  assert.strictEqual(stripeUnitAmount(14850, 'JPY'), 14850);
  assert.strictEqual(
    STRIPE_RETURNING_STUDENT_MESSAGE,
    'Already a Vertex student? Use the email you log in with.',
  );
});

run('keeps Stripe cancel on the course page', () => {
  assert.strictEqual(safeCheckoutCancelPath('/courses/acca-fa'), '/courses/acca-fa');
  assert.strictEqual(safeCheckoutCancelPath('/courses/acca-fa?discount=RT-ABC'), '/courses/acca-fa?discount=RT-ABC');
  assert.strictEqual(safeCheckoutCancelPath('https://evil.example/steal'), '/payment-cancelled');
  assert.strictEqual(safeCheckoutCancelPath('//evil.example'), '/payment-cancelled');
});

run('locks the course-page pound amount beside the dollar price', () => {
  assert.strictEqual(locksLocalPresentment('USD', { amount: 65.72, currency: 'GBP' }), true);
  assert.strictEqual(locksLocalPresentment('GBP', { amount: 65.72, currency: 'GBP' }), false);
  assert.strictEqual(locksLocalPresentment('USD', { amount: 87.5, currency: 'USD' }), false);

  const params = buildLocalCurrencyPriceParams({
    title: 'ACCA SBR',
    usdAmount: 87.5,
    localAmount: 65.72,
    localCurrency: 'GBP',
  });
  assert.strictEqual(params.get('currency'), 'usd');
  assert.strictEqual(params.get('unit_amount'), '8750');
  assert.strictEqual(params.get('currency_options[gbp][unit_amount]'), '6572');
  assert.strictEqual(params.get('product_data[description]'), STRIPE_PAYPAL_CURRENCY_NOTE);
});

run('accepts either the dollar charge or the locked local amount', () => {
  const offered = {
    orderAmount: 87.5,
    orderCurrency: 'USD',
    presentmentAmount: 65.72,
    presentmentCurrency: 'GBP',
  };
  assert.strictEqual(classifyPaidAmount({ ...offered, paidAmountMinor: 8750, paidCurrency: 'usd' }), 'order');
  assert.strictEqual(classifyPaidAmount({ ...offered, paidAmountMinor: 6572, paidCurrency: 'gbp' }), 'presentment');
  assert.strictEqual(classifyPaidAmount({ ...offered, paidAmountMinor: 6849, paidCurrency: 'gbp' }), 'mismatch');
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
