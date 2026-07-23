import assert from 'node:assert/strict';
import {
  isDiscountedPricingRegion,
  pricingRegionsMatch,
  resolvePricingRegion,
} from './pricingRegions';
import {
  shouldApplyRegionalPricingAtCheckout,
  shouldVerifyRegionalPricing,
} from './paymentRegionalVerification';
import type { PaymentOrder } from '../models/paymentOrder';

function testResolvePricingRegion() {
  assert.equal(resolvePricingRegion('IN'), 'SOUTH_ASIA');
  assert.equal(resolvePricingRegion('DE'), 'EUROPE');
  assert.equal(resolvePricingRegion('GB'), 'EUROPE');
  assert.equal(resolvePricingRegion('US'), 'US');
  assert.equal(resolvePricingRegion(null), 'DEFAULT');
}

function testPricingRegionsMatch() {
  assert.equal(pricingRegionsMatch('IN', 'PK'), true);
  assert.equal(pricingRegionsMatch('IN', 'DE'), false);
  assert.equal(pricingRegionsMatch('GB', 'DE'), true);
  assert.equal(pricingRegionsMatch('US', 'CA'), true);
}

function testDiscountedRegions() {
  assert.equal(isDiscountedPricingRegion('SOUTH_ASIA'), true);
  assert.equal(isDiscountedPricingRegion('GCC'), true);
  assert.equal(isDiscountedPricingRegion('EUROPE'), false);
}

function testShouldApplyRegionalPricingAtCheckout() {
  assert.equal(
    shouldApplyRegionalPricingAtCheckout({ countryCode: 'IN' }),
    true,
  );
  assert.equal(
    shouldApplyRegionalPricingAtCheckout({ countryCode: 'DE' }),
    false,
  );
  assert.equal(
    shouldApplyRegionalPricingAtCheckout({
      countryCode: 'DE',
      regionalPricingApplied: true,
    }),
    true,
  );
}

function testShouldVerifyRegionalPricing() {
  const baseOrder = {
    countryCode: 'IN',
    regionalPricingApplied: true,
  } as PaymentOrder;

  assert.equal(shouldVerifyRegionalPricing(baseOrder), true);

  const europeOrder = {
    countryCode: 'DE',
    regionalPricingApplied: false,
  } as PaymentOrder;
  assert.equal(shouldVerifyRegionalPricing(europeOrder), false);
}

function run() {
  testResolvePricingRegion();
  testPricingRegionsMatch();
  testDiscountedRegions();
  testShouldApplyRegionalPricingAtCheckout();
  testShouldVerifyRegionalPricing();
  console.log('pricingRegions + paymentRegionalVerification tests passed');
}

run();
