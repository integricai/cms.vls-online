// Public endpoint — returns banner data from Neon for the inject script
// No auth required; must allow any origin (fetched from Zenler/external pages)

import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[publish-banner] DATABASE_URL is not set');
    return res.status(500).json({ banners: [] });
  }

  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT data FROM cms_content WHERE key = 'vls-banners' LIMIT 1
    `;
    const data = rows[0]?.data;
    const banners = Array.isArray(data?.banners) ? data.banners : [];
    return res.status(200).json({ banners });
  } catch (err) {
    console.error('[publish-banner]', err);
    return res.status(500).json({ banners: [] });
  }
}
