import assert from 'node:assert/strict';
import {
  applyGeoPricing,
  geoPricingRegionsMatch,
  refreshGeoPricingCache,
  resolveGeoRegionCode,
} from './geoPricing';
import {
  shouldApplyRegionalPricingAtCheckout,
  shouldVerifyRegionalPricing,
} from './paymentRegionalVerification';
import type { PaymentOrder } from '../models/paymentOrder';

async function runTests() {
  await refreshGeoPricingCache();

  assert.equal(resolveGeoRegionCode('IN'), 'SOUTH_ASIA');
  assert.equal(resolveGeoRegionCode('AE'), 'WEST_ASIA');
  assert.equal(resolveGeoRegionCode('KE'), 'AFRICA');
  assert.equal(resolveGeoRegionCode('GB'), null);
  assert.equal(resolveGeoRegionCode('TH'), null);

  assert.equal(geoPricingRegionsMatch('IN', 'PK'), true);
  assert.equal(geoPricingRegionsMatch('IN', 'GB'), false);
  assert.equal(geoPricingRegionsMatch('GB', 'US'), true);

  const southAsia = applyGeoPricing({ listAmount: 190, campaignAmount: 133, countryCode: 'PK' });
  assert.equal(southAsia.geoPricingApplied, true);
  assert.equal(southAsia.effectiveAmount, 133);

  const thailand = applyGeoPricing({ listAmount: 190, campaignAmount: 133, countryCode: 'TH' });
  assert.equal(thailand.geoPricingApplied, false);
  assert.equal(thailand.effectiveAmount, 133);

  const uk = applyGeoPricing({ listAmount: 190, campaignAmount: 133, countryCode: 'GB' });
  assert.equal(uk.geoPricingApplied, false);
  assert.equal(uk.effectiveAmount, 133);

  assert.equal(shouldApplyRegionalPricingAtCheckout({ geoPricingApplied: true }), true);
  assert.equal(shouldApplyRegionalPricingAtCheckout({ geoPricingApplied: false }), false);

  const geoOrder = { regionalPricingApplied: true } as PaymentOrder;
  assert.equal(shouldVerifyRegionalPricing(geoOrder), true);

  const standardOrder = { regionalPricingApplied: false } as PaymentOrder;
  assert.equal(shouldVerifyRegionalPricing(standardOrder), false);

  console.log('geo pricing + paymentRegionalVerification tests passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
