import { createHash } from 'crypto';

function parseUsers(envVar) {
  const raw = process.env[envVar];
  if (!raw) return { users: {}, error: null };
  try {
    return { users: JSON.parse(raw), error: null };
  } catch(e) {
    return { users: null, error: `${envVar} env var is not valid JSON` };
  }
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

  const admin = parseUsers('ADMIN_AUTH_USERS');
  if (admin.error) return res.status(500).json({ error: `Server misconfigured — ${admin.error}` });

  const regular = parseUsers('AUTH_USERS');
  if (regular.error) return res.status(500).json({ error: `Server misconfigured — ${regular.error}` });

  if (admin.users[key] && admin.users[key] === hash) {
    return res.status(200).json({ ok: true, role: 'admin' });
  }
  if (regular.users[key] && regular.users[key] === hash) {
    return res.status(200).json({ ok: true, role: 'user' });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}
