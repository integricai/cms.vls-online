import { createHash } from 'crypto';
import type { ConversionUploadStatus } from '../../shared/types';

export type { ConversionUploadStatus };

const MAX_FIELD_LENGTH = 255;

const CALLING_CODES: Record<string, string> = {
  GB: '44',
  UK: '44',
  US: '1',
  CA: '1',
  AE: '971',
  PK: '92',
  IN: '91',
  SA: '966',
  QA: '974',
  KW: '965',
  BH: '973',
  OM: '968',
  EG: '20',
  NG: '234',
  KE: '254',
  ZA: '27',
  AU: '61',
  NZ: '64',
  IE: '353',
  DE: '49',
  FR: '33',
  ES: '34',
  IT: '39',
  NL: '31',
  SE: '46',
  NO: '47',
  DK: '45',
  PL: '48',
  MY: '60',
  SG: '65',
  HK: '852',
  CN: '86',
};

export type CheckoutAttribution = {
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  capturedAt: Date | null;
  userAgent: string | null;
  clientIp: string | null;
};

export function sanitizeAttributionField(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_FIELD_LENGTH);
  if (!trimmed || /[<>"'`]/.test(trimmed)) return null;
  return trimmed;
}

function parseCapturedAt(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseCheckoutAttribution(
  body: Record<string, unknown>,
  extras?: { userAgent?: string | null; clientIp?: string | null },
): CheckoutAttribution {
  const raw = body.attribution && typeof body.attribution === 'object' && !Array.isArray(body.attribution)
    ? body.attribution as Record<string, unknown>
    : body;

  return {
    gclid: sanitizeAttributionField(raw.gclid),
    gbraid: sanitizeAttributionField(raw.gbraid),
    wbraid: sanitizeAttributionField(raw.wbraid),
    fbclid: sanitizeAttributionField(raw.fbclid),
    fbp: sanitizeAttributionField(raw.fbp),
    fbc: sanitizeAttributionField(raw.fbc),
    utmSource: sanitizeAttributionField(raw.utmSource ?? raw.utm_source),
    utmMedium: sanitizeAttributionField(raw.utmMedium ?? raw.utm_medium),
    utmCampaign: sanitizeAttributionField(raw.utmCampaign ?? raw.utm_campaign),
    utmContent: sanitizeAttributionField(raw.utmContent ?? raw.utm_content),
    utmTerm: sanitizeAttributionField(raw.utmTerm ?? raw.utm_term),
    landingPage: sanitizeAttributionField(raw.landingPage ?? raw.landing_page),
    capturedAt: parseCapturedAt(raw.capturedAt ?? raw.captured_at),
    userAgent: sanitizeAttributionField(raw.userAgent ?? raw.user_agent ?? extras?.userAgent),
    clientIp: sanitizeAttributionField(raw.clientIp ?? raw.client_ip ?? extras?.clientIp),
  };
}

/** Google Ads / Data Manager: trim, lowercase, SHA-256 hex. */
export function hashEmailForAds(email: string | null | undefined): string | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes('@')) return null;
  return createHash('sha256').update(normalized).digest('hex');
}

export function hasGoogleClickId(attribution: Pick<CheckoutAttribution, 'gclid' | 'gbraid' | 'wbraid'>): boolean {
  return Boolean(attribution.gclid || attribution.gbraid || attribution.wbraid);
}

/** E.164 (+447...) before hashing, as required by Google Ads. */
export function normalizePhoneE164(
  phone: string | null | undefined,
  countryCode?: string | null,
): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!trimmed) return null;

  let digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  if (trimmed.startsWith('00')) {
    digits = digits.replace(/^00/, '');
  } else if (!trimmed.startsWith('+')) {
    const callingCode = countryCode ? CALLING_CODES[countryCode.toUpperCase()] : null;
    if (callingCode) {
      if (digits.startsWith('0')) digits = `${callingCode}${digits.slice(1)}`;
      else if (!digits.startsWith(callingCode)) digits = `${callingCode}${digits}`;
    }
  }

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function hashPhoneForAds(
  phone: string | null | undefined,
  countryCode?: string | null,
): string | null {
  const e164 = normalizePhoneE164(phone, countryCode);
  if (!e164) return null;
  return createHash('sha256').update(e164).digest('hex');
}

export function resolveConversionUploadAction(input: {
  gclid: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
  email: string | null;
  phone: string | null;
  countryCode?: string | null;
}): { action: 'upload'; status: 'uploaded' | 'extended_upload' } | { action: 'fail'; status: 'failed'; reason: string } {
  if (hasGoogleClickId({
    gclid: input.gclid,
    gbraid: input.gbraid ?? null,
    wbraid: input.wbraid ?? null,
  })) {
    return { action: 'upload', status: 'uploaded' };
  }

  const hasEmail = Boolean(hashEmailForAds(input.email));
  const hasPhone = Boolean(hashPhoneForAds(input.phone, input.countryCode));
  if (hasEmail || hasPhone) {
    return { action: 'upload', status: 'extended_upload' };
  }

  return {
    action: 'fail',
    status: 'failed',
    reason: 'gclid missing and no phone or email to hash',
  };
}
