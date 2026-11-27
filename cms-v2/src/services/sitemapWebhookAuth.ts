import { createHmac } from 'crypto';
import { secretEquals } from '../utils/secretEquals';

/** Storyblok signs the raw POST body and sends the hex HMAC-SHA1 in `webhook-signature`. */
export function storyblokWebhookSignature(rawBody: Buffer | string, secret: string): string {
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  return createHmac('sha1', secret).update(payload).digest('hex');
}

export function isStoryblokWebhookSignatureValid(
  rawBody: Buffer | string,
  signatureHeader: string,
  secret: string,
): boolean {
  const provided = signatureHeader.trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(provided)) return false;
  return secretEquals(provided, storyblokWebhookSignature(rawBody, secret));
}

function headerText(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

export function webhookRawBody(req: { rawBody?: Buffer }): Buffer | undefined {
  const raw = req.rawBody;
  return Buffer.isBuffer(raw) && raw.length > 0 ? raw : undefined;
}

/**
 * Storyblok cannot send Authorization. It signs the body.
 * Bearer and x-sitemap-secret stay valid for the Next.js forwarder.
 */
export function isSitemapWebhookAuthorized(input: {
  authorization?: string;
  sitemapSecret?: string;
  webhookSignature?: string;
  rawBody?: Buffer | string;
  secret?: string;
}): boolean {
  const expected = input.secret?.trim();
  if (!expected) return false;

  const authorization = input.authorization?.trim() ?? '';
  if (authorization && secretEquals(authorization, `Bearer ${expected}`)) return true;

  const sitemapSecret = input.sitemapSecret?.trim() ?? '';
  if (sitemapSecret && secretEquals(sitemapSecret, expected)) return true;

  const signature = input.webhookSignature?.trim();
  if (!signature || input.rawBody == null || input.rawBody.length === 0) return false;
  return isStoryblokWebhookSignatureValid(input.rawBody, signature, expected);
}

export function isSitemapWebhookRequestAuthorized(
  headers: {
    authorization?: string | string[];
    'x-sitemap-secret'?: string | string[];
    'webhook-signature'?: string | string[];
  },
  rawBody?: Buffer,
): boolean {
  return isSitemapWebhookAuthorized({
    authorization: headerText(headers.authorization),
    sitemapSecret: headerText(headers['x-sitemap-secret']),
    webhookSignature: headerText(headers['webhook-signature']),
    rawBody,
    secret: process.env.SITEMAP_WEBHOOK_SECRET,
  });
}
