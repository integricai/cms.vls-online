// Vercel serverless function — verifies banner credentials against AUTH_USERS env var
// AUTH_USERS format (set in Vercel dashboard): {"email@example.com":"sha256hash", ...}
// Generate a password hash: https://emn178.github.io/online-tools/sha256.html

import { createHash } from 'crypto';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch(e) {
    return res.status(400).json({ error: 'Invalid request' });
  }

  const { email, password } = body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  let users = {};
  try {
    users = JSON.parse(process.env.AUTH_USERS || '{}');
  } catch(e) {
    return res.status(500).json({ error: 'Server misconfigured — AUTH_USERS env var is not valid JSON' });
  }

  const storedHash = users[email.toLowerCase().trim()];
  if (!storedHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const hash = createHash('sha256').update(password).digest('hex');
  if (hash !== storedHash) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  return res.status(200).json({ ok: true });
}
