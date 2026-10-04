import type { NextFunction, Request, Response } from 'express';
import { isIP } from 'net';
import { sql } from '../db/client';
import { detectClientIpFromRequest } from '../services/geoDetection';
import { sendErrorAlert } from '../utils/errorAlert';
import type { RateLimitDecision } from './rateLimitState';

export type { RateLimitDecision } from './rateLimitState';
export { nextRateLimitState } from './rateLimitState';

export interface RateLimitConsumeResult extends RateLimitDecision {
  bucket: string;
}

function normalizeIpToken(value: string | null | undefined): string | null {
  const raw = String(value ?? '').split(',')[0]?.trim() ?? '';
  if (!raw || /\s/.test(raw)) return null;

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

/** Visitor id for abuse limits. Trusted proxy IP first, then Vercel/CF edge headers. */
export function rateLimitClientId(req: Request): string {
  const trusted = detectClientIpFromRequest(req);
  if (trusted) return trusted;

  const edge = normalizeIpToken(
    req.get('x-vercel-forwarded-for')
    || req.get('x-real-ip')
    || req.get('cf-connecting-ip'),
  );
  if (edge) return edge;
  return 'unknown';
}

function isMissingTable(error: unknown): boolean {
  const err = error as { code?: string; message?: string } | null;
  return err?.code === '42P01'
    || (/cms_rate_limits/i.test(err?.message ?? '') && /does not exist|relation/i.test(err?.message ?? ''));
}

let ensurePromise: Promise<void> | null = null;

async function ensureRateLimitTable(): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS cms_rate_limits (
          bucket            TEXT        PRIMARY KEY,
          window_started_at TIMESTAMPTZ NOT NULL,
          hit_count         INTEGER     NOT NULL DEFAULT 0
        )
      `;
    })().catch(error => {
      ensurePromise = null;
      throw error;
    });
  }
  return ensurePromise;
}

export async function consumeRateLimit(
  bucket: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitConsumeResult> {
  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);

  const run = async () => sql`
    INSERT INTO cms_rate_limits (bucket, window_started_at, hit_count)
    VALUES (${bucket}, ${now.toISOString()}, 1)
    ON CONFLICT (bucket) DO UPDATE SET
      hit_count = CASE
        WHEN cms_rate_limits.window_started_at > ${windowCutoff.toISOString()}
        THEN cms_rate_limits.hit_count + 1
        ELSE 1
      END,
      window_started_at = CASE
        WHEN cms_rate_limits.window_started_at > ${windowCutoff.toISOString()}
        THEN cms_rate_limits.window_started_at
        ELSE ${now.toISOString()}
      END
    RETURNING hit_count, window_started_at
  `;

  let rows;
  try {
    rows = await run();
  } catch (error) {
    if (!isMissingTable(error)) throw error;
    await ensureRateLimitTable();
    rows = await run();
  }

  const row = rows[0] as { hit_count: number; window_started_at: string };
  const windowStartedAt = new Date(row.window_started_at).getTime();
  const retryAfterSec = Math.max(1, Math.ceil((windowStartedAt + windowMs - now.getTime()) / 1000));
  return {
    bucket,
    allowed: Number(row.hit_count) <= limit,
    hitCount: Number(row.hit_count),
    windowStartedAt,
    retryAfterSec,
  };
}

function asKeys(value: string | string[] | null | undefined): string[] {
  if (value == null) return [];
  return (Array.isArray(value) ? value : [value])
    .map(item => item.trim())
    .filter(Boolean);
}

export function rateLimit(options: {
  name: string;
  limit: number;
  windowMs: number;
  keyFrom?: (req: Request) => string | string[] | null | undefined;
}): (req: Request, res: Response, next: NextFunction) => void {
  return async (req, res, next) => {
    try {
      const extraKeys = options.keyFrom ? asKeys(options.keyFrom(req)) : [];
      const keys = extraKeys.length > 0
        ? extraKeys.map(key => `${options.name}:${key}`)
        : [`${options.name}:ip:${rateLimitClientId(req)}`];

      for (const bucket of keys) {
        const result = await consumeRateLimit(bucket, options.limit, options.windowMs);
        if (!result.allowed) {
          res.setHeader('Retry-After', String(result.retryAfterSec));
          res.status(429).json({
            ok: false,
            error: 'Too many requests. Please try again shortly.',
          });
          return;
        }
      }
      next();
    } catch (err) {
      console.error('[rate-limit]', options.name, err);
      sendErrorAlert({
        area: `Rate limiter unavailable (${options.name})`,
        explanation: 'The rate-limit store failed. Abuse-sensitive requests are being rejected until the database is available again.',
        error: err,
        req,
        extra: { limiter: options.name },
      }).catch(alertErr => console.error('[alert] failed to send rate-limit store alert', alertErr));
      res.status(503).json({
        ok: false,
        error: 'Service temporarily unavailable. Please try again shortly.',
      });
    }
  };
}

export const loginIpRateLimit = rateLimit({
  name: 'login',
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

export const loginIdentityRateLimit = rateLimit({
  name: 'login-id',
  limit: 8,
  windowMs: 15 * 60 * 1000,
  keyFrom: req => {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const login = String(body.username ?? body.email ?? '').trim().toLowerCase();
    return login || null;
  },
});

export const freeEnrolIpRateLimit = rateLimit({
  name: 'enrol-free',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export const freeEnrolEmailRateLimit = rateLimit({
  name: 'enrol-free-email',
  limit: 3,
  windowMs: 60 * 60 * 1000,
  keyFrom: req => {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const email = String(body.studentEmail ?? '').trim().toLowerCase();
    return email || null;
  },
});

export const checkoutSessionRateLimit = rateLimit({
  name: 'checkout-session',
  limit: 20,
  windowMs: 15 * 60 * 1000,
});

export const contactIpRateLimit = rateLimit({
  name: 'contact',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export const contactEmailRateLimit = rateLimit({
  name: 'contact-email',
  limit: 3,
  windowMs: 60 * 60 * 1000,
  keyFrom: req => {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const email = String(body.email ?? '').trim().toLowerCase();
    return email || null;
  },
});
