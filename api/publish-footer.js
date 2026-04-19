// Vercel serverless function — reads/writes vls-footer.json in the GitHub Gist
// GET  → returns { footer }
// POST → saves footer object

async function getGist(token, gistId) {
  return fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'VLS-CMS'
    }
  });
}

export default async function handler(req, res) {
  const token  = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID;
  if (!token || !gistId) {
    return res.status(500).json({ error: 'Server misconfigured — env vars missing' });
  }

  // ── GET: read footer ────────────────────────────────────────
  if (req.method === 'GET') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');

    const ghRes = await getGist(token, gistId);
    const data  = await ghRes.json();
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: data.message || 'GitHub error' });

    const file = data.files && data.files['vls-footer.json'];
    let footer = null;
    if (file && file.content) {
      try { footer = JSON.parse(file.content).footer || null; } catch(e) {}
    }
    return res.status(200).json({ footer });
  }

  // ── POST: save footer ───────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const footer = body.footer || {};
    const ghRes = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'VLS-CMS'
      },
      body: JSON.stringify({
        files: { 'vls-footer.json': { content: JSON.stringify({ footer }, null, 2) } }
      })
    });

    const data = await ghRes.json();
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: data.message || 'GitHub error' });
    return res.status(200).json({ ok: true });
  }

  // ── OPTIONS: CORS preflight ─────────────────────────────────
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    return res.status(204).end();
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
