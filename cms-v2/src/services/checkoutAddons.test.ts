import assert from 'node:assert/strict';
import {
  applyUpsellCourseDiscount,
  parseUpsellDiscountPercent,
  selectedUpsellOffers,
  type CheckoutUpsellOffer,
} from './checkoutAddons';

const offers: CheckoutUpsellOffer[] = [
  { courseId: 4, zenlerCourseId: '40', title: 'Excel', listAmount: 149, chargeAmount: 89.4, saveAmount: 59.6 },
  { courseId: 5, zenlerCourseId: '50', title: 'Modelling', listAmount: 179, chargeAmount: 107.4, saveAmount: 71.6 },
];

assert.deepEqual(selectedUpsellOffers(offers, [5, 5, 4]).map((offer) => offer.courseId), [5, 4]);
assert.deepEqual(selectedUpsellOffers(offers, []), []);

assert.throws(
  () => selectedUpsellOffers(offers, [9]),
  (error: unknown) => error instanceof Error && /not available/.test(error.message),
);

assert.equal(parseUpsellDiscountPercent('40'), 40);
assert.equal(parseUpsellDiscountPercent(''), 0);
assert.equal(parseUpsellDiscountPercent(150), 100);
assert.deepEqual(applyUpsellCourseDiscount(offers, 40), [
  { courseId: 4, zenlerCourseId: '40', title: 'Excel', listAmount: 89.4, chargeAmount: 53.64, saveAmount: 35.76 },
  { courseId: 5, zenlerCourseId: '50', title: 'Modelling', listAmount: 107.4, chargeAmount: 64.44, saveAmount: 42.96 },
]);

console.log('checkout addon tests passed');
