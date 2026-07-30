import assert from 'node:assert/strict';
import { applyParityDealsPricing } from './parityDeals';

async function runTests() {
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

  console.log('evendeals pricing tests passed');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
