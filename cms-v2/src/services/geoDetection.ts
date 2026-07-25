import type { Request } from 'express';
import { isValidIsoCountryCode, normalizeCountryCode } from '../utils/isoCountryCodes';

export interface GeoDetectionResult {
  countryCode: string | null;
  source: 'manual' | 'cloudflare' | 'vercel' | 'header' | 'unknown';
}

/** Best-effort client IP for ParityDeals server-side discount lookup. */
export function detectClientIpFromRequest(req: Request): string | null {
  // Explicit hop from vls-api / Next proxy (visitor IP, not the server).
  const forwardedClient = String(req.get('x-vls-client-ip') ?? '').trim();
  if (forwardedClient) return forwardedClient.split(',')[0]!.trim();

  const cf = String(req.get('cf-connecting-ip') ?? '').trim();
  if (cf) return cf;

  const realIp = String(req.get('x-real-ip') ?? '').trim();
  if (realIp) return realIp;

  const forwarded = String(req.get('x-forwarded-for') ?? '')
    .split(',')
    .map(part => part.trim())
    .find(Boolean);
  if (forwarded) return forwarded;

  const remote = req.socket?.remoteAddress?.trim();
  if (!remote) return null;
  return remote.replace(/^::ffff:/, '');
}

/**
 * Detect visitor country from request headers.
 * Priority: manual override → Cloudflare → Vercel → generic geo headers.
 */
export function detectCountryFromRequest(
  req: Request,
  manualCountryCode?: string | null,
): GeoDetectionResult {
  const manual = normalizeCountryCode(manualCountryCode);
  if (manual && isValidIsoCountryCode(manual)) {
    return { countryCode: manual, source: 'manual' };
  }

  const cloudflare = normalizeCountryCode(req.get('cf-ipcountry'));
  if (cloudflare && cloudflare !== 'XX' && isValidIsoCountryCode(cloudflare)) {
    return { countryCode: cloudflare, source: 'cloudflare' };
  }

  const vercel = normalizeCountryCode(req.get('x-vercel-ip-country'));
  if (vercel && isValidIsoCountryCode(vercel)) {
    return { countryCode: vercel, source: 'vercel' };
  }

  const generic = normalizeCountryCode(
    req.get('x-country-code')
    ?? req.get('x-geo-country')
    ?? req.get('cloudfront-viewer-country'),
  );
  if (generic && isValidIsoCountryCode(generic)) {
    return { countryCode: generic, source: 'header' };
  }

  return { countryCode: null, source: 'unknown' };
}
