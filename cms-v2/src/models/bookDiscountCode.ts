import { sql } from '../db/client';
import type { BookDiscountCode, BookDiscountCodeInput } from '../../shared/types';

let schemaReady: Promise<void> | null = null;

interface DbRow {
  id: number;
  book_id: number;
  book_name?: string;
  code: string;
  insert_date: string | Date;
  issue_date: string | Date | null;
  customer_email: string;
  created_at: Date;
  updated_at: Date;
}

async function ensureBookDiscountCodeSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS book_discount_codes (
        id SERIAL PRIMARY KEY,
        book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        insert_date DATE NOT NULL DEFAULT CURRENT_DATE,
        issue_date DATE,
        customer_email TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_book_id ON book_discount_codes(book_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_issue_date ON book_discount_codes(issue_date)`;
  })();
  return schemaReady;
}

function dateOnly(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function rowToDiscountCode(row: DbRow): BookDiscountCode {
  return {
    id: row.id,
    bookId: row.book_id,
    bookName: row.book_name,
    code: row.code,
    insertDate: dateOnly(row.insert_date) ?? '',
    issueDate: dateOnly(row.issue_date),
    customerEmail: row.customer_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listBookDiscountCodes(bookId?: number): Promise<BookDiscountCode[]> {
  await ensureBookDiscountCodeSchema();
  const rows = bookId
    ? await sql`
        SELECT bdc.*, books.title AS book_name
        FROM book_discount_codes bdc
        INNER JOIN books ON books.id = bdc.book_id
        WHERE bdc.book_id = ${bookId}
        ORDER BY bdc.insert_date DESC, bdc.id DESC
      `
    : await sql`
        SELECT bdc.*, books.title AS book_name
        FROM book_discount_codes bdc
        INNER JOIN books ON books.id = bdc.book_id
        ORDER BY books.title ASC, bdc.insert_date DESC, bdc.id DESC
      `;
  return (rows as DbRow[]).map(rowToDiscountCode);
}

export async function replaceBookDiscountCodes(bookId: number, codes: BookDiscountCodeInput[]): Promise<BookDiscountCode[]> {
  await ensureBookDiscountCodeSchema();
  const existing = await sql`SELECT id FROM book_discount_codes WHERE book_id = ${bookId}`;
  const keepIds = codes
    .map(item => item.id)
    .filter((id): id is number => Number.isInteger(id) && Number(id) > 0);

  for (const row of existing as { id: number }[]) {
    if (!keepIds.includes(row.id)) {
      await sql`DELETE FROM book_discount_codes WHERE id = ${row.id} AND book_id = ${bookId}`;
    }
  }

  for (const item of codes) {
    const code = item.code.trim();
    if (!code) continue;
    const insertDate = item.insertDate || new Date().toISOString().slice(0, 10);
    const issueDate = item.issueDate || null;
    const customerEmail = item.customerEmail.trim();

    if (item.id && Number.isInteger(item.id)) {
      await sql`
        UPDATE book_discount_codes
        SET code = ${code},
            insert_date = ${insertDate},
            issue_date = ${issueDate},
            customer_email = ${customerEmail},
            updated_at = NOW()
        WHERE id = ${item.id}
          AND book_id = ${bookId}
      `;
    } else {
      await sql`
        INSERT INTO book_discount_codes (book_id, code, insert_date, issue_date, customer_email)
        VALUES (${bookId}, ${code}, ${insertDate}, ${issueDate}, ${customerEmail})
      `;
    }
  }

  return listBookDiscountCodes(bookId);
}
