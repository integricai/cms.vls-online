import type { TextValue } from '../types/cms';

/** Crests used by the content-migration header and footer. Empty or old mark URLs resolve to these. */
export const HEADER_CREST_URL = 'https://vls-online.com/media/vls-logo-header-mark.png';
export const FOOTER_CREST_URL = 'https://vls-online.com/media/vls-logo-footer-mark.png';
export const BRAND_NAME = 'Vertex Learning Solutions';
export const BRAND_TAGLINE = 'Changing Behaviours Through Education';

const LEGACY_LOGO_RE = /vertex-learning-solutions-01|vertex-logo-mark|69e4eae99c751|favicon\.png/i;

export function resolveV2LogoUrl(url: string | undefined, crest: 'header' | 'footer'): string {
  const value = String(url || '').trim();
  if (!value || LEGACY_LOGO_RE.test(value)) {
    return crest === 'header' ? HEADER_CREST_URL : FOOTER_CREST_URL;
  }
  return value;
}

function rawText(value: TextValue | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.trim();
  return String(value.text || '').trim();
}

export function brandTitleText(value: TextValue | undefined): TextValue {
  const text = rawText(value);
  if (!text || text.toLowerCase() === 'vertex') return BRAND_NAME;
  return value ?? BRAND_NAME;
}

export function brandTaglineText(value: TextValue | undefined): TextValue {
  const text = rawText(value);
  if (!text || text.toLowerCase() === 'learning solutions') return BRAND_TAGLINE;
  return value ?? BRAND_TAGLINE;
}
