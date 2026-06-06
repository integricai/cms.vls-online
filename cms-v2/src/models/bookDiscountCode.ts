import { sql } from '../db/client';
import type { BookDiscountCode, BookDiscountCodeBulkInput, BookDiscountCodeInput } from '../../shared/types';
import { updateBookQuantities } from './book';

let schemaReady: Promise<void> | null = null;

interface DbRow {
  id: number;
  book_id: number;
  book_name?: string;
  code: string;
  insert_date: string | Date;
  issue_date: string | Date | null;
  customer_email: string;
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  issued_at: Date | null;
  email_sent_at: Date | null;
  used: boolean;
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
        stripe_session_id TEXT,
        stripe_payment_intent_id TEXT,
        issued_at TIMESTAMPTZ,
        email_sent_at TIMESTAMPTZ,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS stripe_session_id TEXT`;
    await sql`ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT`;
    await sql`ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS issued_at TIMESTAMPTZ`;
    await sql`ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ`;
    await sql`ALTER TABLE book_discount_codes ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE`;
    await sql`
      UPDATE book_discount_codes
      SET used = TRUE
      WHERE used = FALSE
        AND (issue_date IS NOT NULL OR customer_email <> '')
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_book_id ON book_discount_codes(book_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_issue_date ON book_discount_codes(issue_date)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_used_book_id ON book_discount_codes(book_id, used, insert_date ASC, id ASC)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_book_discount_codes_stripe_session_id ON book_discount_codes(stripe_session_id)`;
  })();
  return schemaReady;
}

function dateOnly(value: string | Date | null): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function nullableText(value: unknown): string | null {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function nullableDateTime(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
    stripeSessionId: row.stripe_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    issuedAt: row.issued_at,
    emailSentAt: row.email_sent_at,
    used: row.used === true,
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
  const existing = await sql`SELECT * FROM book_discount_codes WHERE book_id = ${bookId}`;
  const existingById = new Map((existing as DbRow[]).map(row => [row.id, row]));
  const keepIds = codes
    .map(item => item.id)
    .filter((id): id is number => Number.isInteger(id) && Number(id) > 0);

  for (const row of existing as DbRow[]) {
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
    const existingRow = item.id ? existingById.get(item.id) : null;
    const stripeSessionId = item.stripeSessionId !== undefined
      ? nullableText(item.stripeSessionId)
      : existingRow?.stripe_session_id ?? null;
    const stripePaymentIntentId = item.stripePaymentIntentId !== undefined
      ? nullableText(item.stripePaymentIntentId)
      : existingRow?.stripe_payment_intent_id ?? null;
    const requestedIssuedAt = item.issuedAt !== undefined ? nullableDateTime(item.issuedAt) : existingRow?.issued_at ?? null;
    const emailSentAt = item.emailSentAt !== undefined ? nullableDateTime(item.emailSentAt) : existingRow?.email_sent_at ?? null;
    const used = item.used ?? Boolean(issueDate || customerEmail || stripeSessionId || stripePaymentIntentId || requestedIssuedAt);
    const issuedAt = used ? (requestedIssuedAt ?? existingRow?.issued_at ?? new Date()) : null;

    if (item.id && Number.isInteger(item.id)) {
      await sql`
        UPDATE book_discount_codes
        SET code = ${code},
            insert_date = ${insertDate},
            issue_date = ${issueDate},
            customer_email = ${customerEmail},
            stripe_session_id = ${stripeSessionId},
            stripe_payment_intent_id = ${stripePaymentIntentId},
            used = ${used},
            issued_at = ${issuedAt},
            email_sent_at = ${emailSentAt},
            updated_at = NOW()
        WHERE id = ${item.id}
          AND book_id = ${bookId}
      `;
    } else {
      await sql`
        INSERT INTO book_discount_codes
          (book_id, code, insert_date, issue_date, customer_email, stripe_session_id, stripe_payment_intent_id, used, issued_at, email_sent_at)
        VALUES
          (${bookId}, ${code}, ${insertDate}, ${issueDate}, ${customerEmail}, ${stripeSessionId}, ${stripePaymentIntentId}, ${used}, ${issuedAt}, ${emailSentAt})
      `;
    }
  }

  await updateBookQuantities([bookId]);
  return listBookDiscountCodes(bookId);
}

export async function replaceBulkBookDiscountCodes(items: BookDiscountCodeBulkInput[]): Promise<BookDiscountCode[]> {
  await ensureBookDiscountCodeSchema();
  const updatedBookIds: number[] = [];
  for (const item of items) {
    if (!Number.isInteger(item.bookId) || item.bookId <= 0) continue;
    await replaceBookDiscountCodes(item.bookId, Array.isArray(item.codes) ? item.codes : []);
    updatedBookIds.push(item.bookId);
  }
  await updateBookQuantities(updatedBookIds);
  return listBookDiscountCodes();
}
