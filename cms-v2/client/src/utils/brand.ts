/** Staging v2 mark — blue rounded square with a lowercase v. Not the old crest/wordmark. */
const LEGACY_LOGO_RE = /vertex-learning-solutions-01|vertex-logo-mark|69e4eae99c751|favicon\.png/i;

export function useV2BrandMark(url?: string): boolean {
  const value = String(url || '').trim();
  return !value || LEGACY_LOGO_RE.test(value);
}

export function resolveV2LogoUrl(url?: string): string {
  return useV2BrandMark(url) ? '' : String(url).trim();
}
