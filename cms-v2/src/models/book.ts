import { sql } from '../db/client';
import type { BookRecord } from '../../shared/types';

let schemaReady: Promise<void> | null = null;

interface DbRow {
  id: number;
  sort_order: number | null;
  title: string;
  description: string;
  image_url: string;
  image_alt_text: string;
  price: string;
  discounted_price: string | null;
  currency: string;
  stripe_url: string;
  source_url: string;
  last_synced_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

async function ensureBookSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        image_alt_text TEXT NOT NULL DEFAULT '',
        price NUMERIC(10,2) NOT NULL DEFAULT 0,
        discounted_price NUMERIC(10,2),
        currency VARCHAR(8) NOT NULL DEFAULT 'GBP',
        stripe_url TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT 'https://vls-online.com/bppbooks',
        sort_order INTEGER,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS sort_order INTEGER`;
    await sql`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 2147483647), title ASC, id ASC) AS next_order
        FROM books
      )
      UPDATE books
      SET sort_order = ordered.next_order
      FROM ordered
      WHERE books.id = ordered.id
        AND books.sort_order IS NULL
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_books_title_stripe_url_unique ON books(title, stripe_url)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_books_title ON books(title)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_books_sort_order ON books(sort_order ASC, title ASC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC)`;
  })();
  return schemaReady;
}

function rowToBook(row: DbRow): BookRecord {
  return {
    id: row.id,
    sortOrder: row.sort_order ?? row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    imageAltText: row.image_alt_text,
    price: Number(row.price),
    discountedPrice: row.discounted_price != null ? Number(row.discounted_price) : null,
    currency: row.currency,
    stripeUrl: row.stripe_url,
    sourceUrl: row.source_url,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBooks(): Promise<BookRecord[]> {
  await ensureBookSchema();
  const rows = await sql`
    SELECT *
    FROM books
    ORDER BY COALESCE(sort_order, 2147483647) ASC, title ASC, id ASC
  `;
  return (rows as DbRow[]).map(rowToBook);
}

export async function getBook(id: number): Promise<BookRecord | null> {
  await ensureBookSchema();
  const rows = await sql`
    SELECT *
    FROM books
    WHERE id = ${id}
  `;
  return rows[0] ? rowToBook(rows[0] as DbRow) : null;
}

export async function reorderBooks(ids: number[]): Promise<BookRecord[]> {
  await ensureBookSchema();
  const uniqueIds = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
  if (!uniqueIds.length) return listBooks();

  for (let index = 0; index < uniqueIds.length; index += 1) {
    await sql`
      UPDATE books
      SET sort_order = ${index + 1},
          updated_at = NOW()
      WHERE id = ${uniqueIds[index]}
    `;
  }

  await sql`
    WITH tail AS (
      SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(sort_order, 2147483647), title ASC, id ASC) AS rn
      FROM books
      WHERE NOT (id = ANY(${uniqueIds}::int[]))
    )
    UPDATE books
    SET sort_order = ${uniqueIds.length} + tail.rn,
        updated_at = NOW()
    FROM tail
    WHERE books.id = tail.id
  `;

  return listBooks();
}

export async function updateBook(
  id: number,
  data: Partial<Pick<BookRecord, 'title' | 'description' | 'imageUrl' | 'imageAltText' | 'price' | 'discountedPrice' | 'currency' | 'stripeUrl'>>,
): Promise<BookRecord | null> {
  await ensureBookSchema();
  const existing = await getBook(id);
  if (!existing) return null;

  await sql`
    UPDATE books
    SET title = ${data.title ?? existing.title},
        description = ${data.description ?? existing.description},
        image_url = ${data.imageUrl ?? existing.imageUrl},
        image_alt_text = ${data.imageAltText ?? existing.imageAltText},
        price = ${data.price ?? existing.price},
        discounted_price = ${data.discountedPrice !== undefined ? data.discountedPrice : existing.discountedPrice},
        currency = ${data.currency ?? existing.currency},
        stripe_url = ${data.stripeUrl ?? existing.stripeUrl},
        updated_at = NOW()
    WHERE id = ${id}
  `;

  return getBook(id);
}

export async function deleteBook(id: number): Promise<boolean> {
  await ensureBookSchema();
  const rows = await sql`DELETE FROM books WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
