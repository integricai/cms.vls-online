import type { Request } from 'express';

const ALERT_TO = process.env.ERROR_ALERT_TO ?? 'nadir.khan@integricai.co.uk';
const MS_URL = 'https://api.mailersend.com/v1/email';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSender(value: string | undefined) {
  const fallback = { email: 'noreply@vls-online.com', name: 'VLS Online CMS Alerts' };
  if (!value) return fallback;

  const match = value.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].trim(), email: match[2].trim() };
  }

  return { ...fallback, email: value.trim() };
}

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => {
    if (/password|token|secret|key|authorization|cookie/i.test(key)) {
      return [key, '[redacted]'];
    }
    return [key, redact(item)];
  }));
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'NonError',
    message: String(error),
    stack: '',
  };
}

function requestDetails(req?: Request) {
  if (!req) return {};

  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    body: redact(req.body),
    query: redact(req.query),
    params: redact(req.params),
  };
}

export async function sendErrorAlert(input: {
  area: string;
  explanation: string;
  error: unknown;
  req?: Request;
  extra?: Record<string, unknown>;
}): Promise<void> {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    console.error('[alert] MAILERSEND_API_KEY is not configured; unable to send error alert');
    return;
  }

  const payload = {
    area: input.area,
    explanation: input.explanation,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? 'development',
    error: errorDetails(input.error),
    request: requestDetails(input.req),
    extra: redact(input.extra ?? {}),
  };

  const pretty = JSON.stringify(payload, null, 2);
  const response = await fetch(MS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: parseSender(process.env.ERROR_ALERT_FROM ?? process.env.EMAIL_FROM),
      to: [{ email: ALERT_TO }],
      subject: `[VLS CMS Alert] ${input.area}`,
      text: pretty,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;background:#f9fafb;">
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
            <h2 style="margin:0 0 12px;color:#991b1b;">VLS CMS Exception Alert</h2>
            <p style="margin:0 0 8px;"><strong>Area:</strong> ${esc(input.area)}</p>
            <p style="margin:0 0 16px;"><strong>What failed:</strong> ${esc(input.explanation)}</p>
            <pre style="white-space:pre-wrap;background:#111827;color:#f9fafb;border-radius:8px;padding:16px;font-size:12px;line-height:1.5;">${esc(pretty)}</pre>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    console.error('[alert] MailerSend alert failed', response.status, details);
  }
}

