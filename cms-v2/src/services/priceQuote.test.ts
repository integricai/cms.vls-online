import assert from 'assert';
import { quoteMatchesCataloguePrice, signPriceQuote, verifyPriceQuote } from './priceQuote';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const previous = process.env.PRICE_QUOTE_SECRET;
process.env.PRICE_QUOTE_SECRET = 'test-quote-secret';

console.log('priceQuote tests');

run('round-trips the discounted dollar amount and the pound amount on the page', () => {
  const token = signPriceQuote({
    coursePriceId: 42,
    amountUsd: 87.5,
    listAmountUsd: 175,
    displayAmount: 65.72,
    displayCurrency: 'gbp',
  });
  assert.ok(token);
  const quote = verifyPriceQuote(token);
  assert.ok(quote);
  assert.strictEqual(quote.coursePriceId, 42);
  assert.strictEqual(quote.amountUsd, 87.5);
  assert.strictEqual(quote.listAmountUsd, 175);
  assert.strictEqual(quote.displayAmount, 65.72);
  assert.strictEqual(quote.displayCurrency, 'GBP');
  assert.strictEqual(quoteMatchesCataloguePrice(quote, 42, 175), true);
  assert.strictEqual(quoteMatchesCataloguePrice(quote, 43, 175), false);
  assert.strictEqual(quoteMatchesCataloguePrice(quote, 42, 180), false);
});

run('rejects a changed amount and an expired quote', () => {
  const token = signPriceQuote({
    coursePriceId: 42,
    amountUsd: 87.5,
    listAmountUsd: 175,
    displayAmount: 65.72,
    displayCurrency: 'GBP',
  });
  assert.ok(token);
  const [body, signature] = token.split('.');
  const tampered = `${body.slice(0, -2)}xx.${signature}`;
  assert.strictEqual(verifyPriceQuote(tampered), null);

  const expired = signPriceQuote({
    coursePriceId: 42,
    amountUsd: 87.5,
    listAmountUsd: 175,
    displayAmount: 65.72,
    displayCurrency: 'GBP',
    exp: Date.now() - 1000,
  });
  assert.strictEqual(verifyPriceQuote(expired), null);
});

if (previous === undefined) delete process.env.PRICE_QUOTE_SECRET;
else process.env.PRICE_QUOTE_SECRET = previous;

console.log('priceQuote tests passed');
