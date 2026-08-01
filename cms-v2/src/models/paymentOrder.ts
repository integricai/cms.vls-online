import { sql } from '../db/client';

export type PaymentOrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled' | 'Refunded';

export interface PaymentOrder {
  id: number;
  paymentOptionId: number | null;
  courseId: number | null;
  coursePriceId: number | null;
  customerId: number | null;
  zenlerCourseId: string;
  courseTitle: string;
  optionType: string | null;
  studentName: string | null;
  studentEmail: string | null;
  countryCode: string | null;
  amount: number;
  currency: string;
  durationDays: number | null;
  discountPercent: number | null;
  status: PaymentOrderStatus;
  stripeCheckoutSessionId: string | null;
  stripePaymentIntentId: string | null;
  stripeRefundId: string | null;
  stripeCustomerEmail: string | null;
  zenlerUserId: string | null;
  zenlerEnrollmentStatus: string | null;
  zenlerUserCreated: boolean;
  confirmationEmailSentAt: Date | null;
  adminEmailSentAt: Date | null;
  createdAt: Date;
  paidAt: Date | null;
  refundedAt: Date | null;
}

interface DbRow {
  id: number;
  payment_option_id: number | null;
  course_id: number | null;
  course_price_id: number | null;
  customer_id: number | null;
  zenler_course_id: string;
  course_title: string;
  option_type: string | null;
  student_name: string | null;
  student_email: string | null;
  country_code: string | null;
  amount: string;
  currency: string;
  duration_days: number | null;
  discount_percent: string | null;
  status: PaymentOrderStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  stripe_customer_email: string | null;
  zenler_user_id: string | null;
  zenler_enrollment_status: string | null;
  zenler_user_created: boolean;
  confirmation_email_sent_at: Date | null;
  admin_email_sent_at: Date | null;
  created_at: Date;
  paid_at: Date | null;
  refunded_at: Date | null;
}

function rowToOrder(row: DbRow): PaymentOrder {
  return {
    id: row.id,
    paymentOptionId: row.payment_option_id,
    courseId: row.course_id ?? null,
    coursePriceId: row.course_price_id ?? null,
    customerId: row.customer_id ?? null,
    zenlerCourseId: row.zenler_course_id,
    courseTitle: row.course_title,
    optionType: row.option_type,
    studentName: row.student_name,
    studentEmail: row.student_email,
    countryCode: row.country_code ?? null,
    amount: Number(row.amount),
    currency: row.currency,
    durationDays: row.duration_days ?? null,
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : null,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeRefundId: row.stripe_refund_id ?? null,
    stripeCustomerEmail: row.stripe_customer_email,
    zenlerUserId: row.zenler_user_id ?? null,
    zenlerEnrollmentStatus: row.zenler_enrollment_status ?? null,
    zenlerUserCreated: row.zenler_user_created ?? false,
    confirmationEmailSentAt: row.confirmation_email_sent_at,
    adminEmailSentAt: row.admin_email_sent_at,
    createdAt: row.created_at,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at ?? null,
  };
}

