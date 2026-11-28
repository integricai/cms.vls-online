import type { Request, Response } from 'express';

export const VAULT_SESSION_COOKIE = 'vault_session';
const DAY_SECONDS = 24 * 60 * 60;

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

export function setSessionCookie(res: Response, req: Request, token: string): void {
  res.append('Set-Cookie', buildSessionCookie(token, requestHost(req), DAY_SECONDS));
}

export function clearSessionCookie(res: Response, req: Request): void {
  res.append('Set-Cookie', buildSessionCookie('', requestHost(req), 0));
}

export function buildSessionCookie(token: string, host: string, maxAge = DAY_SECONDS): string {
  const hostname = host.split(':')[0].toLowerCase();
  const local = hostname === 'localhost' || hostname === '127.0.0.1';
  const parts = [
    `${VAULT_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    `Max-Age=${maxAge}`,
    'SameSite=Lax',
  ];
  if (!local) {
    parts.push('Secure');
    if (hostname === 'cms.vls-online.com' || hostname.endsWith('.cms.vls-online.com')) {
      parts.push('Domain=.cms.vls-online.com');
    }
  }
  return parts.join('; ');
}

function requestHost(req: Request): string {
  return (req.get('host') ?? '').toLowerCase();
}
