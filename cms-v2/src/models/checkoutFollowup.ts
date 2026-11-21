import { sql } from '../db/client';
import type { CheckoutFollowupStep } from '../services/paymentEmails';

/** Checkouts before this never had their email saved, so nothing older is followed up. */
export const CHECKOUT_FOLLOWUPS_START = '2026-11-19T00:00:00Z';

export interface DueCheckoutFollowup {
  id: number;
  step: CheckoutFollowupStep;
  email: string;
  firstName: string | null;
  courseId: number;
  courseTitle: string;
  coursePageUrl: string | null;
  unsubscribeToken: string;
}

export interface FailedPaymentRecord {
  id: number;
  abandonedAt: Date;
  courseTitle: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  followup1SentAt: Date | null;
  followup2SentAt: Date | null;
  followup3SentAt: Date | null;
  purchased: boolean;
  canResend: boolean;
  coursePageUrl: string | null;
  unsubscribeToken: string;
}

/**
 * Adds a row for every closed, unpaid website checkout that captured an email.
 * One row per email and course: a later abandoned checkout for the same course
 * only moves last_order_id, it never restarts a sequence.
 */
export async function recordAbandonedCheckouts(): Promise<number> {
  const rows = await sql`
    WITH closed AS (
      SELECT DISTINCT ON (email, course_id) email, course_id, order_id
      FROM (
        SELECT lower(trim(COALESCE(po.provider_customer_email, po.stripe_customer_email, po.student_email))) AS email,
               po.course_id,
               po.id AS order_id
        FROM payment_orders po
        WHERE po.status IN ('Cancelled', 'Failed')
          AND po.course_id IS NOT NULL
          AND po.checkout_environment = 'production'
          AND po.created_at >= ${CHECKOUT_FOLLOWUPS_START}::timestamptz
          -- student_email comes from the website's email popup, before Stripe.
          AND COALESCE(po.provider_customer_email, po.stripe_customer_email, po.student_email) LIKE '%@%'
      ) candidates
      ORDER BY email, course_id, order_id DESC
    )
    INSERT INTO checkout_followups (email, course_id, last_order_id, abandoned_at)
    SELECT c.email, c.course_id, c.order_id, NOW()
    FROM closed c
    WHERE NOT EXISTS (
      SELECT 1 FROM payment_orders paid
      WHERE paid.status = 'Paid'
        AND paid.course_id = c.course_id
        AND c.email IN (
          lower(trim(paid.student_email)),
          lower(trim(paid.provider_customer_email)),
          lower(trim(paid.stripe_customer_email))
        )
    )
    ON CONFLICT (email, course_id) DO UPDATE
      SET last_order_id = EXCLUDED.last_order_id,
          updated_at = NOW()
      WHERE checkout_followups.stopped_at IS NULL
        AND COALESCE(checkout_followups.last_order_id, 0) < EXCLUDED.last_order_id
    RETURNING (xmax = 0) AS inserted
  `;
  await fillCheckoutFollowupNames();
  return (rows as Array<{ inserted: boolean }>).filter(row => row.inserted).length;
}

/**
 * Copies a missing first or last name from the customer, then from the name
 * stored on the order. A one-word order name fills both, matching splitStudentName.
 */
async function fillCheckoutFollowupNames(): Promise<void> {
  await sql`
    UPDATE checkout_followups f
    SET first_name = COALESCE(f.first_name, src.first_name),
        last_name = COALESCE(f.last_name, src.last_name),
        updated_at = NOW()
    FROM (
      SELECT f2.id,
        CASE
          WHEN NULLIF(btrim(cu.first_name), '') IS NOT NULL THEN NULLIF(btrim(cu.first_name), '')
          WHEN NULLIF(btrim(po.student_name), '') IS NULL THEN NULL
          ELSE split_part(btrim(po.student_name), ' ', 1)
        END AS first_name,
        CASE
          WHEN NULLIF(btrim(cu.first_name), '') IS NOT NULL THEN NULLIF(btrim(cu.last_name), '')
          WHEN NULLIF(btrim(po.student_name), '') IS NULL THEN NULL
          WHEN position(' ' IN btrim(po.student_name)) = 0 THEN btrim(po.student_name)
          ELSE btrim(substr(btrim(po.student_name), position(' ' IN btrim(po.student_name)) + 1))
        END AS last_name
      FROM checkout_followups f2
      JOIN payment_orders po ON po.id = f2.last_order_id
      LEFT JOIN LATERAL (
        SELECT c2.first_name, c2.last_name
        FROM customers c2
        WHERE c2.id = po.customer_id
           OR (
             po.customer_id IS NULL
             AND lower(c2.email) = lower(trim(COALESCE(
               po.provider_customer_email, po.stripe_customer_email, po.student_email
             )))
           )
        ORDER BY CASE WHEN c2.id = po.customer_id THEN 0 ELSE 1 END
        LIMIT 1
      ) cu ON true
      WHERE f2.first_name IS NULL OR f2.last_name IS NULL
    ) src
    WHERE f.id = src.id
      AND (src.first_name IS NOT NULL OR src.last_name IS NOT NULL)
  `;
}

