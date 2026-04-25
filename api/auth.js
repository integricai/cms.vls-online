import { createHash } from 'crypto';

function normalizeKey(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function isSha256(value) {
  return /^[0-9a-f]{64}$/i.test(String(value || '').trim());
}

function normalizeSecret(value) {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const raw = String(value).trim();
    if (!raw) return null;
    return isSha256(raw)
      ? { hash: raw.toLowerCase(), plain: null }
      : { hash: null, plain: raw };
  }
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const hashValue = value.hash ?? value.passwordHash ?? value.sha256 ?? value.sha256Hash;
  const plainValue = value.password ?? value.pass ?? value.secret ?? value.value;
  const hash = isSha256(hashValue) ? String(hashValue).trim().toLowerCase() : null;
  const plain = plainValue == null ? null : String(plainValue).trim();
  if (!hash && !plain) return null;
  return { hash, plain: plain || null };
}

function addUserRecord(target, username, secret) {
  const key = normalizeKey(username);
  const normalized = normalizeSecret(secret);
  if (!key || !normalized) return false;
  target[key] = normalized;
  return true;
}

function normalizeUsersShape(value, target) {
  if (!value) return 0;

  if (Array.isArray(value)) {
    return value.reduce(function(count, entry) {
      if (!entry) return count;
      if (Array.isArray(entry) && entry.length >= 2) {
        return count + (addUserRecord(target, entry[0], entry[1]) ? 1 : 0);
      }
      if (typeof entry === 'object') {
        const username = entry.email ?? entry.username ?? entry.user ?? entry.login ?? entry.name;
        if (username != null) return count + (addUserRecord(target, username, entry) ? 1 : 0);
      }
      return count;
    }, 0);
  }

  if (typeof value !== 'object') return 0;

  if ((value.users && typeof value.users === 'object') || (value.admins && typeof value.admins === 'object')) {
    return normalizeUsersShape(value.users || value.admins, target);
  }

  const singleUserKey = value.email ?? value.username ?? value.user ?? value.login ?? value.name;
  if (singleUserKey != null) {
    return addUserRecord(target, singleUserKey, value) ? 1 : 0;
  }

  let count = 0;
  Object.entries(value).forEach(function(entry) {
    if (addUserRecord(target, entry[0], entry[1])) count += 1;
  });
  return count;
}

function parseDelimitedUsers(raw, users) {
  let count = 0;
  raw
    .split(/\r?\n|[;,]+/)
    .map(function(part) { return part.trim(); })
    .filter(Boolean)
    .forEach(function(part) {
      const match = part.match(/^([^:=]+)\s*[:=]\s*(.+)$/);
      if (!match) return;
      if (addUserRecord(users, match[1], match[2])) count += 1;
    });
  return count;
}

function isEmptyUsersContainer(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value !== 'object') return false;
  if ((value.users && typeof value.users === 'object') || (value.admins && typeof value.admins === 'object')) {
    return isEmptyUsersContainer(value.users || value.admins);
  }
  const singleUserKey = value.email ?? value.username ?? value.user ?? value.login ?? value.name;
  if (singleUserKey != null) return false;
  return Object.keys(value).length === 0;
}

function parseUsers(envVar) {
  const raw = String(process.env[envVar] || '').trim();
  if (!raw) return { users: {}, error: null };

  const users = {};
  try {
    const parsed = JSON.parse(raw);
    const count = normalizeUsersShape(parsed, users);
    if (count > 0) return { users, error: null };
    if (isEmptyUsersContainer(parsed)) return { users: {}, error: null };
    return {
      users: null,
      error: `${envVar} env var is valid JSON but does not contain any readable user records`
    };
  } catch(e) {
    const count = parseDelimitedUsers(raw, users);
    if (count > 0) return { users, error: null };
    return {
      users: null,
      error: `${envVar} env var could not be parsed. Use JSON or username:password entries`
    };
  }
}

function matchesUser(users, username, password, hash) {
  const record = users[normalizeKey(username)];
  if (!record) return false;
  if (record.hash && record.hash === hash) return true;
  if (record.plain != null && record.plain === String(password)) return true;
  return false;
}

function authDebugEnabled() {
  return String(process.env.AUTH_DEBUG || '').trim() === '1';
}

function logAuthAttempt(info) {
  if (!authDebugEnabled()) return;
  console.warn('[auth]', JSON.stringify(info));
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

  const adminMatch = matchesUser(admin.users, key, password, hash);
  const userMatch = !adminMatch && matchesUser(regular.users, key, password, hash);
  logAuthAttempt({
    email: key,
    adminUsers: Object.keys(admin.users || {}).length,
    regularUsers: Object.keys(regular.users || {}).length,
    adminMatch: adminMatch,
    userMatch: userMatch
  });

  if (adminMatch) {
    return res.status(200).json({ ok: true, role: 'admin' });
  }
  if (userMatch) {
    return res.status(200).json({ ok: true, role: 'user' });
  }

  return res.status(401).json({ error: 'Invalid email or password' });
}
