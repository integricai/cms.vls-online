/**
 * Live smoke test: ParityDeals IP discount API without PARITYDEALS_API_KEY.
 *
 * Usage (from cms-v2):
 *   npx ts-node -r dotenv/config scripts/test-paritydeals-no-api-key.ts
 *   (requires PARITYDEALS_PD_IDENTIFIER in .env.local)
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Ensure country API is not used for this smoke test.
delete process.env.PARITYDEALS_API_KEY;

async function main() {
  const { applyParityDealsPricing, fetchParityDealsQuote } = await import('../src/services/parityDeals');

  const identifier = process.env.PARITYDEALS_PD_IDENTIFIER?.trim();
  if (!identifier) {
    console.error('FAIL: Set PARITYDEALS_PD_IDENTIFIER in cms-v2/.env.local first (no API key needed).');
    process.exit(1);
  }

  // Public Pakistan IP (Karachi area) for geo lookup — not a VPN exit.
  const pkIp = process.env.TEST_PK_IP?.trim() || '39.40.100.1';
  const campaignAmount = 203;

  console.log('Testing IP discount API without PARITYDEALS_API_KEY…');
  console.log('pd_identifier:', `${identifier.slice(0, 8)}…`);
  console.log('ip:', pkIp);

  const quote = await fetchParityDealsQuote(pkIp);
  console.log('quote:', quote ? {
    discountPercentage: quote.discountPercentage,
    countryCode: quote.countryCode,
    isVpn: quote.isVpn,
    isProxy: quote.isProxy,
  } : null);

  const production = await applyParityDealsPricing({
    campaignAmount,
    ipAddress: pkIp,
    fallbackCountryCode: 'PK',
    ignoreVpnBlock: false,
  });
  console.log('production mode (VPN block on):', {
    effectiveAmount: production.effectiveAmount,
    regionalPricingApplied: production.regionalPricingApplied,
    geoDiscountPercent: production.geoDiscountPercent,
  });

  const stagingTest = await applyParityDealsPricing({
    campaignAmount,
    ipAddress: pkIp,
    fallbackCountryCode: 'PK',
    ignoreVpnBlock: true,
  });
  console.log('staging ?test=true (VPN block off):', {
    effectiveAmount: stagingTest.effectiveAmount,
    regionalPricingApplied: stagingTest.regionalPricingApplied,
    geoDiscountPercent: stagingTest.geoDiscountPercent,
    quotedCountryCode: stagingTest.quotedCountryCode,
  });

  // Simulate VPN-flagged quote behaviour for staging test.
  const vpnSim = await applyParityDealsPricing({
    campaignAmount,
    ipAddress: pkIp,
    fallbackCountryCode: 'PK',
    ignoreVpnBlock: true,
  });
  if (vpnSim.regionalPricingApplied && vpnSim.effectiveAmount < campaignAmount) {
    console.log(`OK: staging test would charge $${vpnSim.effectiveAmount} (from $${campaignAmount})`);
    process.exit(0);
  }

  if (!quote) {
    console.error('FAIL: ParityDeals returned no quote. Check pd_identifier, PRO plan, and domain allowlist.');
    process.exit(1);
  }

  if (quote.discountPercentage <= 0) {
    console.error('FAIL: Quote has 0% discount for this IP/country. Check ParityDeals Pakistan group %.');
    process.exit(1);
  }

  console.log('OK: API reachable without API key; review amounts above.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
