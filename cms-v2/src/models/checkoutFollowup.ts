import { sql } from '../db/client';
import type { CheckoutFollowupStep } from '../services/paymentEmails';

/** Checkouts before this never had their email saved, so nothing older is followed up. */
export const CHECKOUT_FOLLOWUPS_START = '2026-11-19T00:00:00Z';

export interface DueCheckoutFollowup {
  id: number;
  step: CheckoutFollowupStep;
  email: string;
  courseId: number;
  courseTitle: string;
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
        SELECT lower(trim(COALESCE(po.provider_customer_email, po.stripe_customer_email))) AS email,
               po.course_id,
               po.id AS order_id
        FROM payment_orders po
        WHERE po.status IN ('Cancelled', 'Failed')
          AND po.course_id IS NOT NULL
          AND po.checkout_environment = 'production'
          AND po.created_at >= ${CHECKOUT_FOLLOWUPS_START}::timestamptz
          AND COALESCE(po.provider_customer_email, po.stripe_customer_email) LIKE '%@%'
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
  return (rows as Array<{ inserted: boolean }>).filter(row => row.inserted).length;
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
    RETURNING f.id, picked.step, f.email, f.course_id, c.name AS course_title,
              c.course_page_url, f.unsubscribe_token
  `;
  return (rows as Array<Record<string, unknown>>).map(row => ({
    id: Number(row.id),
    step: Number(row.step) as CheckoutFollowupStep,
    email: String(row.email),
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
