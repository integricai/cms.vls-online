import { list, del } from '@vercel/blob';
import { readLatestBlobVersion, writeBlobVersion } from './_cms-blob-store.js';
import { sendErrorAlert } from './_error-alert.js';

async function readToken(token) {
  let result;
  try {
    result = await list({ prefix: `cms/reset-tokens/${token}.json`, limit: 1 });
  } catch (_) { return null; }

  const blobs = (result && result.blobs) ? result.blobs : [];
  if (!blobs.length) return null;

  const blob = blobs[0];
  try {
    const resp = await fetch(blob.url);
    if (!resp.ok) return null;
    const data = await resp.json();
    data._url = blob.url;
    return data;
  } catch (_) { return null; }
}

async function deleteToken(url) {
  try { await del(url); } catch (_) {}
}

async function savePasswordOverride(email, password, role) {
  const overrides = (await readLatestBlobVersion('password-overrides')) || {};
  overrides[email] = { password, role: role || 'user' };
  await writeBlobVersion('password-overrides', overrides);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    await sendErrorAlert({
      area: 'Legacy reset password storage configuration',
      explanation: 'Reset password could not run because BLOB_READ_WRITE_TOKEN is missing.',
      error: new Error('BLOB_READ_WRITE_TOKEN is not configured'),
      req,
    }).catch(alertErr => console.error('[alert] reset password config alert failed', alertErr));
    return res.status(500).json({ error: 'Password reset is not available (storage not configured).' });
  }

  let body;
  try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body; }
  catch (_) { return res.status(400).json({ error: 'Invalid request' }); }

  const { token, password } = body || {};
  if (!token || !password) {
    return res.status(400).json({ error: 'Token and new password are required.' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  let tokenData;
  try {
    tokenData = await readToken(token);
  } catch (e) {
    console.error('[reset-password] token read error', e);
    await sendErrorAlert({
      area: 'Legacy reset password token read failed',
      explanation: 'Reset password could not read the reset token from Vercel Blob.',
      error: e,
      req,
      extra: { tokenPresent: Boolean(token) },
    }).catch(alertErr => console.error('[alert] reset password token read alert failed', alertErr));
    return res.status(500).json({ error: 'Password reset is not available. Please try again.' });
  }

  if (!tokenData) {
    return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
  }
  if (Date.now() > tokenData.expires) {
    await deleteToken(tokenData._url);
    return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
  }

  const { email, role } = tokenData;

  // Delete token immediately — single use
  await deleteToken(tokenData._url);

  // Persist the new password in Vercel Blob (plain text; auth.js normalises it)
  try {
    await savePasswordOverride(email, String(password), role || 'user');
  } catch (e) {
    console.error('[reset-password] blob write error', e);
    await sendErrorAlert({
      area: 'Legacy reset password save failed',
      explanation: 'Reset password could not persist the new password override to Vercel Blob.',
      error: e,
      req,
      extra: { email, role },
    }).catch(alertErr => console.error('[alert] reset password save alert failed', alertErr));
    return res.status(500).json({ error: 'Failed to save new password. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
