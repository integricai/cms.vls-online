/**
 * Live smoke test: Evendeals server discount API.
 *
 * Usage (from cms-v2):
 *   npx ts-node -r dotenv/config scripts/test-evendeals.ts
 *   (requires EVENDEALS_API_KEY + EVENDEALS_PRODUCT_ID in .env.local)
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { applyEvenDealsPricing, fetchEvenDealsQuote } = await import('../src/services/evenDeals');

  const key = process.env.EVENDEALS_API_KEY?.trim();
  const productId = process.env.EVENDEALS_PRODUCT_ID?.trim();
  if (!key || !productId) {
    console.error('FAIL: Set EVENDEALS_API_KEY and EVENDEALS_PRODUCT_ID in cms-v2/.env.local');
    process.exit(1);
  }

  const pkIp = process.env.TEST_PK_IP?.trim() || '39.40.100.1';
  const campaignAmount = 203;

  console.log('Testing Evendeals IP discount API…');
  console.log('productId:', productId);
  console.log('ip:', pkIp);

  const quote = await fetchEvenDealsQuote(pkIp);
  console.log('quote:', quote ? {
    discountPercentage: quote.discountPercentage,
    countryCode: quote.countryCode,
    isVpn: quote.isVpn,
    blockVpn: quote.blockVpn,
  } : null);

  const stagingTest = await applyEvenDealsPricing({
    campaignAmount,
    ipAddress: pkIp,
    fallbackCountryCode: 'PK',
    ignoreVpnBlock: true,
  });
  console.log('staging ?test=true:', {
    effectiveAmount: stagingTest.effectiveAmount,
    regionalPricingApplied: stagingTest.regionalPricingApplied,
    geoDiscountPercent: stagingTest.geoDiscountPercent,
  });

  if (stagingTest.regionalPricingApplied && stagingTest.effectiveAmount < campaignAmount) {
    console.log(`OK: would charge $${stagingTest.effectiveAmount} (from $${campaignAmount})`);
    process.exit(0);
  }

  if (!quote) {
    console.error('FAIL: Evendeals returned no quote. Check API key, productId, discounts, and Active deal.');
    process.exit(1);
  }

  console.error('FAIL: Quote present but discount not applied.');
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
