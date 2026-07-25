/**
 * Legacy entrypoint — regional PPP now uses Evendeals.
 * Kept so existing imports/tests keep working.
 */
export {
  applyEvenDealsPricing as applyParityDealsPricing,
  applyEvenDealsPricing,
  fetchEvenDealsQuote,
  type RegionalPricingApplyResult,
} from './evenDeals';
