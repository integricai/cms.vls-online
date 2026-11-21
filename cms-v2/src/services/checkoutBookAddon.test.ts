import assert from 'node:assert/strict';
import { addCheckoutMoney, checkoutBookAddon } from './checkoutBookAddon';

const book = {
  id: 10,
  title: 'ACCA MA2 - Course Book',
  price: 30,
  discountedPrice: 19.5,
  currency: 'USD',
  isActive: true,
};

assert.equal(addCheckoutMoney(115, 19.5), 134.5);
assert.equal(checkoutBookAddon({ book, courseTitle: 'ACCA FA1 Recording Financial Transactions', chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: { ...book, currency: 'GBP' }, courseTitle: 'ACCA MA2 – Managing Costs and Finance', chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: { ...book, isActive: false }, courseTitle: 'ACCA MA2 – Managing Costs and Finance', chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: null, courseTitle: 'ACCA MA2 – Managing Costs and Finance', chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book, courseTitle: 'Managing Costs and Finance', chargeCurrency: 'USD' }), null);

const offer = checkoutBookAddon({
  book,
  courseTitle: 'ACCA MA2 – Managing Costs and Finance',
  chargeCurrency: 'USD',
});
assert.equal(offer?.bookId, 10);
assert.equal(offer?.title, 'ACCA MA2 - Course Book');
assert.equal(offer?.amount, 19.5);

const kit = checkoutBookAddon({
  book: { ...book, id: 11, title: 'ACCA MA2 - Practice Kit', price: 23, discountedPrice: 14.95 },
  courseTitle: 'ACCA MA2 – Managing Costs and Finance',
  chargeCurrency: 'USD',
});
assert.equal(kit?.amount, 14.95);

const listPrice = checkoutBookAddon({
  book: { ...book, discountedPrice: null, currency: '' },
  courseTitle: 'MA2',
  chargeCurrency: 'USD',
});
assert.equal(listPrice?.amount, 30);

console.log('checkout book addon tests passed');
