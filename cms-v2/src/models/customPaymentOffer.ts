import { sql } from '../db/client';

export interface CustomPaymentOffer {
  id: number;
  paymentOrderId: number;
  courseId: number;
  courseTitle?: string;
  createdByUserId: number | null;
  createdByName?: string | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number;
  discountReason: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  emailSentAt: Date | null;
  createdAt: Date;
  orderStatus?: string | null;
}

interface DbRow {
  id: number;
  payment_order_id: number;
  course_id: number;
  course_title?: string | null;
  created_by_user_id: number | null;
  created_by_name?: string | null;
  student_first_name: string;
  student_last_name: string;
  student_email: string;
  amount: string | number;
  currency: string;
  duration_days: number;
  discount_reason: string;
  stripe_checkout_session_id: string | null;
  checkout_url: string | null;
  email_sent_at: Date | null;
  created_at: Date;
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
    emailSentAt: row.email_sent_at,
    createdAt: row.created_at,
    orderStatus: row.order_status ?? null,
  };
}

export async function createCustomPaymentOffer(data: {
  paymentOrderId: number;
  courseId: number;
  createdByUserId: number | null;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  amount: number;
  currency: string;
  durationDays: number;
  discountReason: string;
  stripeCheckoutSessionId: string | null;
  checkoutUrl: string | null;
}): Promise<CustomPaymentOffer> {
  const rows = await sql`
    INSERT INTO custom_payment_offers (
      payment_order_id, course_id, created_by_user_id,
      student_first_name, student_last_name, student_email,
      amount, currency, duration_days, discount_reason,
      stripe_checkout_session_id, checkout_url
    )
    VALUES (
      ${data.paymentOrderId}, ${data.courseId}, ${data.createdByUserId},
      ${data.studentFirstName}, ${data.studentLastName}, ${data.studentEmail},
      ${data.amount}, ${data.currency}, ${data.durationDays}, ${data.discountReason},
      ${data.stripeCheckoutSessionId}, ${data.checkoutUrl}
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

export async function listCustomPaymentOffers(limit = 50): Promise<CustomPaymentOffer[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200);
  const rows = await sql`
    SELECT
      o.*,
      c.name AS course_title,
      po.status AS order_status,
      NULLIF(TRIM(CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, ''))), '') AS created_by_name
    FROM custom_payment_offers o
    JOIN courses c ON c.id = o.course_id
    JOIN payment_orders po ON po.id = o.payment_order_id
    LEFT JOIN users u ON u.id = o.created_by_user_id
    ORDER BY o.created_at DESC
    LIMIT ${safeLimit}
  `;
  return (rows as DbRow[]).map(rowToOffer);
}
