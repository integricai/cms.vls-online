import assert from 'assert';
import {
  assertPaypalEnvForProduction,
  formatPaypalAmount,
  mapPaypalWebhookEvent,
  paypalAmountToMinor,
  paypalApiBase,
} from './paypalProvider';
import { assertStripeLivemodeMatchesOrder, mapStripeWebhookEvent, stripeLivemodeMatchesOrder } from './stripeProvider';
import { getPaymentProvider, listEnabledPaymentProviders } from './registry';
import { parsePaymentProviderId } from './types';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('payment provider tests');

run('keeps PayPal inside Stripe and blocks direct PayPal checkout', () => {
  withPaypalEnv({
    PAYPAL_CLIENT_ID: 'client',
    PAYPAL_CLIENT_SECRET: 'secret',
    PAYPAL_ENV: 'live',
  }, () => {
    assert.deepStrictEqual(listEnabledPaymentProviders(), ['stripe']);
    assert.throws(() => getPaymentProvider('paypal'), /Direct PayPal checkout is disabled/);
  });
});

run('parses known providers and rejects unknown ones', () => {
  assert.strictEqual(parsePaymentProviderId(undefined), 'stripe');
  assert.strictEqual(parsePaymentProviderId(''), 'stripe');
  assert.strictEqual(parsePaymentProviderId('PayPal'), 'paypal');
  assert.throws(() => parsePaymentProviderId('gocardless'), /Unsupported payment provider/);
});

run('formats PayPal amounts in major units', () => {
  assert.strictEqual(formatPaypalAmount(199, 'USD'), '199.00');
  assert.strictEqual(formatPaypalAmount(199.5, 'gbp'), '199.50');
  assert.strictEqual(formatPaypalAmount(199.999, 'USD'), '200.00');
  assert.strictEqual(formatPaypalAmount(1500, 'JPY'), '1500');
});

run('converts PayPal amounts to minor units', () => {
  assert.strictEqual(paypalAmountToMinor('199.00', 'USD'), 19900);
  assert.strictEqual(paypalAmountToMinor(199, 'USD'), 19900);
  assert.strictEqual(paypalAmountToMinor('1500', 'JPY'), 1500);
});

run('maps Stripe checkout.session.completed', () => {
  const event = mapStripeWebhookEvent({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test',
        client_reference_id: '41',
        payment_intent: { id: 'pi_test' },
        amount_total: 19900,
        currency: 'usd',
        customer_details: { email: 'a@b.com', name: 'Ada Lovelace' },
      },
    },
  });
  assert.deepStrictEqual(event, {
    type: 'checkout.completed',
    provider: 'stripe',
    orderId: 41,
    checkoutId: 'cs_test',
    paymentId: 'pi_test',
    customerEmail: 'a@b.com',
    customerName: 'Ada Lovelace',
    amountMinor: 19900,
    currency: 'usd',
  });
});

run('matches Stripe livemode to the order environment', () => {
  assert.strictEqual(stripeLivemodeMatchesOrder(true, 'production'), true);
  assert.strictEqual(stripeLivemodeMatchesOrder(false, 'staging'), true);
  assert.strictEqual(stripeLivemodeMatchesOrder(false, 'production'), false);
  assert.strictEqual(stripeLivemodeMatchesOrder(true, 'staging'), false);
  assert.strictEqual(stripeLivemodeMatchesOrder(null, 'production'), false);
  assert.throws(
    () => assertStripeLivemodeMatchesOrder(false, 'production'),
    /Stripe livemode does not match the order environment/,
  );
});

run('maps Stripe refund.updated only when succeeded', () => {
  const pending = mapStripeWebhookEvent({
    type: 'refund.updated',
    data: { object: { id: 're_1', status: 'pending', payment_intent: 'pi_test' } },
  });
  assert.strictEqual(pending.type, 'ignored');

  const succeeded = mapStripeWebhookEvent({
    type: 'refund.updated',
    data: { object: { id: 're_1', status: 'succeeded', payment_intent: 'pi_test' } },
  });
  assert.deepStrictEqual(succeeded, {
    type: 'refund.completed',
    provider: 'stripe',
    paymentId: 'pi_test',
    refundId: 're_1',
  });
});

