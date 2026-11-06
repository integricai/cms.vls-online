import assert from 'assert';
import crypto from 'crypto';
import { resolveCheckoutEnvironment } from './attribution';
import {
  STRIPE_WEBHOOK_TOLERANCE_SECONDS,
  appendStripeAdaptivePricing,
  assertStripeUsdCharge,
  classifyPaidAmount,
  createStripeCheckoutSession,
  majorAmountFromStripeMinor,
  safeCheckoutCancelPath,
  STRIPE_RETURNING_STUDENT_MESSAGE,
  STRIPE_ORDER_SUMMARY_IMAGE_URL,
  stripeMethodsForCharge,
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

run('turns Adaptive Pricing off so Stripe shows only the dollar price', () => {
  const params = new URLSearchParams();
  appendStripeAdaptivePricing(params);
  assert.strictEqual(params.get('adaptive_pricing[enabled]'), 'false');
  assert.strictEqual(majorAmountFromStripeMinor(6100, 'USD'), 61);
  assert.strictEqual(majorAmountFromStripeMinor(14850, 'JPY'), 14850);
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

run('drops Klarna from a dollar charge', () => {
  const methods = ['card', 'link', 'paypal', 'klarna'];
  assert.deepStrictEqual(stripeMethodsForCharge(methods, 'USD'), ['card', 'link', 'paypal']);
  assert.deepStrictEqual(stripeMethodsForCharge(methods, 'GBP'), methods);
});

run('keeps Stripe cancel on the course page', () => {
  assert.strictEqual(safeCheckoutCancelPath('/courses/acca-fa'), '/courses/acca-fa');
  assert.strictEqual(safeCheckoutCancelPath('/courses/acca-fa?discount=RT-ABC'), '/courses/acca-fa?discount=RT-ABC');
  assert.strictEqual(safeCheckoutCancelPath('https://evil.example/steal'), '/payment-cancelled');
  assert.strictEqual(safeCheckoutCancelPath('//evil.example'), '/payment-cancelled');
});

run('records every Stripe charge in US dollars', () => {
  assert.doesNotThrow(() => assertStripeUsdCharge('usd'));
  assert.throws(() => assertStripeUsdCharge('GBP'), /Stripe charges must be in USD/);
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

async function checkoutParams(environment: 'staging' | 'production'): Promise<URLSearchParams> {
  process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
  process.env.STRIPE_SECRET_KEY_LIVE = 'sk_live_stub';
  const realFetch = globalThis.fetch;
  let sent = new URLSearchParams();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = init.body as URLSearchParams;
    return new Response(JSON.stringify({ id: 'cs_stub', url: 'https://checkout.stripe.com/stub' }));
  }) as typeof fetch;
  try {
    await createStripeCheckoutSession({
      orderId: 1,
      zenlerCourseId: '1',
      courseTitle: 'ACCA FBT',
      paymentCardTitle: 'ACCA FBT',
      amount: 105,
      currency: 'USD',
      studentEmail: null,
      environment,
    });
    return sent;
  } finally {
    globalThis.fetch = realFetch;
    if (previous.secret === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous.secret;
    if (previous.liveSecret === undefined) delete process.env.STRIPE_SECRET_KEY_LIVE;
    else process.env.STRIPE_SECRET_KEY_LIVE = previous.liveSecret;
  }
}

void (async () => {
  const staging = await checkoutParams('staging');
  const live = await checkoutParams('production');
  const orderSummaryNote = 'line_items[0][price_data][product_data][description]';
  const orderSummaryImage = 'line_items[0][price_data][product_data][images][0]';

  for (const [name, page] of [['staging', staging], ['live', live]] as const) {
    run(`gives ${name} one Stripe name box, the left pane image, and the branded page`, () => {
      assert.strictEqual(page.get('custom_fields[0][key]'), null);
      assert.strictEqual(page.get(orderSummaryNote), null);
      assert.strictEqual(page.get(orderSummaryImage), STRIPE_ORDER_SUMMARY_IMAGE_URL);
      assert.strictEqual(page.get('custom_text[after_submit][message]'), null);
      assert.ok(page.getAll('payment_method_types[]').includes('card'));
      assert.ok(!page.getAll('payment_method_types[]').includes('klarna'));
      assert.strictEqual(page.get('adaptive_pricing[enabled]'), 'false');
      assert.strictEqual(page.get('branding_settings[background_color]'), '#0b1f3a');
      assert.strictEqual(page.get('custom_text[submit][message]'), STRIPE_RETURNING_STUDENT_MESSAGE);
    });
  }

  console.log('stripeCheckout tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
