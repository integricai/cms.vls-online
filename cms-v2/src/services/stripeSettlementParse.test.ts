import assert from 'assert';
import { parseStripeSettlement } from './stripeSettlementParse';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('stripeSettlementParse tests');

run('reads the fee, net, and card brand from an expanded charge', () => {
  const parsed = parseStripeSettlement({
    latest_charge: {
      payment_method_details: { type: 'card', card: { brand: 'visa' } },
      balance_transaction: { amount: 5500, fee: 176, net: 5324, currency: 'usd' },
    },
  });
  assert.deepStrictEqual(parsed, { fee: 1.76, net: 53.24, currency: 'USD', paymentMethod: 'Card · Visa' });
});

run('keeps the settlement currency when the student paid in another currency', () => {
  const parsed = parseStripeSettlement({
    amount: 33525,
    currency: 'sar',
    latest_charge: {
      amount: 33525,
      currency: 'sar',
      payment_method_details: { type: 'card', card: { brand: 'visa' } },
      balance_transaction: { amount: 8934, fee: 490, net: 8444, currency: 'usd' },
    },
  });
  assert.deepStrictEqual(parsed, { fee: 4.9, net: 84.44, currency: 'USD', paymentMethod: 'Card · Visa' });
});

run('does not divide a zero-decimal settlement by 100', () => {
  const parsed = parseStripeSettlement({
    latest_charge: {
      balance_transaction: { amount: 1500, fee: 100, net: 1400, currency: 'jpy' },
    },
  });
  assert.strictEqual(parsed?.fee, 100);
  assert.strictEqual(parsed?.net, 1400);
  assert.strictEqual(parsed?.currency, 'JPY');
});

run('labels a PayPal wallet payment without treating it as the processor', () => {
  const parsed = parseStripeSettlement({
    latest_charge: {
      payment_method_details: { type: 'paypal' },
      balance_transaction: { amount: 5000, fee: 200, net: 4800, currency: 'usd' },
    },
  });
  assert.strictEqual(parsed?.paymentMethod, 'PayPal');
  assert.strictEqual(parsed?.fee, 2);
  assert.strictEqual(parsed?.net, 48);
});

run('uses the dollar charge minus the fee when PayPal settles outside Stripe', () => {
  const parsed = parseStripeSettlement({
    amount: 1350,
    currency: 'usd',
    latest_charge: {
      amount: 1350,
      currency: 'usd',
      payment_method_details: { type: 'paypal' },
      balance_transaction: { amount: 0, fee: 12, net: -12, currency: 'usd' },
    },
  }, { amount: 10.14, currency: 'GBP' });
  assert.deepStrictEqual(parsed, { fee: 0.12, net: 13.38, currency: 'USD', paymentMethod: 'PayPal' });
});

run('uses the stored charge when the PaymentIntent does not repeat the amount', () => {
  const parsed = parseStripeSettlement({
    latest_charge: {
      payment_method_details: { type: 'paypal' },
      balance_transaction: { amount: 0, fee: 12, net: -12, currency: 'usd' },
    },
  }, { amount: 13.5, currency: 'USD' });
  assert.strictEqual(parsed?.net, 13.38);
});

run('leaves the net blank when the PayPal fee is in a different currency from the charge', () => {
  const parsed = parseStripeSettlement({
    amount: 33525,
    currency: 'sar',
    latest_charge: {
      amount: 33525,
      currency: 'sar',
      balance_transaction: { amount: 0, fee: 490, net: -490, currency: 'usd' },
    },
  }, { amount: 335.25, currency: 'SAR' });
  assert.strictEqual(parsed?.fee, 4.9);
  assert.strictEqual(parsed?.net, null);
  assert.strictEqual(parsed?.currency, 'USD');
});

run('converts a pound settlement into the stored dollar charge', () => {
  const parsed = parseStripeSettlement({
    amount: 5595,
    currency: 'gbp',
    latest_charge: {
      amount: 5595,
      currency: 'gbp',
      payment_method_details: { type: 'klarna' },
      balance_transaction: { amount: 5595, fee: 314, net: 5281, currency: 'gbp' },
    },
  }, {
    amount: 74.5,
    currency: 'USD',
    presentmentAmount: 55.95,
    presentmentCurrency: 'GBP',
  });
  assert.strictEqual(parsed?.currency, 'USD');
  assert.strictEqual(parsed?.fee, 4.18);
  assert.strictEqual(parsed?.net, 70.32);
});

run('converts a PayPal fee in pounds off the dollar charge', () => {
  const parsed = parseStripeSettlement({
    amount: 1014,
    currency: 'gbp',
    latest_charge: {
      amount: 1014,
      currency: 'gbp',
      payment_method_details: { type: 'paypal' },
      balance_transaction: { amount: 0, fee: 12, net: -12, currency: 'gbp' },
    },
  }, {
    amount: 13.5,
    currency: 'USD',
    presentmentAmount: 10.14,
    presentmentCurrency: 'GBP',
  });
  assert.strictEqual(parsed?.currency, 'USD');
  assert.strictEqual(parsed?.fee, 0.16);
  assert.strictEqual(parsed?.net, 13.34);
});

run('waits when Stripe has not attached a balance transaction yet', () => {
  assert.strictEqual(parseStripeSettlement({ latest_charge: { id: 'ch_1' } }), null);
  assert.strictEqual(parseStripeSettlement({}), null);
});
