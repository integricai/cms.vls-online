import assert from 'node:assert/strict';
import { selectedUpsellOffers, type CheckoutUpsellOffer } from './checkoutAddons';

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

console.log('checkout addon tests passed');