/**
 * Stops every active sequence whose email has paid: for the same course at any
 * time, or for any course since the sequence started.
 */
export async function stopPurchasedFollowups(): Promise<number> {
  const rows = await sql`
    WITH matched AS (
      SELECT f.id,
        (
          SELECT po.id
          FROM payment_orders po
          WHERE po.status = 'Paid'
            AND f.email IN (
              lower(trim(po.student_email)),
              lower(trim(po.provider_customer_email)),
              lower(trim(po.stripe_customer_email))
            )
            AND (po.course_id = f.course_id OR po.paid_at >= f.created_at - INTERVAL '3 hours')
          ORDER BY po.paid_at DESC NULLS LAST
          LIMIT 1
        ) AS paid_order_id
      FROM checkout_followups f
      WHERE f.stopped_at IS NULL
    )
    UPDATE checkout_followups f
    SET stopped_at = NOW(),
        stop_reason = 'purchased',
        purchased_order_id = matched.paid_order_id,
        updated_at = NOW()
    FROM matched
    WHERE f.id = matched.id
      AND matched.paid_order_id IS NOT NULL
      AND f.stopped_at IS NULL
    RETURNING f.id
  `;
  return rows.length;
}

/**
 * Marks up to `limit` emails as sent and returns them. The timestamp is set
 * before sending so two overlapping runs can never send the same email; a
 * failed send is put back with releaseFollowupClaim.
 *
 * Email 1: 1 h after the checkout closed (until 24 h).
 * Email 2: 24 h after (until 72 h), at least 12 h after email 1.
 * Email 3: 72 h after (until 7 days), at least 24 h after email 2.
 * A missed window is skipped, not sent late. An address never gets two
 * follow-ups within 12 h, even for different courses.
 */
export async function claimDueFollowups(limit: number): Promise<DueCheckoutFollowup[]> {
  const rows = await sql`
    WITH due AS (
      SELECT f.id, f.email, f.abandoned_at,
        CASE
          WHEN f.followup_1_sent_at IS NULL
            AND f.abandoned_at <= NOW() - INTERVAL '1 hour'
            AND f.abandoned_at > NOW() - INTERVAL '24 hours' THEN 1
          WHEN f.followup_2_sent_at IS NULL
            AND f.abandoned_at <= NOW() - INTERVAL '24 hours'
            AND f.abandoned_at > NOW() - INTERVAL '72 hours'
            AND (f.followup_1_sent_at IS NULL OR f.followup_1_sent_at <= NOW() - INTERVAL '12 hours') THEN 2
          WHEN f.followup_3_sent_at IS NULL
            AND f.abandoned_at <= NOW() - INTERVAL '72 hours'
            AND f.abandoned_at > NOW() - INTERVAL '7 days'
            AND (f.followup_2_sent_at IS NULL OR f.followup_2_sent_at <= NOW() - INTERVAL '24 hours') THEN 3
        END AS step
      FROM checkout_followups f
      WHERE f.stopped_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM checkout_followups other
          WHERE other.email = f.email
            AND GREATEST(other.followup_1_sent_at, other.followup_2_sent_at, other.followup_3_sent_at)
                > NOW() - INTERVAL '12 hours'
        )
    ),
    picked AS (
      SELECT DISTINCT ON (email) id, step
      FROM due
      WHERE step IS NOT NULL
      ORDER BY email, abandoned_at DESC
      LIMIT ${limit}
    )
    UPDATE checkout_followups f
    SET followup_1_sent_at = CASE WHEN picked.step = 1 THEN NOW() ELSE f.followup_1_sent_at END,
        followup_2_sent_at = CASE WHEN picked.step = 2 THEN NOW() ELSE f.followup_2_sent_at END,
        followup_3_sent_at = CASE WHEN picked.step = 3 THEN NOW() ELSE f.followup_3_sent_at END,
        updated_at = NOW()
    FROM picked, courses c
    WHERE f.id = picked.id
      AND c.id = f.course_id
      AND f.stopped_at IS NULL
    RETURNING f.id, picked.step, f.email, f.first_name, f.course_id, c.name AS course_title,
              c.course_page_url, f.unsubscribe_token
  `;
  return (rows as Array<Record<string, unknown>>).map(row => ({
    id: Number(row.id),
    step: Number(row.step) as CheckoutFollowupStep,
    email: String(row.email),
    firstName: nullableText(row.first_name),
    courseId: Number(row.course_id),
    courseTitle: String(row.course_title ?? ''),
    coursePageUrl: row.course_page_url ? String(row.course_page_url) : null,
    unsubscribeToken: String(row.unsubscribe_token),
  }));
}

export async function releaseFollowupClaim(id: number, step: CheckoutFollowupStep): Promise<void> {
  await sql`
    UPDATE checkout_followups
    SET followup_1_sent_at = CASE WHEN ${step}::int = 1 THEN NULL ELSE followup_1_sent_at END,
        followup_2_sent_at = CASE WHEN ${step}::int = 2 THEN NULL ELSE followup_2_sent_at END,
        followup_3_sent_at = CASE WHEN ${step}::int = 3 THEN NULL ELSE followup_3_sent_at END,
        updated_at = NOW()
    WHERE id = ${id}
  `;
}

