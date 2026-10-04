import type { Request } from 'express';
import { rateLimitClientId } from '../middleware/rateLimit';

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstileToken(
  token: unknown,
  req: Request,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: 'Captcha is not configured.' };
  }

  const value = String(token ?? '').trim();
  if (!value || value.length > 2048) {
    return { ok: false, error: 'Please complete the captcha.' };
  }

  let result: { success?: boolean };
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: value,
        remoteip: rateLimitClientId(req),
      }),
    });
    result = await response.json() as { success?: boolean };
  } catch {
    return { ok: false, error: 'Captcha verification is temporarily unavailable.' };
  }

  if (!result.success) {
    return { ok: false, error: 'Captcha verification failed. Please try again.' };
  }

  return { ok: true };
}
