import type { Request } from 'express';

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

/**
 * Staging-only regional PPP test mode: ignore VPN/proxy blocks and trust Cloudflare country.
 * Enabled when CMS allows it AND the request opts in (?test=true / header).
 */
export function isParityDealsTestAllowed(): boolean {
  if (envFlagTrue(process.env.ALLOW_PARITYDEALS_TEST)) return true;
  if (envFlagTrue(process.env.ALLOW_EVENDEALS_TEST)) return true;
  const env = envTrim(process.env.CMS_ENV ?? process.env.SITE_ENV).toLowerCase();
  return env === 'staging';
}

export function isParityDealsTestRequest(req: Request): boolean {
  if (!isParityDealsTestAllowed()) return false;

  const header = String(req.get('x-vls-parity-test') ?? '').trim().toLowerCase();
  if (header === '1' || header === 'true' || header === 'yes') return true;

  const query = String(req.query.test ?? '').trim().toLowerCase();
  return query === 'true' || query === '1' || query === 'yes';
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
  const header = String(req.get('x-vls-parity-test') ?? '').trim().toLowerCase();
  const query = String(req.query.test ?? '').trim().toLowerCase();
  const testRequested = header === '1' || header === 'true' || header === 'yes'
    || query === 'true' || query === '1' || query === 'yes';
  const clientIp = String(req.get('x-vls-client-ip') ?? req.get('cf-connecting-ip') ?? '').trim();

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
