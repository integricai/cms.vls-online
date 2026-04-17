import { createHash } from 'crypto';

function checkUsers(envVar, email, hash) {
  let users = {};
  try { users = JSON.parse(process.env[envVar] || '{}'); } catch(e) { return false; }
  const stored = users[email];
  return stored && stored === hash;
}

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

  const key = email.toLowerCase().trim();
  const hash = createHash('sha256').update(password).digest('hex');

  if (checkUsers('ADMIN_AUTH_USERS', key, hash)) {
    return res.status(200).json({ ok: true, role: 'admin' });
  }
  if (checkUsers('AUTH_USERS', key, hash)) {
    return res.status(200).json({ ok: true, role: 'user' });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}
