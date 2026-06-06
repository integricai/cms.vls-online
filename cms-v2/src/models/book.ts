import { sql } from '../db/client';
import type { BookRecord } from '../../shared/types';

let schemaReady: Promise<void> | null = null;
let stripeReferenceBackfillReady: Promise<void> | null = null;

interface DbRow {
  id: number;
  sort_order: number | null;
  is_active: boolean;
  quantity: number | null;
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
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        quantity INTEGER NOT NULL DEFAULT 0,
        last_synced_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS sort_order INTEGER`;
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 0`;
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
    await sql`CREATE INDEX IF NOT EXISTS idx_books_is_active_sort_order ON books(is_active, sort_order ASC, title ASC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_books_updated_at ON books(updated_at DESC)`;
  })();
  return schemaReady;
}

function slugForStripeReference(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 150) || 'book';
}

function stripeReferenceForBook(book: Pick<BookRecord, 'id' | 'title'>): string {
  return `book_${book.id}_${slugForStripeReference(book.title)}`.slice(0, 200);
}

export function stripeUrlWithBookReference(
  stripeUrl: string,
  book: Pick<BookRecord, 'id' | 'title'>,
): string {
  const raw = stripeUrl.trim();
  if (!raw || !book.id) return raw;
  const reference = stripeReferenceForBook(book);

  try {
    const url = new URL(raw);
    url.searchParams.set('client_reference_id', reference);
    return url.toString();
  } catch {
    const separator = raw.includes('?') ? '&' : '?';
    return `${raw}${separator}client_reference_id=${encodeURIComponent(reference)}`;
  }
}

async function backfillStripeReferences(): Promise<void> {
  stripeReferenceBackfillReady ??= (async () => {
    await ensureBookSchema();
    const rows = await sql`
      SELECT id, title, stripe_url
      FROM books
      WHERE stripe_url <> ''
    `;

    for (const row of rows as Pick<DbRow, 'id' | 'title' | 'stripe_url'>[]) {
      const nextUrl = stripeUrlWithBookReference(row.stripe_url, { id: row.id, title: row.title });
      if (nextUrl !== row.stripe_url) {
        await sql`
          UPDATE books
          SET stripe_url = ${nextUrl}
          WHERE id = ${row.id}
        `;
      }
    }
  })();
  return stripeReferenceBackfillReady;
}

function rowToBook(row: DbRow): BookRecord {
  return {
    id: row.id,
    sortOrder: row.sort_order ?? row.id,
    isActive: row.is_active !== false,
    quantity: Number(row.quantity ?? 0),
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

export async function updateBookQuantities(bookIds?: number[]): Promise<void> {
  await ensureBookSchema();
  const ids = Array.isArray(bookIds)
    ? Array.from(new Set(bookIds.filter(id => Number.isInteger(id) && id > 0)))
    : [];

  if (ids.length) {
    await sql`
      WITH counts AS (
        SELECT books.id, COUNT(book_discount_codes.id)::int AS quantity
        FROM books
        LEFT JOIN book_discount_codes ON book_discount_codes.book_id = books.id
        WHERE books.id = ANY(${ids}::int[])
        GROUP BY books.id
      )
      UPDATE books
      SET quantity = counts.quantity,
          updated_at = NOW()
      FROM counts
      WHERE books.id = counts.id
    `;
    return;
  }

  await sql`
    WITH counts AS (
      SELECT books.id, COUNT(book_discount_codes.id)::int AS quantity
      FROM books
      LEFT JOIN book_discount_codes ON book_discount_codes.book_id = books.id
      GROUP BY books.id
    )
    UPDATE books
    SET quantity = counts.quantity,
        updated_at = NOW()
    FROM counts
    WHERE books.id = counts.id
  `;
}

export async function listBooks(): Promise<BookRecord[]> {
  await ensureBookSchema();
  await backfillStripeReferences();
  const rows = await sql`
    SELECT *
    FROM books
    ORDER BY COALESCE(sort_order, 2147483647) ASC, title ASC, id ASC
  `;
  return (rows as DbRow[]).map(rowToBook);
}

export async function listPublicBooks(): Promise<BookRecord[]> {
  await ensureBookSchema();
  await backfillStripeReferences();
  const rows = await sql`
    SELECT *
    FROM books
    WHERE is_active = TRUE
    ORDER BY COALESCE(sort_order, 2147483647) ASC, title ASC, id ASC
  `;
  return (rows as DbRow[]).map(rowToBook);
}

export async function getBook(id: number): Promise<BookRecord | null> {
  await ensureBookSchema();
  await backfillStripeReferences();
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

export async function createBook(
  data: Pick<BookRecord, 'title' | 'description' | 'imageUrl' | 'imageAltText' | 'price' | 'discountedPrice' | 'currency' | 'stripeUrl' | 'isActive'>,
): Promise<BookRecord> {
  await ensureBookSchema();
  const rows = await sql`
    INSERT INTO books
      (title, description, image_url, image_alt_text, price, discounted_price, currency, stripe_url, source_url, sort_order, is_active)
    VALUES
      (${data.title}, ${data.description}, ${data.imageUrl}, ${data.imageAltText}, ${data.price},
       ${data.discountedPrice}, ${data.currency}, ${data.stripeUrl}, 'manual',
       COALESCE((SELECT MAX(sort_order) + 1 FROM books), 1), ${data.isActive})
    RETURNING *
  `;
  const inserted = rowToBook(rows[0] as DbRow);
  const stripeUrl = stripeUrlWithBookReference(inserted.stripeUrl, inserted);
  if (stripeUrl !== inserted.stripeUrl) {
    await sql`
      UPDATE books
      SET stripe_url = ${stripeUrl}
      WHERE id = ${inserted.id}
    `;
  }
  return getBook(inserted.id) as Promise<BookRecord>;
}

export async function updateBook(
  id: number,
  data: Partial<Pick<BookRecord, 'title' | 'description' | 'imageUrl' | 'imageAltText' | 'price' | 'discountedPrice' | 'currency' | 'stripeUrl' | 'isActive'>>,
): Promise<BookRecord | null> {
  await ensureBookSchema();
  const existing = await getBook(id);
  if (!existing) return null;
  const nextTitle = data.title ?? existing.title;
  const nextStripeUrl = stripeUrlWithBookReference(data.stripeUrl ?? existing.stripeUrl, {
    id,
    title: nextTitle,
  });

  await sql`
    UPDATE books
    SET title = ${nextTitle},
        description = ${data.description ?? existing.description},
        image_url = ${data.imageUrl ?? existing.imageUrl},
        image_alt_text = ${data.imageAltText ?? existing.imageAltText},
        price = ${data.price ?? existing.price},
        discounted_price = ${data.discountedPrice !== undefined ? data.discountedPrice : existing.discountedPrice},
        currency = ${data.currency ?? existing.currency},
        stripe_url = ${nextStripeUrl},
        is_active = ${data.isActive ?? existing.isActive},
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
