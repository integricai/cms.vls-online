import { timingSafeEqual } from 'crypto';

/**
 * Shared with vls-web and vls-api.
 * A forwarded visitor IP is ignored unless X-VLS-Proxy-Secret matches this value.
 */
export function configuredProxySecret(): string {
  return String(process.env.VLS_PROXY_SECRET ?? '')
    .trim()
    .replace(/^['"]|['"]$/g, '');
}

export function proxySecretMatches(provided: unknown): boolean {
  const expected = configuredProxySecret();
  const actual = String(provided ?? '').trim();
  if (!expected || !actual) return false;
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(actual);
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
