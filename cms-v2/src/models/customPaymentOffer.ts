import { sql } from '../db/client';

let linkColumnReady = false;

async function ensurePayLinkColumn(): Promise<void> {
  if (linkColumnReady) return;
  await sql`ALTER TABLE custom_payment_offers ADD COLUMN IF NOT EXISTS token_hash TEXT`;
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS custom_payment_offers_token_hash_idx
    ON custom_payment_offers (token_hash)
    WHERE token_hash IS NOT NULL
  `;
  linkColumnReady = true;
}

export interface CustomPaymentOffer {
  id: number;
  paymentOrderId: number;
  courseId: number | null;
  courseTitle?: string;
  createdByUserId: number | null;
  createdByName?: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  discountReason: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  tokenHash?: string | null;
  hasDurablePayLink?: boolean;
  emailSentAt: Date | null;
  createdAt: Date;
  /** When the current Stripe Checkout session was created. */
  orderCreatedAt?: Date | null;
  orderStatus?: string | null;
}

interface DbRow {
  id: number;
  payment_order_id: number;
  course_id: number | null;
  course_title?: string | null;
  created_by_user_id: number | null;
  created_by_name?: string | null;
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  amount: string | number;
  currency: string;
  duration_days: number | null;
  discount_reason: string;
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  token_hash?: string | null;
  email_sent_at: Date | null;
  created_at: Date;
  order_created_at?: Date | null;
  order_status?: string | null;
}

function rowToOffer(row: DbRow): CustomPaymentOffer {
  return {
    id: row.id,
    paymentOrderId: row.payment_order_id,
    courseId: row.course_id,
    courseTitle: row.course_title ?? undefined,
    createdByUserId: row.created_by_user_id,
    createdByName: row.created_by_name ?? null,
    studentFirstName: row.student_first_name,
    studentLastName: row.student_last_name,
    studentEmail: row.student_email,
    amount: Number(row.amount),
    currency: row.currency,
    durationDays: row.duration_days,
    discountReason: row.discount_reason,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    checkoutUrl: row.checkout_url,
    tokenHash: row.token_hash ?? null,
    hasDurablePayLink: Boolean(row.token_hash),
    emailSentAt: row.email_sent_at,
    createdAt: row.created_at,
    orderCreatedAt: row.order_created_at ?? null,
    orderStatus: row.order_status ?? null,
  };
}

export async function createCustomPaymentOffer(data: {
  paymentOrderId: number;
  courseId: number | null;
  createdByUserId: number | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number | null;
  discountReason: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  tokenHash?: string | null;
}): Promise<CustomPaymentOffer> {
  await ensurePayLinkColumn();
  const rows = await sql`
    INSERT INTO custom_payment_offers (
      payment_order_id, course_id, created_by_user_id,
      student_first_name, student_last_name, student_email,
      amount, currency, duration_days, discount_reason,
      stripe_checkout_session_id, checkout_url, token_hash
    )
    VALUES (
      ${data.paymentOrderId}, ${data.courseId}, ${data.createdByUserId},
      ${data.studentFirstName}, ${data.studentLastName}, ${data.studentEmail},
      ${data.amount}, ${data.currency}, ${data.durationDays}, ${data.discountReason},
      ${data.stripeCheckoutSessionId}, ${data.checkoutUrl}, ${data.tokenHash ?? null}
    )
    RETURNING *
  `;
  return rowToOffer(rows[0] as DbRow);
}

export async function markCustomPaymentOfferEmailSent(id: number): Promise<void> {
  await sql`
    UPDATE custom_payment_offers
    SET email_sent_at = NOW()
    WHERE id = ${id}
  `;
}

export async function getCustomPaymentOfferById(id: number): Promise<CustomPaymentOffer | null> {
  await ensurePayLinkColumn();
  const rows = await sql`
    SELECT
      o.*,
      COALESCE(c.name, po.course_title) AS course_title,
      po.status AS order_status,
      po.created_at AS order_created_at,
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS created_by_name
    FROM custom_payment_offers o
    LEFT JOIN courses c ON c.id = o.course_id
    JOIN payment_orders po ON po.id = o.payment_order_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    WHERE o.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToOffer(rows[0] as DbRow) : null;
}

export async function getCustomPaymentOfferByTokenHash(tokenHash: string): Promise<CustomPaymentOffer | null> {
  await ensurePayLinkColumn();
  const rows = await sql`
    SELECT
      o.*,
      COALESCE(c.name, po.course_title) AS course_title,
      po.status AS order_status,
      po.created_at AS order_created_at,
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS created_by_name
    FROM custom_payment_offers o
    LEFT JOIN courses c ON c.id = o.course_id
    JOIN payment_orders po ON po.id = o.payment_order_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    WHERE o.token_hash = ${tokenHash}
    LIMIT 1
  `;
  return rows[0] ? rowToOffer(rows[0] as DbRow) : null;
}

/** Point the offer at a new Stripe session. The emailed /pay link stays the same. */
export async function attachCustomPaymentCheckout(id: number, input: {
  previousPaymentOrderId: number;
  paymentOrderId: number;
  stripeCheckoutSessionId: string;
}): Promise<boolean> {
  await ensurePayLinkColumn();
  const rows = await sql`
    UPDATE custom_payment_offers
    SET payment_order_id = ${input.paymentOrderId},
        stripe_checkout_session_id = ${input.stripeCheckoutSessionId}
    WHERE id = ${id}
      AND payment_order_id = ${input.previousPaymentOrderId}
    RETURNING id
  `;
  return rows.length > 0;
}

/** Replace the emailed link. The previous link stops working. */
export async function replaceCustomPaymentPayLink(id: number, input: {
  previousTokenHash: string | null;
  tokenHash: string;
  checkoutUrl: string;
}): Promise<boolean> {
  await ensurePayLinkColumn();
  const rows = await sql`
    UPDATE custom_payment_offers
    SET token_hash = ${input.tokenHash},
        checkout_url = ${input.checkoutUrl},
        email_sent_at = NULL
    WHERE id = ${id}
      AND token_hash IS NOT DISTINCT FROM ${input.previousTokenHash}
    RETURNING id
  `;
  return rows.length > 0;
}

export async function listCustomPaymentOffers(limit = 50): Promise<CustomPaymentOffer[]> {
  await ensurePayLinkColumn();
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const rows = await sql`
    SELECT
      o.*,
      COALESCE(c.name, po.course_title) AS course_title,
      po.status AS order_status,
      po.created_at AS order_created_at,
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS created_by_name
    FROM custom_payment_offers o
    LEFT JOIN courses c ON c.id = o.course_id
    JOIN payment_orders po ON po.id = o.payment_order_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    ORDER BY o.created_at DESC
    LIMIT ${safeLimit}
  `;
  return (rows as DbRow[]).map(rowToOffer);
}
