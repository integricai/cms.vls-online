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
  STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL,
  STRIPE_ORDER_SUMMARY_IMAGE_URL,
  stripeCheckoutExpiresAt,
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

async function checkoutParams(
  environment: 'staging' | 'production',
  closeUnpaidSoon = true,
): Promise<URLSearchParams> {
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
      closeUnpaidSoon,
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
  const emailedLink = await checkoutParams('production', false);
  run('leaves emailed checkout links on the 24-hour Stripe default', () => {
    assert.strictEqual(emailedLink.get('expires_at'), null);
  });
  const orderSummaryNote = 'line_items[0][price_data][product_data][description]';
  const orderSummaryImage = 'line_items[0][price_data][product_data][images][0]';

  for (const [name, page] of [['staging', staging], ['live', live]] as const) {
    run(`gives ${name} the course name and price on a white panel`, () => {
      assert.strictEqual(page.get('custom_fields[0][key]'), null);
      assert.strictEqual(page.get(orderSummaryNote), null);
      assert.strictEqual(page.get(orderSummaryImage), null);
      assert.strictEqual(page.get('line_items[0][price_data][product_data][name]'), 'ACCA FBT');
      assert.strictEqual(page.get('custom_text[after_submit][message]'), null);
      assert.ok(page.getAll('payment_method_types[]').includes('card'));
      assert.ok(!page.getAll('payment_method_types[]').includes('klarna'));
      assert.strictEqual(page.get('adaptive_pricing[enabled]'), 'false');
      assert.strictEqual(page.get('branding_settings[background_color]'), '#ffffff');
      assert.strictEqual(page.get('branding_settings[button_color]'), '#0b1f3a');
      assert.strictEqual(
        page.get('branding_settings[icon][url]'),
        'https://vls-online.com/media/vls-logo-footer-mark.png',
      );
      assert.strictEqual(page.get('custom_text[submit][message]'), STRIPE_RETURNING_STUDENT_MESSAGE);
    });
    run(`closes an unpaid ${name} checkout within 3 hours`, () => {
      const left = Number(page.get('expires_at')) - Date.now() / 1000;
      assert.ok(left > 115 * 60 && left <= 180 * 60, `expires in ${left}s`);
    });
  }

  const bookImage = new URLSearchParams();
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    for (const [key, value] of init.body as URLSearchParams) bookImage.append(key, value);
    return new Response(JSON.stringify({ id: 'cs_stub', url: 'https://checkout.stripe.com/stub' }));
  }) as typeof fetch;
  process.env.STRIPE_SECRET_KEY = 'sk_test_stub';
  try {
    await createStripeCheckoutSession({
      orderId: 2,
      zenlerCourseId: '',
      courseTitle: 'ACCA AAA - Bundle',
      paymentCardTitle: 'ACCA AAA - Bundle',
      amount: 44,
      currency: 'USD',
      studentEmail: null,
      environment: 'staging',
      orderSummaryImageUrl: STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL,
    });
  } finally {
    globalThis.fetch = realFetch;
  }
  run('uses the book summary image only when a book checkout asks for it', () => {
    assert.strictEqual(
      bookImage.get('line_items[0][price_data][product_data][images][0]'),
      STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL,
    );
    assert.notStrictEqual(STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL, STRIPE_ORDER_SUMMARY_IMAGE_URL);
  });

  const realFetchForBook = globalThis.fetch;
  let bookLine = new URLSearchParams();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    bookLine = init.body as URLSearchParams;
    return new Response(JSON.stringify({ id: 'cs_book', url: 'https://checkout.stripe.com/book' }));
  }) as typeof fetch;
  try {
    await createStripeCheckoutSession({
      orderId: 9,
      zenlerCourseId: '88',
      courseTitle: 'FA1',
      paymentCardTitle: 'FA1 — One year',
      amount: 494,
      currency: 'USD',
      studentEmail: 'student@example.com',
      environment: 'staging',
      extraLineItem: { name: 'FA1 Study Text', amount: 42.25 },
      collectShipping: true,
      bookId: 12,
    });
  } finally {
    globalThis.fetch = realFetchForBook;
  }
  run('adds the BPP book as a second line and asks for a shipping address', () => {
    assert.strictEqual(bookLine.get('line_items[0][price_data][unit_amount]'), '49400');
    assert.strictEqual(bookLine.get('line_items[1][price_data][product_data][name]'), 'FA1 Study Text');
    assert.strictEqual(bookLine.get('line_items[1][price_data][unit_amount]'), '4225');
    assert.strictEqual(bookLine.get('line_items[1][price_data][currency]'), 'usd');
    assert.strictEqual(
      bookLine.get('line_items[1][price_data][product_data][images][0]'),
      STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL,
    );
    assert.strictEqual(bookLine.get('metadata[bookId]'), '12');
    assert.ok(bookLine.getAll('shipping_address_collection[allowed_countries][]').includes('GB'));
  });

  const realFetchForAddons = globalThis.fetch;
  let addonLine = new URLSearchParams();
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    addonLine = init.body as URLSearchParams;
    return new Response(JSON.stringify({ id: 'cs_addons', url: 'https://checkout.stripe.com/addons' }));
  }) as typeof fetch;
  try {
    await createStripeCheckoutSession({
      orderId: 11,
      zenlerCourseId: '88',
      courseTitle: 'FA1',
      paymentCardTitle: 'FA1 — One year',
      amount: 494,
      currency: 'USD',
      studentEmail: 'student@example.com',
      environment: 'staging',
      extraLineItems: [
        { name: 'FA1 Course Book', amount: 19.5, image: true },
        { name: 'MS Excel for Finance Professionals', amount: 89.4 },
      ],
      bookIds: [10],
    });
  } finally {
    globalThis.fetch = realFetchForAddons;
  }
  run('adds each ticked book and course as its own Stripe line', () => {
    assert.strictEqual(addonLine.get('line_items[1][price_data][product_data][name]'), 'FA1 Course Book');
    assert.strictEqual(addonLine.get('line_items[1][price_data][unit_amount]'), '1950');
    assert.strictEqual(
      addonLine.get('line_items[1][price_data][product_data][images][0]'),
      STRIPE_BOOK_ORDER_SUMMARY_IMAGE_URL,
    );
    assert.strictEqual(addonLine.get('line_items[2][price_data][product_data][name]'), 'MS Excel for Finance Professionals');
    assert.strictEqual(addonLine.get('line_items[2][price_data][unit_amount]'), '8940');
    assert.strictEqual(addonLine.get('line_items[2][price_data][product_data][images][0]'), null);
    assert.strictEqual(addonLine.get('metadata[bookIds]'), '10');
  });

  run('unpaid checkouts close after 2-3 hours, stable within the hour', () => {
    const at = Date.UTC(2026, 10, 20, 18, 40, 0);
    const expires = stripeCheckoutExpiresAt(at);
    assert.strictEqual(expires, Date.UTC(2026, 10, 20, 21, 0, 0) / 1000);
    assert.strictEqual(stripeCheckoutExpiresAt(Date.UTC(2026, 10, 20, 18, 0, 1)), expires);
    const minutesLeft = (expires * 1000 - at) / 60000;
    assert.ok(minutesLeft >= 120 && minutesLeft <= 180, `expiry ${minutesLeft} min`);
  });

  console.log('stripeCheckout tests passed');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
