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
      balance_transaction: { fee: 176, net: 5324, currency: 'usd' },
    },
  });
  assert.deepStrictEqual(parsed, { fee: 1.76, net: 53.24, paymentMethod: 'Card · Visa' });
});

run('labels a PayPal wallet payment without treating it as the processor', () => {
  const parsed = parseStripeSettlement({
    latest_charge: {
      payment_method_details: { type: 'paypal' },
      balance_transaction: { fee: 200, net: 4800 },
    },
  });
  assert.strictEqual(parsed?.paymentMethod, 'PayPal');
  assert.strictEqual(parsed?.fee, 2);
});

run('waits when Stripe has not attached a balance transaction yet', () => {
  assert.strictEqual(parseStripeSettlement({ latest_charge: { id: 'ch_1' } }), null);
  assert.strictEqual(parseStripeSettlement({}), null);
});
