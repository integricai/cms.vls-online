import type { Request } from 'express';

/**
 * Staging-only ParityDeals test mode: ignore VPN/proxy blocks and trust Cloudflare country.
 * Enabled only when CMS allows it AND the request opts in (?test=true / header).
 */
export function isParityDealsTestAllowed(): boolean {
  const flag = (process.env.ALLOW_PARITYDEALS_TEST ?? '').trim().toLowerCase();
  if (flag === '1' || flag === 'true' || flag === 'yes') return true;
  const env = (process.env.CMS_ENV ?? process.env.SITE_ENV ?? '').trim().toLowerCase();
  return env === 'staging';
}

export function isParityDealsTestRequest(req: Request): boolean {
  if (!isParityDealsTestAllowed()) return false;

  const header = String(req.get('x-vls-parity-test') ?? '').trim().toLowerCase();
  if (header === '1' || header === 'true' || header === 'yes') return true;

  const query = String(req.query.test ?? '').trim().toLowerCase();
  return query === 'true' || query === '1' || query === 'yes';
}
