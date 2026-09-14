const DEFAULT_SITE_URL = 'https://vls-online.com';

const ALLOWED_CHECKOUT_RETURN_HOSTS = new Set([
  'vls-online.com',
  'www.vls-online.com',
  'prod.vls-online.com',
  'staging.vls-online.com',
  'preview.vls-online.com',
  'localhost',
  '127.0.0.1',
]);

export function defaultCheckoutSiteUrl(): string {
  return (process.env.PUBLIC_SITE_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
}

function isLocalHttpHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

/** Stripe/PayPal return host from the requesting site, else PUBLIC_SITE_URL. */
export function resolveCheckoutSiteUrl(origin?: unknown): string {
  if (typeof origin !== 'string' || !origin.trim()) {
    return defaultCheckoutSiteUrl();
  }

  try {
    const url = new URL(origin.trim());
    const hostname = url.hostname.toLowerCase();
    const httpsOk = url.protocol === 'https:';
    const localHttpOk = url.protocol === 'http:' && isLocalHttpHost(hostname);
    if ((!httpsOk && !localHttpOk) || !ALLOWED_CHECKOUT_RETURN_HOSTS.has(hostname)) {
      return defaultCheckoutSiteUrl();
    }
    return `${url.protocol}//${url.host}`.replace(/\/+$/, '');
  } catch {
    return defaultCheckoutSiteUrl();
  }
}
