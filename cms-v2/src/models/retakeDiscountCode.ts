import crypto from 'crypto';
import { sql } from '../db/client';
import type { RetakeDiscountType } from '../services/retakeDiscountMath';

let schemaReady: Promise<void> | null = null;

export type RetakeDiscountCode = {
  id: number;
  code: string;
  courseId: number;
  courseName: string | null;
  studentEmail: string;
  firstName: string;
  lastName: string;
  ccEmail: string | null;
  discountType: RetakeDiscountType;
  discountValue: number;
  used: boolean;
  usedAt: string | null;
  paymentOrderId: number | null;
  reservedAt: string | null;
  emailSentAt: string | null;
  expiresAt: string | null;
  fullAmount: number | null;
  finalAmount: number | null;
  currency: string | null;
  /** Dollar prices locked when the offer was sent. Null on links sent before this was stored. */
  usdFullAmount: number | null;
  usdFinalAmount: number | null;
  createdAt: string;
};

interface DbRow {
  id: number;
  code: string;
  course_id: number;
  course_name?: string | null;
  student_email: string;
  first_name: string;
  last_name: string;
  cc_email?: string | null;
  discount_type: string;
  discount_value: string | number;
  used: boolean;
  used_at: Date | null;
  payment_order_id: number | null;
  reserved_at: Date | null;
  email_sent_at: Date | null;
  expires_at?: Date | null;
  full_amount?: string | number | null;
  final_amount?: string | number | null;
  currency?: string | null;
  usd_full_amount?: string | number | null;
  usd_final_amount?: string | number | null;
  created_at: Date;
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function rowToCode(row: DbRow): RetakeDiscountCode {
  const discountType: RetakeDiscountType = row.discount_type === 'fixed' ? 'fixed' : 'percent';
  return {
    id: row.id,
    code: row.code,
    courseId: row.course_id,
    courseName: row.course_name ?? null,
    studentEmail: row.student_email,
    firstName: row.first_name,
    lastName: row.last_name,
    ccEmail: row.cc_email ?? null,
    discountType,
    discountValue: Number(row.discount_value),
    used: row.used === true,
    usedAt: iso(row.used_at),
    paymentOrderId: row.payment_order_id,
    reservedAt: iso(row.reserved_at),
    emailSentAt: iso(row.email_sent_at),
    expiresAt: iso(row.expires_at),
    fullAmount: row.full_amount != null ? Number(row.full_amount) : null,
    finalAmount: row.final_amount != null ? Number(row.final_amount) : null,
    currency: row.currency ?? null,
    usdFullAmount: row.usd_full_amount != null ? Number(row.usd_full_amount) : null,
    usdFinalAmount: row.usd_final_amount != null ? Number(row.usd_final_amount) : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function ensureRetakeDiscountSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS retake_discount_codes (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        course_id INTEGER NOT NULL REFERENCES courses(id),
        student_email TEXT NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        discount_type TEXT NOT NULL,
        discount_value NUMERIC(10, 2) NOT NULL,
        used BOOLEAN NOT NULL DEFAULT FALSE,
        used_at TIMESTAMPTZ,
        payment_order_id INTEGER REFERENCES payment_orders(id) ON DELETE SET NULL,
        reserved_at TIMESTAMPTZ,
        email_sent_at TIMESTAMPTZ,
        created_by INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT retake_discount_codes_type_check CHECK (discount_type IN ('percent', 'fixed')),
        CONSTRAINT retake_discount_codes_value_check CHECK (discount_value > 0)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS retake_discount_codes_email_idx ON retake_discount_codes (student_email)`;
    await sql`CREATE INDEX IF NOT EXISTS retake_discount_codes_course_idx ON retake_discount_codes (course_id)`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS cc_email TEXT`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS token_hash TEXT`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS full_amount NUMERIC(10, 2)`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS final_amount NUMERIC(10, 2)`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS currency TEXT`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS usd_full_amount NUMERIC(10, 2)`;
    await sql`ALTER TABLE retake_discount_codes ADD COLUMN IF NOT EXISTS usd_final_amount NUMERIC(10, 2)`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS retake_discount_codes_token_hash_idx
      ON retake_discount_codes (token_hash)
      WHERE token_hash IS NOT NULL
    `;
  })();
  await schemaReady;
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRetakeCodeValue(): string {
  const bytes = crypto.randomBytes(8);
  let body = '';
  for (let i = 0; i < 8; i += 1) {
    body += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return `RT-${body}`;
}

export async function insertRetakeDiscountCode(input: {
  code: string;
  courseId: number;
  studentEmail: string;
  firstName: string;
  lastName: string;
  discountType: RetakeDiscountType;
  discountValue: number;
  ccEmail: string | null;
  createdBy: number | null;
  tokenHash: string;
  expiresAt: Date;
  fullAmount: number;
  finalAmount: number;
  currency: string;
  usdFullAmount: number;
  usdFinalAmount: number;
}): Promise<RetakeDiscountCode> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    INSERT INTO retake_discount_codes (
      code, course_id, student_email, first_name, last_name,
      discount_type, discount_value, cc_email, created_by,
      token_hash, expires_at, full_amount, final_amount, currency,
      usd_full_amount, usd_final_amount
    )
    VALUES (
      ${input.code},
      ${input.courseId},
      ${input.studentEmail},
      ${input.firstName},
      ${input.lastName},
      ${input.discountType},
      ${input.discountValue},
      ${input.ccEmail},
      ${input.createdBy},
      ${input.tokenHash},
      ${input.expiresAt},
      ${input.fullAmount},
      ${input.finalAmount},
      ${input.currency},
      ${input.usdFullAmount},
      ${input.usdFinalAmount}
    )
    RETURNING *
  `;
  return rowToCode(rows[0] as DbRow);
}

export async function listRetakeDiscountCodes(limit = 100): Promise<RetakeDiscountCode[]> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    SELECT r.*, c.name AS course_name
    FROM retake_discount_codes r
    JOIN courses c ON c.id = r.course_id
    ORDER BY r.created_at DESC
    LIMIT ${limit}
  `;
  return (rows as DbRow[]).map(rowToCode);
}

export async function getRetakeDiscountCodeById(id: number): Promise<RetakeDiscountCode | null> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    SELECT r.*, c.name AS course_name
    FROM retake_discount_codes r
    JOIN courses c ON c.id = r.course_id
    WHERE r.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToCode(rows[0] as DbRow) : null;
}

export async function getRetakeDiscountCodeByTokenHash(tokenHash: string): Promise<RetakeDiscountCode | null> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    SELECT r.*, c.name AS course_name
    FROM retake_discount_codes r
    JOIN courses c ON c.id = r.course_id
    WHERE r.token_hash = ${tokenHash}
    LIMIT 1
  `;
  return rows[0] ? rowToCode(rows[0] as DbRow) : null;
}

/** Replace the payment link. The previous link stops working. A used offer is left unchanged. */
export async function replaceDiscountPaymentLink(id: number, input: {
  tokenHash: string;
  expiresAt: Date;
  fullAmount: number;
  finalAmount: number;
  currency: string;
}): Promise<boolean> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    UPDATE retake_discount_codes
    SET token_hash = ${input.tokenHash},
        expires_at = ${input.expiresAt},
        full_amount = ${input.fullAmount},
        final_amount = ${input.finalAmount},
        currency = ${input.currency}
    WHERE id = ${id}
      AND used = FALSE
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getRetakeDiscountCodeByCode(code: string): Promise<RetakeDiscountCode | null> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    SELECT r.*, c.name AS course_name
    FROM retake_discount_codes r
    JOIN courses c ON c.id = r.course_id
    WHERE r.code = ${code}
    LIMIT 1
  `;
  return rows[0] ? rowToCode(rows[0] as DbRow) : null;
}

