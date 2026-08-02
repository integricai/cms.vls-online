import crypto from 'crypto';
import { sql } from '../db/client';

export interface ExamResultToken {
  id: number;
  token: string;
  customerId: number;
  courseId: number;
  emailedAt: Date | null;
  usedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
}

interface DbRow {
  id: number;
  token: string;
  customer_id: number;
  course_id: number;
  emailed_at: Date | null;
  used_at: Date | null;
  expires_at: Date;
  created_at: Date;
}

function rowToToken(row: DbRow): ExamResultToken {
  return {
    id: row.id,
    token: row.token,
    customerId: row.customer_id,
    courseId: row.course_id,
    emailedAt: row.emailed_at,
    usedAt: row.used_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export function createExamResultTokenValue(): string {
  return crypto.randomBytes(32).toString('hex');
}

const DEFAULT_TTL_DAYS = 30;

export async function createExamResultToken(input: {
  customerId: number;
  courseId: number;
  ttlDays?: number;
}): Promise<ExamResultToken> {
  const token = createExamResultTokenValue();
  const ttlDays = input.ttlDays ?? DEFAULT_TTL_DAYS;
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + ttlDays);

  // Invalidate prior unused tokens for the same student/course.
  await sql`
    UPDATE exam_result_tokens
    SET used_at = COALESCE(used_at, NOW())
    WHERE customer_id = ${input.customerId}
      AND course_id = ${input.courseId}
      AND used_at IS NULL
  `;

  const rows = await sql`
    INSERT INTO exam_result_tokens (token, customer_id, course_id, expires_at)
    VALUES (${token}, ${input.customerId}, ${input.courseId}, ${expiresAt})
    RETURNING *
  `;
  return rowToToken(rows[0] as DbRow);
}

export async function markExamResultTokenEmailed(tokenId: number): Promise<void> {
  await sql`
    UPDATE exam_result_tokens
    SET emailed_at = NOW()
    WHERE id = ${tokenId}
  `;
}

export async function getExamResultTokenByValue(token: string): Promise<(ExamResultToken & {
  customerEmail: string;
  customerFirstName: string | null;
  customerLastName: string | null;
  courseName: string | null;
}) | null> {
  const rows = await sql`
    SELECT
      t.*,
      cu.email AS customer_email,
      cu.first_name AS customer_first_name,
      cu.last_name AS customer_last_name,
      c.name AS course_name
    FROM exam_result_tokens t
    INNER JOIN customers cu ON cu.id = t.customer_id
    INNER JOIN courses c ON c.id = t.course_id
    WHERE t.token = ${token}
    LIMIT 1
  `;
  const row = rows[0] as (DbRow & {
    customer_email: string;
    customer_first_name: string | null;
    customer_last_name: string | null;
    course_name: string | null;
  }) | undefined;
  if (!row) return null;

  return {
    ...rowToToken(row),
    customerEmail: row.customer_email,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    courseName: row.course_name,
  };
}

export async function markExamResultTokenUsed(tokenId: number): Promise<void> {
  await sql`
    UPDATE exam_result_tokens
    SET used_at = NOW()
    WHERE id = ${tokenId}
  `;
}
