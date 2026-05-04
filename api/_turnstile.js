const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function getClientIp(req) {
  return String(
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for'] ||
    req.socket?.remoteAddress ||
    ''
  ).split(',')[0].trim();
}

export async function verifyTurnstileToken(token, req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    return { ok: false, error: 'Turnstile is not configured.' };
  }
  if (!token || String(token).length > 2048) {
    return { ok: false, error: 'Please complete the verification.' };
  }

  let result;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: String(token),
        remoteip: getClientIp(req),
      }),
    });
    result = await response.json();
  } catch (error) {
    return { ok: false, error: 'Verification service is temporarily unavailable.', details: error };
  }

  if (!result.success) {
    return {
      ok: false,
      error: 'Verification failed. Please try again.',
      details: result,
    };
  }

  return { ok: true, details: result };
}