export async function markRetakeCodeEmailSent(id: number): Promise<void> {
  await ensureRetakeDiscountSchema();
  await sql`
    UPDATE retake_discount_codes
    SET email_sent_at = NOW()
    WHERE id = ${id}
  `;
}

/**
 * Hold the code on this order until Stripe confirms payment.
 * A pending order that has not been paid is cancelled by the caller first,
 * so a later checkout from the same student can take the code.
 */
export async function reserveRetakeCode(codeId: number, orderId: number): Promise<boolean> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    UPDATE retake_discount_codes
    SET payment_order_id = ${orderId},
        reserved_at = NOW()
    WHERE id = ${codeId}
      AND used = FALSE
      AND (
        payment_order_id IS NULL
        OR payment_order_id = ${orderId}
        OR NOT EXISTS (
          SELECT 1 FROM payment_orders po
          WHERE po.id = retake_discount_codes.payment_order_id
            AND po.status = 'Pending'
        )
      )
    RETURNING id
  `;
  return rows.length > 0;
}

export async function releaseRetakeCodeForOrder(orderId: number): Promise<void> {
  await ensureRetakeDiscountSchema();
  await sql`
    UPDATE retake_discount_codes
    SET payment_order_id = NULL,
        reserved_at = NULL
    WHERE payment_order_id = ${orderId}
      AND used = FALSE
  `;
}

/** First successful payment consumes the code. A second attempt changes nothing. */
export async function consumeRetakeCodeForOrder(orderId: number): Promise<boolean> {
  await ensureRetakeDiscountSchema();
  const rows = await sql`
    UPDATE retake_discount_codes
    SET used = TRUE,
        used_at = NOW(),
        payment_order_id = ${orderId}
    WHERE payment_order_id = ${orderId}
      AND used = FALSE
    RETURNING id
  `;
  return rows.length > 0;
}
