import assert from 'node:assert/strict';
import { addCheckoutMoney, checkoutBookAddon } from './checkoutBookAddon';

const book = {
  id: 12,
  title: 'FA1 Study Text',
  price: 65,
  discountedPrice: 42.25,
  currency: 'USD',
  isActive: true,
  courseId: 4,
};

assert.equal(addCheckoutMoney(494, 42.25), 536.25);
assert.equal(checkoutBookAddon({ book, courseId: 9, chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: { ...book, currency: 'GBP' }, courseId: 4, chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: { ...book, isActive: false }, courseId: 4, chargeCurrency: 'USD' }), null);
assert.equal(checkoutBookAddon({ book: null, courseId: 4, chargeCurrency: 'USD' }), null);

const offer = checkoutBookAddon({ book, courseId: 4, chargeCurrency: 'USD' });
assert.equal(offer?.bookId, 12);
assert.equal(offer?.title, 'FA1 Study Text');
assert.equal(offer?.amount, 42.25);

const listPrice = checkoutBookAddon({
  book: { ...book, discountedPrice: null, currency: '' },
  courseId: 4,
  chargeCurrency: 'USD',
});
assert.equal(listPrice?.amount, 65);

console.log('checkout book addon tests passed');
