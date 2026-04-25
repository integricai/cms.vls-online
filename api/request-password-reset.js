import { randomBytes } from 'crypto';
import { put } from '@vercel/blob';

function normalizeEmail(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function emailExistsInEnv(normalizedEmail, envVar) {
  const raw = String(process.env[envVar] || '').trim();
  if (!raw) return false;

  // ── JSON format ──────────────────────────────────────────────
  try {
    const parsed = JSON.parse(raw);

    // Plain object: {"email@example.com": "password_or_hash", ...}
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.keys(parsed).some(function(k) {
        return String(k).trim().toLowerCase() === normalizedEmail;
      });
    }

    // Array of objects: [{"email":"...", "password":"..."}, ...]
    if (Array.isArray(parsed)) {
      return parsed.some(function(entry) {
        if (!entry || typeof entry !== 'object') return false;
        const candidate = entry.email || entry.username || entry.user || entry.login || entry.name;
        return candidate && String(candidate).trim().toLowerCase() === normalizedEmail;
      });
    }
  } catch (_) { /* not JSON — fall through to delimited */ }

  // ── Delimited format: "email:password,email2:password2" ──────
  return raw.split(/[\r\n;,]+/).some(function(part) {
    const match = part.trim().match(/^([^:=]+)\s*[:=]/);
    return match && String(match[1]).trim().toLowerCase() === normalizedEmail;
  });
}

function findUserRole(email) {
  const key = normalizeEmail(email);
  if (!key) return null;
  if (emailExistsInEnv(key, 'ADMIN_AUTH_USERS')) return 'admin';
  if (emailExistsInEnv(key, 'AUTH_USERS'))       return 'user';
  return null;
}

function getAppUrl(req) {
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  const host  = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return host ? `${proto}://${host}` : '';
}

function buildResetEmail(email, resetUrl) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Reset your password</title></head><body>
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#f9fafb;">
  <div style="background:#fff;border-radius:10px;padding:36px 32px;border:1px solid #e5e7eb;">
    <h2 style="color:#204280;margin:0 0 16px;font-size:20px;font-weight:700;">Reset your CMS password</h2>
    <p style="color:#4b5563;line-height:1.7;margin:0 0 8px;font-size:14px;">
      We received a request to reset the password for <strong>${email}</strong>.
      Click the button below to set a new password. This link expires in <strong>30 minutes</strong>.
    </p>
    <div style="text-align:center;margin:28px 0;">
      <a href="${resetUrl}"
         style="background:#534AB7;color:#fff;text-decoration:none;border-radius:8px;
                padding:12px 32px;font-size:15px;font-weight:600;display:inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">If the button doesn't work, copy and paste this link:</p>
    <p style="color:#534AB7;font-size:12px;word-break:break-all;margin:0 0 24px;">${resetUrl}</p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">
      If you didn't request a password reset, you can safely ignore this email — your password won't change.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0;">VLS Online CMS</p>
  </div>
</div>
</body></html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (_) { return res.status(400).json({ error: 'Invalid request' }); }

  const email = normalizeEmail((body || {}).email || '');
  if (!email) return res.status(400).json({ error: 'Email address is required.' });

  // Diagnostic logging — visible in Vercel function logs
  const adminRaw = String(process.env.ADMIN_AUTH_USERS || '');
  const userRaw  = String(process.env.AUTH_USERS || '');
  console.warn('[reset] email:', email);
  console.warn('[reset] ADMIN_AUTH_USERS set:', !!adminRaw, '| length:', adminRaw.length, '| starts:', adminRaw.slice(0, 40));
  console.warn('[reset] AUTH_USERS set:', !!userRaw, '| length:', userRaw.length);
  console.warn('[reset] adminExists:', emailExistsInEnv(email, 'ADMIN_AUTH_USERS'));
  console.warn('[reset] userExists:',  emailExistsInEnv(email, 'AUTH_USERS'));

  const role = findUserRole(email);
  console.warn('[reset] role:', role);

  if (!role) {
    // If AUTH_DEBUG=1, include diagnostic detail in the response to help troubleshoot
    if (String(process.env.AUTH_DEBUG || '') === '1') {
      return res.status(404).json({
        error: 'No account found with that email address.',
        _debug: {
          email,
          adminAuthUsersSet: !!adminRaw,
          adminAuthUsersLength: adminRaw.length,
          adminAuthUsersStart: adminRaw.slice(0, 60),
          adminExistsCheck: emailExistsInEnv(email, 'ADMIN_AUTH_USERS'),
        }
      });
    }
    return res.status(404).json({ error: 'No account found with that email address.' });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Password reset is not available (storage not configured).' });
  }
  if (!process.env.MAILERSEND_API_KEY) {
    return res.status(500).json({ error: 'Password reset is not available (email service not configured).' });
  }

  const token   = randomBytes(32).toString('hex');
  const expires = Date.now() + 30 * 60 * 1000; // 30 minutes

  await put(
    `cms/reset-tokens/${token}.json`,
    JSON.stringify({ email, role, expires }),
    { access: 'private', addRandomSuffix: false }
  );

  const appUrl   = getAppUrl(req);
  const resetUrl = `${appUrl}/?reset_token=${token}`;

  try {
    const msResp = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: { email: 'noreply@vls-online.com', name: 'VLS Online CMS' },
        to:   [{ email }],
        subject: 'Reset your CMS password',
        html: buildResetEmail(email, resetUrl)
      })
    });
    if (!msResp.ok) {
      const errText = await msResp.text().catch(() => '');
      console.error('[reset] MailerSend error', msResp.status, errText);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }
  } catch (e) {
    console.error('[reset] email send exception', e);
    return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }

  return res.status(200).json({
    ok: true,
    message: `A password reset link has been sent to ${email}. It expires in 30 minutes.`
  });
}