function nullableText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text || null;
}

function asDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function rowToFailedPayment(row: Record<string, unknown>): FailedPaymentRecord {
  const abandonedAt = asDate(row.abandoned_at) ?? new Date(0);
  return {
    id: Number(row.id),
    abandonedAt,
    courseTitle: String(row.course_title ?? ''),
    email: String(row.email ?? ''),
    firstName: nullableText(row.first_name),
    lastName: nullableText(row.last_name),
    followup1SentAt: asDate(row.followup_1_sent_at),
    followup2SentAt: asDate(row.followup_2_sent_at),
    followup3SentAt: asDate(row.followup_3_sent_at),
    purchased: row.stop_reason === 'purchased',
    canResend: row.stopped_at == null,
    coursePageUrl: row.course_page_url ? String(row.course_page_url) : null,
    unsubscribeToken: String(row.unsubscribe_token ?? ''),
  };
}

export async function listFailedPayments(start: string, end: string): Promise<FailedPaymentRecord[]> {
  const rows = await sql`
    SELECT f.id, f.abandoned_at, c.name AS course_title, f.email, f.first_name, f.last_name,
           f.followup_1_sent_at, f.followup_2_sent_at, f.followup_3_sent_at,
           f.stop_reason, f.stopped_at, c.course_page_url, f.unsubscribe_token
    FROM checkout_followups f
    JOIN courses c ON c.id = f.course_id
    WHERE (f.abandoned_at AT TIME ZONE 'Europe/London')::date >= CAST(${start} AS date)
      AND (f.abandoned_at AT TIME ZONE 'Europe/London')::date <= CAST(${end} AS date)
    ORDER BY f.abandoned_at DESC
    LIMIT 1000
  `;
  return (rows as Array<Record<string, unknown>>).map(rowToFailedPayment);
}

export async function getFailedPayment(id: number): Promise<FailedPaymentRecord | null> {
  const rows = await sql`
    SELECT f.id, f.abandoned_at, c.name AS course_title, f.email, f.first_name, f.last_name,
           f.followup_1_sent_at, f.followup_2_sent_at, f.followup_3_sent_at,
           f.stop_reason, f.stopped_at, c.course_page_url, f.unsubscribe_token
    FROM checkout_followups f
    JOIN courses c ON c.id = f.course_id
    WHERE f.id = ${id}
    LIMIT 1
  `;
  const row = (rows as Array<Record<string, unknown>>)[0];
  return row ? rowToFailedPayment(row) : null;
}

/** Sets the step's sent time only when it is still empty and the sequence is active. */
export async function claimFollowupStep(id: number, step: CheckoutFollowupStep): Promise<boolean> {
  const rows = await sql`
    UPDATE checkout_followups
    SET followup_1_sent_at = CASE WHEN ${step}::int = 1 THEN NOW() ELSE followup_1_sent_at END,
        followup_2_sent_at = CASE WHEN ${step}::int = 2 THEN NOW() ELSE followup_2_sent_at END,
        followup_3_sent_at = CASE WHEN ${step}::int = 3 THEN NOW() ELSE followup_3_sent_at END,
        updated_at = NOW()
    WHERE id = ${id}
      AND stopped_at IS NULL
      AND (
        (${step}::int = 1 AND followup_1_sent_at IS NULL)
        OR (${step}::int = 2 AND followup_2_sent_at IS NULL)
        OR (${step}::int = 3 AND followup_3_sent_at IS NULL)
      )
    RETURNING id
  `;
  return rows.length > 0;
}

/** Moves an already-sent step's timestamp to now, after a manual resend succeeds. */
export async function touchFollowupStep(id: number, step: CheckoutFollowupStep): Promise<void> {
  await sql`
    UPDATE checkout_followups
    SET followup_1_sent_at = CASE WHEN ${step}::int = 1 THEN NOW() ELSE followup_1_sent_at END,
        followup_2_sent_at = CASE WHEN ${step}::int = 2 THEN NOW() ELSE followup_2_sent_at END,
        followup_3_sent_at = CASE WHEN ${step}::int = 3 THEN NOW() ELSE followup_3_sent_at END,
        updated_at = NOW()
    WHERE id = ${id}
      AND stopped_at IS NULL
  `;
}

/** Stops every sequence for the token's email address. Returns false for an unknown token. */
export async function unsubscribeCheckoutFollowups(token: string): Promise<boolean> {
  const rows = await sql`
    WITH owner AS (
      SELECT email FROM checkout_followups WHERE unsubscribe_token = ${token} LIMIT 1
    )
    UPDATE checkout_followups f
    SET stopped_at = COALESCE(f.stopped_at, NOW()),
        stop_reason = COALESCE(f.stop_reason, 'unsubscribed'),
        updated_at = NOW()
    FROM owner
    WHERE f.email = owner.email
    RETURNING f.id
  `;
  return rows.length > 0;
}
