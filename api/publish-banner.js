// Vercel serverless function — proxies Gist updates using the secret token
// The GITHUB_TOKEN env var is set in Vercel dashboard, never exposed to the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token  = process.env.GITHUB_TOKEN;
  const gistId = process.env.GIST_ID;

  if (!token || !gistId) {
    return res.status(500).json({ error: 'Server misconfigured — env vars missing' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Forward to GitHub Gist API
  const ghRes = await fetch(`https://api.github.com/gists/${gistId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'VLS-CMS'
    },
    body: JSON.stringify({
      files: {
        'vls-banner.json': {
          content: JSON.stringify(body, null, 2)
        }
      }
    })
  });

  const data = await ghRes.json();

  if (!ghRes.ok) {
    return res.status(ghRes.status).json({ error: data.message || 'GitHub error' });
  }

  // Use the non-versioned raw URL so the inject script always fetches the latest banner
  // (versioned raw_url changes on every publish — this format always points to current)
  const rawUrl = `https://gist.githubusercontent.com/${data.owner.login}/${data.id}/raw/vls-banner.json`;
  return res.status(200).json({ rawUrl });
}
