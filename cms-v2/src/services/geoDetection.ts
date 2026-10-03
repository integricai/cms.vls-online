import type { Request } from 'express';
import { isIP } from 'net';
import { isValidIsoCountryCode, normalizeCountryCode } from '../utils/isoCountryCodes';
import { proxySecretMatches } from './proxySecret';

export interface GeoDetectionResult {
  countryCode: string | null;
  source: 'manual' | 'cloudflare' | 'vercel' | 'header' | 'unknown';
}

/** First header address, when it is an IP literal. */
function normalizeIpToken(value: string | null | undefined): string | null {
  const raw = String(value ?? '').split(',')[0]?.trim() ?? '';
  if (!raw || /[\s]/.test(raw)) return null;

  let token = raw;
  if (token.startsWith('[')) {
    const end = token.indexOf(']');
    if (end <= 1) return null;
    token = token.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(token)) {
    token = token.slice(0, token.lastIndexOf(':'));
  }
  token = token.replace(/^::ffff:/i, '');
  return isIP(token) ? token : null;
}

/**
 * Visitor IP for Evendeals.
 * x-vls-client-ip is honored only when X-VLS-Proxy-Secret matches VLS_PROXY_SECRET.
 * Otherwise the socket peer is used. Forwarding headers are not: a direct caller can set them
 * when the process is not behind an edge that overwrites them.
 */
export function detectClientIpFromRequest(req: Request): string | null {
  const forwardedClient = normalizeIpToken(req.get('x-vls-client-ip'));
  if (forwardedClient && proxySecretMatches(req.get('x-vls-proxy-secret'))) {
    return forwardedClient;
  }

  const remote = req.socket?.remoteAddress?.replace(/^::ffff:/i, '').trim();
  if (remote && isIP(remote)) return remote;
  return null;
}

/**
 * Country for pricing.
 * x-vls-country is honored only when X-VLS-Proxy-Secret matches VLS_PROXY_SECRET.
 * Query, body, and public geo headers are not: a direct caller can set them.
 */
export function detectCountryFromRequest(req: Request): GeoDetectionResult {
  if (proxySecretMatches(req.get('x-vls-proxy-secret'))) {
    const forwarded = normalizeCountryCode(req.get('x-vls-country'));
    if (forwarded && isValidIsoCountryCode(forwarded)) {
      return { countryCode: forwarded, source: 'header' };
    }
  }

  return { countryCode: null, source: 'unknown' };
}
