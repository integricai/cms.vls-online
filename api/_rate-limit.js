import { neon } from '@neondatabase/serverless';
import { sendErrorAlert } from './_error-alert.js';

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  return neon(url);
}

function isMissingTable(error) {
  return error?.code === '42P01'
    || (/cms_rate_limits/i.test(error?.message ?? '') && /does not exist|relation/i.test(error?.message ?? ''));
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS cms_rate_limits (
      bucket            TEXT        PRIMARY KEY,
      window_started_at TIMESTAMPTZ NOT NULL,
      hit_count         INTEGER     NOT NULL DEFAULT 0
    )
  `;
}

export async function consumeRateLimit({ bucket, limit, windowMs }) {
  const sql = getSql();
  if (!sql) throw new Error('DATABASE_URL is not configured for rate limiting');

  const now = new Date();
  const windowCutoff = new Date(now.getTime() - windowMs);
  const run = () => sql`
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
    await ensureTable(sql);
    rows = await run();
  }

  const row = rows[0];
  const windowStartedAt = new Date(row.window_started_at).getTime();
  return {
    allowed: Number(row.hit_count) <= limit,
    retryAfterSec: Math.max(1, Math.ceil((windowStartedAt + windowMs - now.getTime()) / 1000)),
  };
}

export async function enforceRateLimits(res, checks) {
  try {
    for (const check of checks) {
      if (!check.bucket) continue;
      const result = await consumeRateLimit(check);
      if (!result.allowed) {
        res.setHeader('Retry-After', String(result.retryAfterSec));
        res.status(429).json({ ok: false, error: 'Too many requests. Please try again shortly.' });
        return false;
      }
    }
    return true;
  } catch (error) {
    console.error('[rate-limit]', error);
    await sendErrorAlert({
      area: 'Rate limiter unavailable (contact)',
      explanation: 'The rate-limit store failed. Contact submissions are being rejected until the database is available again.',
      error,
    }).catch(alertErr => console.error('[alert] failed to send rate-limit store alert', alertErr));
    res.status(503).json({
      ok: false,
      error: 'Service temporarily unavailable. Please try again shortly.',
    });
    return false;
  }
}