export async function createPaymentOrder(data: {
  paymentOptionId?: number | null;
  courseId?: number | null;
  coursePriceId?: number | null;
  customerId?: number | null;
  zenlerCourseId: string;
  courseTitle: string;
  optionType: string | null;
  studentName: string | null;
  studentEmail: string | null;
  countryCode?: string | null;
  amount: number;
  currency: string;
  durationDays?: number | null;
  discountPercent?: number | null;
}): Promise<PaymentOrder> {
  const rows = await sql`
    INSERT INTO payment_orders
      (payment_option_id, course_id, course_price_id, customer_id, zenler_course_id, course_title,
       option_type, student_name, student_email, country_code, amount, currency, duration_days, discount_percent)
    VALUES
      (${data.paymentOptionId ?? null}, ${data.courseId ?? null}, ${data.coursePriceId ?? null},
       ${data.customerId ?? null}, ${data.zenlerCourseId}, ${data.courseTitle}, ${data.optionType},
       ${data.studentName}, ${data.studentEmail}, ${data.countryCode ?? null},
       ${data.amount}, ${data.currency}, ${data.durationDays ?? null}, ${data.discountPercent ?? null})
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

export async function attachCustomerToPaymentOrder(
  orderId: number,
  customerId: number,
  studentEmail?: string | null,
): Promise<PaymentOrder> {
  const rows = await sql`
    UPDATE payment_orders
    SET customer_id = ${customerId},
        student_email = COALESCE(student_email, ${studentEmail ?? null}),
        stripe_customer_email = COALESCE(stripe_customer_email, ${studentEmail ?? null})
    WHERE id = ${orderId}
    RETURNING *
  `;
  if (!rows[0]) throw new Error('Payment order not found');
  return rowToOrder(rows[0] as DbRow);
}

export async function getPaymentOrder(id: number): Promise<PaymentOrder | null> {
  const rows = await sql`SELECT * FROM payment_orders WHERE id = ${id}`;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function getPaymentOrderByCheckoutSession(sessionId: string): Promise<PaymentOrder | null> {
  const rows = await sql`SELECT * FROM payment_orders WHERE stripe_checkout_session_id = ${sessionId}`;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function getPaymentOrderByPaymentIntent(paymentIntentId: string): Promise<PaymentOrder | null> {
  const rows = await sql`
    SELECT * FROM payment_orders
    WHERE stripe_payment_intent_id = ${paymentIntentId}
    ORDER BY id DESC
    LIMIT 1
  `;
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
  if (existing.status === 'Paid' || existing.status === 'Refunded') {
    return { order: existing, wasAlreadyPaid: true };
  }

  const amount = data.amountTotal != null ? data.amountTotal / 100 : existing.amount;
  const currency = data.currency?.toUpperCase() ?? existing.currency;

  if (data.amountTotal != null) {
    const expectedCents = Math.round(existing.amount * 100);
    if (expectedCents !== data.amountTotal) {
      throw new Error(
        `Payment amount mismatch: expected ${expectedCents} cents, got ${data.amountTotal}`,
      );
    }
  }
  if (data.currency && data.currency.toUpperCase() !== existing.currency.toUpperCase()) {
    throw new Error(
      `Payment currency mismatch: expected ${existing.currency}, got ${data.currency}`,
    );
  }

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

export async function markPaymentOrderRefunded(data: {
  orderId: number;
  stripeRefundId: string | null;
  stripePaymentIntentId?: string | null;
}): Promise<{ order: PaymentOrder; wasAlreadyRefunded: boolean }> {
  const existing = await getPaymentOrder(data.orderId);
  if (!existing) throw new Error('Payment order not found');
  if (existing.status === 'Refunded') {
    return { order: existing, wasAlreadyRefunded: true };
  }
  if (existing.status !== 'Paid') {
    throw new Error(`Cannot refund payment order in status ${existing.status}`);
  }

  const rows = await sql`
    UPDATE payment_orders
    SET status = 'Refunded',
        stripe_refund_id = COALESCE(${data.stripeRefundId}, stripe_refund_id),
        stripe_payment_intent_id = COALESCE(
          ${data.stripePaymentIntentId ?? null},
          stripe_payment_intent_id
        ),
        refunded_at = COALESCE(refunded_at, NOW())
    WHERE id = ${data.orderId}
    RETURNING *
  `;
  return { order: rowToOrder(rows[0] as DbRow), wasAlreadyRefunded: false };
}

export async function updateZenlerEnrollment(
  orderId: number,
  data: {
    zenlerUserId: string | null;
    zenlerEnrollmentStatus: string;
    zenlerUserCreated?: boolean;
  },
): Promise<void> {
  try {
    await sql`
      UPDATE payment_orders
      SET zenler_user_id = ${data.zenlerUserId},
          zenler_enrollment_status = ${data.zenlerEnrollmentStatus},
          zenler_user_created = COALESCE(${data.zenlerUserCreated ?? null}, zenler_user_created)
      WHERE id = ${orderId}
    `;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!/zenler_user_created/i.test(message)) throw err;

    await sql`
      UPDATE payment_orders
      SET zenler_user_id = ${data.zenlerUserId},
          zenler_enrollment_status = ${data.zenlerEnrollmentStatus}
      WHERE id = ${orderId}
    `;
  }
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
