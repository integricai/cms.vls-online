// Public endpoint - returns BPP books from Neon for live page embeds.
// No auth required; must allow any origin (fetched from Zenler/external pages).

import { neon } from '@neondatabase/serverless';

function rowToBook(row) {
  return {
    id: row.id,
    sortOrder: row.sort_order ?? row.id,
    isActive: row.is_active !== false,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    imageAltText: row.image_alt_text,
    price: Number(row.price),
    discountedPrice: row.discounted_price == null ? null : Number(row.discounted_price),
    currency: row.currency,
    stripeUrl: row.stripe_url,
    sourceUrl: row.source_url,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed', books: [] });

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[publish-bpp-books] DATABASE_URL is not set');
    return res.status(500).json({ books: [] });
  }

  try {
    const sql = neon(dbUrl);
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
    const rows = await sql`
      SELECT *
      FROM books
      WHERE COALESCE(is_active, TRUE) = TRUE
      ORDER BY COALESCE(sort_order, 2147483647) ASC, title ASC, id ASC
    `;
    return res.status(200).json({ books: rows.map(rowToBook) });
  } catch (err) {
    console.error('[publish-bpp-books]', err);
    return res.status(500).json({ books: [] });
  }
}
