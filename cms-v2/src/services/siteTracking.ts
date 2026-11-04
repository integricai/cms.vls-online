/** Same UK and EEA set as the website consent bootstrap. */
export const TRACKING_CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
  'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL',
  'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
] as const;

export const TRACKING_CHANNELS = [
  'Google Ads',
  'Meta',
  'Other campaign',
  'Organic search',
  'Referral',
  'Direct',
] as const;

export type TrackingChannel = (typeof TRACKING_CHANNELS)[number];
export type TrackingDevice = 'mobile' | 'tablet' | 'desktop';
export type TrackingLocale = 'en' | 'ar';
export type TrackingConsent = 'granted' | 'unknown' | 'denied';

export type TrackingVisitInput = {
  consent: TrackingConsent;
  landingPath: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  googleCampaignId: string | null;
  hasGoogleClick: boolean;
  hasMetaClick: boolean;
  referrerHost: string | null;
  device: TrackingDevice;
};

export type ClassifiedTrackingVisit = {
  channel: TrackingChannel;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  term: string | null;
  landingPath: string;
  device: TrackingDevice;
  locale: TrackingLocale;
};

const SEARCH_HOSTS = [
  'google.',
  'bing.com',
  'yahoo.',
  'duckduckgo.com',
  'baidu.com',
  'yandex.',
  'ecosia.org',
];

const META_SOURCES = new Set(['facebook', 'fb', 'instagram', 'ig', 'meta', 'an']);
const GOOGLE_SOURCES = new Set(['google', 'googleads', 'adwords', 'youtube']);
const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paidsearch', 'paid_search', 'paidsocial', 'paid_social', 'display', 'cpm']);

function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, max);
  if (!trimmed || /[<>"'`]/.test(trimmed)) return null;
  return trimmed;
}

function cleanHost(value: unknown): string | null {
  const host = cleanText(value, 120)?.toLowerCase().replace(/\.$/, '') ?? null;
  if (!host || !/^[a-z0-9.-]+$/.test(host) || host.includes('..')) return null;
  return host;
}

export function isOwnTrackingHost(host: string): boolean {
  return host === 'localhost'
    || host === '127.0.0.1'
    || host === 'vls-online.com'
    || host.endsWith('.vls-online.com')
    || host.endsWith('.vercel.app');
}

function isSearchHost(host: string): boolean {
  return SEARCH_HOSTS.some(pattern => host.includes(pattern));
}

export function cleanLandingPath(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const path = raw.split('?')[0]?.split('#')[0]?.slice(0, 180) ?? '';
  if (!path.startsWith('/') || path.startsWith('//') || /[<>"'`\s]/.test(path)) return '/';
  return path;
}

export function localeFromLandingPath(path: string): TrackingLocale {
  return path === '/ar' || path.startsWith('/ar/') ? 'ar' : 'en';
}

export function cleanGoogleCampaignId(value: unknown): string | null {
  const id = cleanText(value, 24);
  if (!id || !/^\d{3,24}$/.test(id)) return null;
  return id;
}

function asFlag(value: unknown): boolean {
  return value === true;
}

function asDevice(value: unknown): TrackingDevice {
  return value === 'mobile' || value === 'tablet' ? value : 'desktop';
}

function asConsent(value: unknown): TrackingConsent {
  return value === 'granted' || value === 'denied' ? value : 'unknown';
}

export function parseTrackingVisit(body: unknown): TrackingVisitInput {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  return {
    consent: asConsent(record.consent),
    landingPath: cleanLandingPath(record.landingPath),
    source: cleanText(record.source, 80),
    medium: cleanText(record.medium, 80),
    campaign: cleanText(record.campaign, 120),
    content: cleanText(record.content, 120),
    term: cleanText(record.term, 120),
    googleCampaignId: cleanGoogleCampaignId(record.googleCampaignId),
    hasGoogleClick: asFlag(record.hasGoogleClick),
    hasMetaClick: asFlag(record.hasMetaClick),
    referrerHost: cleanHost(record.referrerHost),
    device: asDevice(record.device),
  };
}

/** Consent was granted, or the visitor is outside the UK and EEA and has not rejected. */
export function trackingAllowed(
  consent: TrackingConsent,
  country: string | null,
  consentRequired: readonly string[],
): boolean {
  if (consent === 'denied') return false;
  if (consent === 'granted') return true;
  if (!country) return false;
  return !consentRequired.includes(country.toUpperCase());
}

export function classifyTrackingVisit(input: TrackingVisitInput): ClassifiedTrackingVisit {
  const sourceName = input.source?.toLowerCase() ?? '';
  const mediumName = input.medium?.toLowerCase().replace(/[\s-]+/g, '_') ?? '';
  const referrer = input.referrerHost && !isOwnTrackingHost(input.referrerHost) ? input.referrerHost : null;
  const paidMedium = PAID_MEDIUMS.has(mediumName);
  const googleSource = GOOGLE_SOURCES.has(sourceName);
  const metaSource = META_SOURCES.has(sourceName);

  let channel: TrackingChannel = 'Direct';
  if (input.hasGoogleClick || (googleSource && paidMedium)) channel = 'Google Ads';
  else if (input.hasMetaClick || metaSource) channel = 'Meta';
  else if (mediumName === 'organic') channel = 'Organic search';
  else if (input.source || input.medium || input.campaign) channel = 'Other campaign';
  else if (referrer && isSearchHost(referrer)) channel = 'Organic search';
  else if (referrer) channel = 'Referral';

  const campaign = input.campaign ?? (channel === 'Google Ads' ? input.googleCampaignId : null);
  const source = input.source ?? (channel === 'Organic search' || channel === 'Referral' ? referrer : null);

  return {
    channel,
    source,
    medium: input.medium,
    campaign,
    content: input.content,
    term: input.term,
    landingPath: input.landingPath,
    device: input.device,
    locale: localeFromLandingPath(input.landingPath),
  };
}
