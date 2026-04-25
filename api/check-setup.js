// Diagnostic endpoint — only responds when AUTH_DEBUG=1 is set.
// Remove or delete this file once the issue is resolved.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (String(process.env.AUTH_DEBUG || '').trim() !== '1') {
    return res.status(403).json({ error: 'Set AUTH_DEBUG=1 to enable this endpoint.' });
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  return res.status(200).json({
    BLOB_READ_WRITE_TOKEN: {
      exists:    blobToken !== undefined,
      truthy:    !!blobToken,
      length:    blobToken ? blobToken.length : 0,
      preview:   blobToken ? blobToken.slice(0, 20) + '...' : null,
    },
    MAILERSEND_API_KEY:  { exists: !!process.env.MAILERSEND_API_KEY },
    ADMIN_AUTH_USERS:    { exists: !!process.env.ADMIN_AUTH_USERS, length: (process.env.ADMIN_AUTH_USERS||'').length },
    GIST_ID:             { exists: !!process.env.GIST_ID },
    GITHUB_TOKEN:        { exists: !!process.env.GITHUB_TOKEN },
    NODE_ENV:            process.env.NODE_ENV,
    VERCEL_ENV:          process.env.VERCEL_ENV,
  });
}
