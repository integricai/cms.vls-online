import assert from 'node:assert/strict';
import {
  paymentCountriesMatchExact,
  shouldApplyRegionalPricingAtCheckout,
  shouldVerifyRegionalPricing,
} from './paymentRegionalVerification';
import type { PaymentOrder } from '../models/paymentOrder';
import { applyParityDealsPricing } from './parityDeals';

async function runTests() {
  assert.equal(paymentCountriesMatchExact('TR', 'TR'), true);
  assert.equal(paymentCountriesMatchExact('TR', 'GB'), false);
  assert.equal(paymentCountriesMatchExact('IN', 'PK'), false);
  assert.equal(paymentCountriesMatchExact(null, 'TR'), false);
  assert.equal(paymentCountriesMatchExact('TR', null), false);

  assert.equal(shouldApplyRegionalPricingAtCheckout({ geoPricingApplied: true }), true);
  assert.equal(shouldApplyRegionalPricingAtCheckout({ geoPricingApplied: false }), false);

  const geoOrder = { regionalPricingApplied: true } as PaymentOrder;
  assert.equal(shouldVerifyRegionalPricing(geoOrder), true);

  const standardOrder = { regionalPricingApplied: false } as PaymentOrder;
  assert.equal(shouldVerifyRegionalPricing(standardOrder), false);

  // Without EVENDEALS_API_KEY / PRODUCT_ID / IP, pricing stays at CMS campaign amount.
  const noPd = await applyParityDealsPricing({
    campaignAmount: 133,
    ipAddress: null,
    fallbackCountryCode: 'PK',
  });
  assert.equal(noPd.regionalPricingApplied, false);
  assert.equal(noPd.effectiveAmount, 133);
  assert.equal(noPd.quotedCountryCode, 'PK');

  // ignoreVpnBlock still needs an Evendeals quote; without credentials it stays CMS price.
  const testMode = await applyParityDealsPricing({
    campaignAmount: 203,
    ipAddress: null,
    fallbackCountryCode: 'PK',
    ignoreVpnBlock: true,
  });
  assert.equal(testMode.effectiveAmount, 203);

  console.log('evendeals + paymentRegionalVerification tests passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
