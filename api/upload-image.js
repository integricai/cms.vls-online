import { put } from '@vercel/blob';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Image upload requires Blob storage (BLOB_READ_WRITE_TOKEN not set). Paste a direct image URL instead.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (_) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  const { filename, contentType, data } = body || {};
  if (!data) return res.status(400).json({ error: 'No image data provided' });

  const MAX_B64 = 6 * 1024 * 1024; // ~4.5 MB decoded
  if (data.length > MAX_B64) {
    return res.status(400).json({ error: 'Image too large (max ~4.5 MB). Please compress or use a URL.' });
  }

  try {
    const buffer = Buffer.from(data, 'base64');
    const ext    = (filename || 'image').split('.').pop().toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const slug   = 'cms/images/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6) + '.' + ext;
    const result = await put(slug, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType: contentType || 'image/jpeg',
    });
    return res.status(200).json({ ok: true, url: result.url });
  } catch (e) {
    return res.status(500).json({ error: e && e.message ? e.message : 'Upload failed' });
  }
}
