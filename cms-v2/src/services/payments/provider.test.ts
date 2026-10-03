import assert from 'assert';
import { formatPaypalAmount, mapPaypalWebhookEvent, paypalAmountToMinor } from './paypalProvider';
import { mapStripeWebhookEvent } from './stripeProvider';
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

run('maps PayPal capture completed onto the shared paid event', () => {
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

run('maps PayPal refunded capture onto the shared refund event', () => {
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
