import assert from 'node:assert/strict';
import { bookChargeAmount, withBookCheckoutResult } from './bookCheckout';
import { resolveCheckoutReturnUrl } from './checkoutSiteUrl';

const previous = process.env.PUBLIC_SITE_URL;
process.env.PUBLIC_SITE_URL = 'https://vls-online.com';

assert.equal(bookChargeAmount({ price: 40, discountedPrice: 20 }), 20);
assert.equal(bookChargeAmount({ price: 40, discountedPrice: null }), 40);
assert.equal(bookChargeAmount({ price: 0, discountedPrice: null }), null);
assert.equal(bookChargeAmount({ price: 40, discountedPrice: 0 }), null);

assert.equal(
  resolveCheckoutReturnUrl('https://evil.example/bppbooks'),
  'https://vls-online.com/bppbooks',
);
assert.equal(
  resolveCheckoutReturnUrl('https://www.vls-online.com/bppbooks?paper=fa1'),
  'https://www.vls-online.com/bppbooks?paper=fa1',
);
assert.equal(
  withBookCheckoutResult('https://vls-online.com/bppbooks', 'success'),
  'https://vls-online.com/bppbooks?book_checkout=success',
);

if (previous == null) delete process.env.PUBLIC_SITE_URL;
else process.env.PUBLIC_SITE_URL = previous;

console.log('book checkout tests passed');
