// Public endpoint - returns course price data from Neon for the inject script
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
    console.error('[publish-course-prices] DATABASE_URL is not set');
    return res.status(500).json({ prices: [] });
  }

  try {
    const sql = neon(dbUrl);
    const rows = await sql`
      SELECT data FROM cms_content WHERE key = 'vls-course-prices' LIMIT 1
    `;
    const data = rows[0]?.data;
    const prices = Array.isArray(data?.prices) ? data.prices : [];
    return res.status(200).json({ prices });
  } catch (err) {
    console.error('[publish-course-prices]', err);
    return res.status(500).json({ prices: [] });
  }
}
