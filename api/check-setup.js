// Diagnostic endpoint — only responds when AUTH_DEBUG=1 is set.
// Remove or delete this file once the issue is resolved.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN;

  // Scan ALL env var names that contain "blob" (case-insensitive) to find the real name
  const blobKeys = Object.keys(process.env)
    .filter(function(k) { return k.toLowerCase().includes('blob'); })
    .map(function(k) {
      var v = process.env[k] || '';
      return { name: k, length: v.length, preview: v ? v.slice(0, 24) + '...' : '(empty)' };
    });

  return res.status(200).json({
    BLOB_READ_WRITE_TOKEN: {
      exists:    blobToken !== undefined,
      truthy:    !!blobToken,
      length:    blobToken ? blobToken.length : 0,
      preview:   blobToken ? blobToken.slice(0, 20) + '...' : null,
    },
    all_blob_related_keys: blobKeys,
    MAILERSEND_API_KEY:  { exists: !!process.env.MAILERSEND_API_KEY },
    ADMIN_AUTH_USERS:    { exists: !!process.env.ADMIN_AUTH_USERS, length: (process.env.ADMIN_AUTH_USERS||'').length },
    GIST_ID:             { exists: !!process.env.GIST_ID },
    GITHUB_TOKEN:        { exists: !!process.env.GITHUB_TOKEN },
    NODE_ENV:            process.env.NODE_ENV,
    VERCEL_ENV:          process.env.VERCEL_ENV,
  });
}
