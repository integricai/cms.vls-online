const ALERT_TO = process.env.ERROR_ALERT_TO || 'nadir.khan@integricai.co.uk';
const MS_URL = 'https://api.mailersend.com/v1/email';

function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSender(value) {
  const fallback = { email: 'noreply@vls-online.com', name: 'VLS Online Alerts' };
  if (!value) return fallback;
  const match = String(value).match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { ...fallback, email: String(value).trim() };
}

function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (/password|token|secret|key|authorization|cookie/i.test(key)) return [key, '[redacted]'];
    return [key, redact(item)];
  }));
}

function errorDetails(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: 'NonError', message: String(error), stack: '' };
}

function requestDetails(req) {
  if (!req) return {};
  return {
    method: req.method,
    url: req.url,
    headers: redact({
      host: req.headers.host,
      referer: req.headers.referer,
      'user-agent': req.headers['user-agent'],
      'x-forwarded-for': req.headers['x-forwarded-for'],
    }),
    body: redact(req.body),
  };
}

export async function sendErrorAlert({ area, explanation, error, req, extra = {} }) {
  const apiKey = process.env.MAILERSEND_API_KEY;
  if (!apiKey) {
    console.error('[alert] MAILERSEND_API_KEY is not configured; unable to send error alert');
    return;
  }

  const payload = {
    area,
    explanation,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    error: errorDetails(error),
    request: requestDetails(req),
    extra: redact(extra),
  };
  const pretty = JSON.stringify(payload, null, 2);

  const response = await fetch(MS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: parseSender(process.env.ERROR_ALERT_FROM || process.env.EMAIL_FROM),
      to: [{ email: ALERT_TO }],
      subject: `[VLS Website Alert] ${area}`,
      text: pretty,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:760px;margin:0 auto;padding:24px;background:#f9fafb;">
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:24px;">
            <h2 style="margin:0 0 12px;color:#991b1b;">VLS Website Exception Alert</h2>
            <p style="margin:0 0 8px;"><strong>Area:</strong> ${esc(area)}</p>
            <p style="margin:0 0 16px;"><strong>What failed:</strong> ${esc(explanation)}</p>
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