run('legacy direct PayPal mapper: capture completed is the paid event', () => {
  const event = mapPaypalWebhookEvent({
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: {
      id: 'CAP-1',
      custom_id: '41',
      amount: { currency_code: 'USD', value: '199.00' },
      supplementary_data: { related_ids: { order_id: '5O190127TN364715T' } },
      payer: { email_address: 'a@b.com', name: { given_name: 'Ada', surname: 'Lovelace' } },
    },
  });
  assert.deepStrictEqual(event, {
    type: 'checkout.completed',
    provider: 'paypal',
    orderId: 41,
    checkoutId: '5O190127TN364715T',
    paymentId: 'CAP-1',
    customerEmail: 'a@b.com',
    customerName: 'Ada Lovelace',
    amountMinor: 19900,
    currency: 'USD',
  });
});

run('legacy direct PayPal mapper: order approval is not a payment', () => {
  const event = mapPaypalWebhookEvent({
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: {
      id: '5O190127TN364715T',
      intent: 'CAPTURE',
      status: 'APPROVED',
      custom_id: '41',
      purchase_units: [{
        custom_id: '41',
        amount: { currency_code: 'USD', value: '199.00' },
      }],
    },
  });
  assert.deepStrictEqual(event, {
    type: 'ignored',
    provider: 'paypal',
    reason: 'CHECKOUT.ORDER.APPROVED',
  });
});

run('legacy direct PayPal mapper: refunded capture is the refund event', () => {
  const event = mapPaypalWebhookEvent({
    event_type: 'PAYMENT.CAPTURE.REFUNDED',
    resource: {
      id: 'REF-1',
      supplementary_data: {
        related_ids: { capture_id: 'CAP-1', order_id: '5O190127TN364715T' },
      },
    },
  });
  assert.deepStrictEqual(event, {
    type: 'refund.completed',
    provider: 'paypal',
    paymentId: 'CAP-1',
    refundId: 'REF-1',
    checkoutId: '5O190127TN364715T',
  });
});

function withPaypalEnv(
  env: Record<string, string | undefined>,
  fn: () => void,
): void {
  const keys = [
    'PAYPAL_ENV',
    'PAYPAL_MODE',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_CLIENT_SECRET',
    'CMS_ENV',
    'SITE_ENV',
    'VERCEL_ENV',
  ];
  const previous: Record<string, string | undefined> = {};
  for (const key of keys) previous[key] = process.env[key];
  for (const key of keys) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const key of keys) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

run('uses the PayPal sandbox unless the environment is live', () => {
  withPaypalEnv({}, () => {
    assert.strictEqual(paypalApiBase(), 'https://api-m.sandbox.paypal.com');
  });
  withPaypalEnv({ PAYPAL_ENV: 'live' }, () => {
    assert.strictEqual(paypalApiBase(), 'https://api-m.paypal.com');
  });
});

run('refuses to start PayPal in production unless PAYPAL_ENV is live', () => {
  withPaypalEnv({
    VERCEL_ENV: 'production',
    PAYPAL_CLIENT_ID: 'client',
    PAYPAL_CLIENT_SECRET: 'secret',
  }, () => {
    assert.throws(() => assertPaypalEnvForProduction(), /PAYPAL_ENV must be live in production/);
    assert.throws(() => paypalApiBase(), /PAYPAL_ENV must be live in production/);
  });

  withPaypalEnv({
    VERCEL_ENV: 'production',
    PAYPAL_ENV: 'sandbox',
    PAYPAL_CLIENT_ID: 'client',
    PAYPAL_CLIENT_SECRET: 'secret',
  }, () => {
    assert.throws(() => assertPaypalEnvForProduction(), /PAYPAL_ENV must be live in production/);
  });

  withPaypalEnv({
    VERCEL_ENV: 'production',
    PAYPAL_ENV: 'live',
    PAYPAL_CLIENT_ID: 'client',
    PAYPAL_CLIENT_SECRET: 'secret',
  }, () => {
    assert.doesNotThrow(() => assertPaypalEnvForProduction());
    assert.strictEqual(paypalApiBase(), 'https://api-m.paypal.com');
  });

  withPaypalEnv({ VERCEL_ENV: 'production' }, () => {
    assert.doesNotThrow(() => assertPaypalEnvForProduction());
  });
});
