import type { Request } from 'express';
import { isProductionCheckoutDeployment } from './attribution';
import { detectClientIpFromRequest } from './geoDetection';

/** Normalize env flags that may include accidental quotes/spaces from Vercel. */
function envFlagTrue(value: string | undefined): boolean {
  const normalized = String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function envTrim(value: string | undefined): string {
  return String(value ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

function parityTestFlag(value: unknown): boolean {
  if (value === true) return true;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

/**
 * Staging-only regional PPP test mode: ignore VPN/proxy blocks and trust Cloudflare country.
 * A production deployment never allows it. ALLOW_PARITYDEALS_TEST, ALLOW_EVENDEALS_TEST,
 * and SITE_ENV=staging (also set on the pre-cutover live site) do not open the bypass there.
 * Callers must still opt in (?test=true, x-vls-parity-test, or the same flags in the body).
 */
export function isParityDealsTestAllowed(): boolean {
  if (isProductionCheckoutDeployment()) return false;
  if (envFlagTrue(process.env.ALLOW_PARITYDEALS_TEST)) return true;
  if (envFlagTrue(process.env.ALLOW_EVENDEALS_TEST)) return true;
  const env = envTrim(process.env.CMS_ENV ?? process.env.SITE_ENV).toLowerCase();
  return env === 'staging';
}

export function isParityDealsTestRequest(req: Request): boolean {
  if (!isParityDealsTestAllowed()) return false;

  if (parityTestFlag(req.get('x-vls-parity-test'))) return true;
  if (parityTestFlag(req.query?.test)) return true;
  if (parityTestFlag(req.body?.parityDealsTest)) return true;
  if (parityTestFlag(req.body?.test)) return true;
  return false;
}

/** Safe diagnostics for publish pricing (no secrets). */
export function parityDealsRuntimeStatus(req: Request): {
  provider: 'evendeals';
  apiKeyConfigured: boolean;
  productIdConfigured: boolean;
  /** @deprecated Use apiKeyConfigured / productIdConfigured */
  pdIdentifierConfigured: boolean;
  testAllowed: boolean;
  testRequested: boolean;
  testMode: boolean;
  clientIpPresent: boolean;
} {
  const apiKeyConfigured = envTrim(process.env.EVENDEALS_API_KEY).length > 0;
  const productIdConfigured = envTrim(process.env.EVENDEALS_PRODUCT_ID).length > 0;
  const testAllowed = isParityDealsTestAllowed();
  const testRequested = parityTestFlag(req.get('x-vls-parity-test'))
    || parityTestFlag(req.query?.test)
    || parityTestFlag(req.body?.parityDealsTest)
    || parityTestFlag(req.body?.test);
  const clientIp = detectClientIpFromRequest(req) ?? '';

  return {
    provider: 'evendeals',
    apiKeyConfigured,
    productIdConfigured,
    pdIdentifierConfigured: apiKeyConfigured && productIdConfigured,
    testAllowed,
    testRequested,
    testMode: testAllowed && testRequested,
    clientIpPresent: clientIp.length > 0,
  };
}
