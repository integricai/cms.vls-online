// Vercel serverless function — reads/writes vls-events.json in the GitHub Gist
// GET  → returns { events, rawUrl }
// POST → saves events array, returns { rawUrl }

async function getGist(token, gistId) {
  const r = await fetch(`https://api.github.com/gists/${gistId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'VLS-CMS'
    }
  });
  return r;
}

export default async function handler(req, res) {
  const token  = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID;
  if (!token || !gistId) {
    return res.status(500).json({ error: 'Server misconfigured — env vars missing' });
  }

  // ── GET: read current events ────────────────────────────────
  if (req.method === 'GET') {
    const ghRes = await getGist(token, gistId);
    const data  = await ghRes.json();
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: data.message || 'GitHub error' });

    const file = data.files && data.files['vls-events.json'];
    let events = [];
    if (file && file.content) {
      try { events = JSON.parse(file.content).events || []; } catch(e) {}
    }
    const rawUrl = `https://gist.githubusercontent.com/${data.owner.login}/${data.id}/raw/vls-events.json`;
    return res.status(200).json({ events, rawUrl });
  }

  // ── POST: save events ───────────────────────────────────────
  if (req.method === 'POST') {
    let body;
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch(e) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const events = body.events || [];
    const ghRes = await fetch(`https://api.github.com/gists/${gistId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'VLS-CMS'
      },
      body: JSON.stringify({
        files: { 'vls-events.json': { content: JSON.stringify({ events }, null, 2) } }
      })
    });

    const data = await ghRes.json();
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: data.message || 'GitHub error' });

    const rawUrl = `https://gist.githubusercontent.com/${data.owner.login}/${data.id}/raw/vls-events.json`;
    return res.status(200).json({ rawUrl });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
