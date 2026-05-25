import { sql } from '../db/client';

export type PaymentOrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled';

export interface PaymentOrder {
  id: number;
  paymentOptionId: number;
  zenlerCourseId: string;
  courseTitle: string;
  optionType: string | null;
  studentName: string | null;
  studentEmail: string | null;
  amount: number;
  currency: string;
  status: PaymentOrderStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerEmail: string | null;
  confirmationEmailSentAt: Date | null;
  adminEmailSentAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
}

interface DbRow {
  id: number;
  payment_option_id: number;
  zenler_course_id: string;
  course_title: string;
  option_type: string | null;
  student_name: string | null;
  student_email: string | null;
  amount: string;
  currency: string;
  status: PaymentOrderStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_customer_email: string | null;
  confirmation_email_sent_at: Date | null;
  admin_email_sent_at: Date | null;
  created_at: Date;
  paid_at: Date | null;
}

function rowToOrder(row: DbRow): PaymentOrder {
  return {
    id: row.id,
    paymentOptionId: row.payment_option_id,
    zenlerCourseId: row.zenler_course_id,
    courseTitle: row.course_title,
    optionType: row.option_type,
    studentName: row.student_name,
    studentEmail: row.student_email,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeCustomerEmail: row.stripe_customer_email,
    confirmationEmailSentAt: row.confirmation_email_sent_at,
    adminEmailSentAt: row.admin_email_sent_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

export async function createPaymentOrder(data: {
  paymentOptionId: number;
  zenlerCourseId: string;
  courseTitle: string;
  optionType: string | null;
  studentName: string | null;
  studentEmail: string | null;
  amount: number;
  currency: string;
}): Promise<PaymentOrder> {
  const rows = await sql`
    INSERT INTO payment_orders
      (payment_option_id, zenler_course_id, course_title, option_type, student_name, student_email, amount, currency)
    VALUES
      (${data.paymentOptionId}, ${data.zenlerCourseId}, ${data.courseTitle}, ${data.optionType},
       ${data.studentName}, ${data.studentEmail}, ${data.amount}, ${data.currency})
    RETURNING *
  `;
  return rowToOrder(rows[0] as DbRow);
}

export async function attachStripeCheckoutSession(orderId: number, sessionId: string): Promise<void> {
  await sql`
    UPDATE payment_orders
    SET stripe_checkout_session_id = ${sessionId}
    WHERE id = ${orderId}
  `;
}

export async function getPaymentOrder(id: number): Promise<PaymentOrder | null> {
  const rows = await sql`SELECT * FROM payment_orders WHERE id = ${id}`;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function getPaymentOrderByCheckoutSession(sessionId: string): Promise<PaymentOrder | null> {
  const rows = await sql`SELECT * FROM payment_orders WHERE stripe_checkout_session_id = ${sessionId}`;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function markPaymentOrderPaid(data: {
  orderId: number;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeCustomerEmail: string | null;
  amountTotal: number | null;
  currency: string | null;
}): Promise<{ order: PaymentOrder; wasAlreadyPaid: boolean }> {
  const existing = await getPaymentOrder(data.orderId);
  if (!existing) throw new Error('Payment order not found');
  if (existing.status === 'Paid') return { order: existing, wasAlreadyPaid: true };

  const amount = data.amountTotal != null ? data.amountTotal / 100 : existing.amount;
  const currency = data.currency?.toUpperCase() ?? existing.currency;

  const rows = await sql`
    UPDATE payment_orders
    SET status = 'Paid',
        stripe_checkout_session_id = ${data.stripeCheckoutSessionId ?? existing.stripeCheckoutSessionId},
        stripe_payment_intent_id = ${data.stripePaymentIntentId},
        stripe_customer_email = ${data.stripeCustomerEmail ?? existing.stripeCustomerEmail},
        amount = ${amount},
        currency = ${currency},
        paid_at = COALESCE(paid_at, NOW())
    WHERE id = ${data.orderId}
    RETURNING *
  `;
  return { order: rowToOrder(rows[0] as DbRow), wasAlreadyPaid: false };
}

export async function markOrderEmailsSent(orderId: number, sent: { student?: boolean; admin?: boolean }): Promise<void> {
  await sql`
    UPDATE payment_orders
    SET confirmation_email_sent_at = CASE
          WHEN ${sent.student === true} THEN COALESCE(confirmation_email_sent_at, NOW())
          ELSE confirmation_email_sent_at
        END,
        admin_email_sent_at = CASE
          WHEN ${sent.admin === true} THEN COALESCE(admin_email_sent_at, NOW())
          ELSE admin_email_sent_at
        END
    WHERE id = ${orderId}
  `;
}
