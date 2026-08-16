import { sql } from '../db/client';
import type { CheckoutAttribution, ConversionUploadStatus } from '../services/attribution';

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
  studentPhone: string | null;
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
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  landingPage: string | null;
  attrUserAgent: string | null;
  attrClientIp: string | null;
  attrCapturedAt: Date | null;
  conversionUploadStatus: ConversionUploadStatus;
  conversionUploadedAt: Date | null;
  conversionUploadError: string | null;
  conversionUploadRequestId: string | null;
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
  student_phone: string | null;
  country_code: string | null;
  customer_phone: string | null;
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
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  fbp: string | null;
  fbc: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  landing_page: string | null;
  attr_user_agent: string | null;
  attr_client_ip: string | null;
  attr_captured_at: Date | null;
  conversion_upload_status: ConversionUploadStatus | null;
  conversion_uploaded_at: Date | null;
  conversion_upload_error: string | null;
  conversion_upload_request_id: string | null;
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
    studentPhone: row.student_phone ?? row.customer_phone ?? null,
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
    gclid: row.gclid ?? null,
    gbraid: row.gbraid ?? null,
    wbraid: row.wbraid ?? null,
    fbclid: row.fbclid ?? null,
    fbp: row.fbp ?? null,
    fbc: row.fbc ?? null,
    utmSource: row.utm_source ?? null,
    utmMedium: row.utm_medium ?? null,
    utmCampaign: row.utm_campaign ?? null,
    utmContent: row.utm_content ?? null,
    utmTerm: row.utm_term ?? null,
    landingPage: row.landing_page ?? null,
    attrUserAgent: row.attr_user_agent ?? null,
    attrClientIp: row.attr_client_ip ?? null,
    attrCapturedAt: row.attr_captured_at ?? null,
    conversionUploadStatus: row.conversion_upload_status ?? 'pending_upload',
    conversionUploadedAt: row.conversion_uploaded_at ?? null,
    conversionUploadError: row.conversion_upload_error ?? null,
    conversionUploadRequestId: row.conversion_upload_request_id ?? null,
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
  studentPhone?: string | null;
  countryCode?: string | null;
  amount: number;
  currency: string;
  durationDays?: number | null;
  discountPercent?: number | null;
  attribution?: CheckoutAttribution | null;
}): Promise<PaymentOrder> {
  const attr = data.attribution;
  const rows = await sql`
    INSERT INTO payment_orders
      (payment_option_id, course_id, course_price_id, customer_id, zenler_course_id, course_title,
       option_type, student_name, student_email, student_phone, country_code, amount, currency, duration_days, discount_percent,
       gclid, gbraid, wbraid, fbclid, fbp, fbc,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       landing_page, attr_user_agent, attr_client_ip, attr_captured_at)
    VALUES
      (${data.paymentOptionId ?? null}, ${data.courseId ?? null}, ${data.coursePriceId ?? null},
       ${data.customerId ?? null}, ${data.zenlerCourseId}, ${data.courseTitle}, ${data.optionType},
       ${data.studentName}, ${data.studentEmail}, ${data.studentPhone ?? null}, ${data.countryCode ?? null},
       ${data.amount}, ${data.currency}, ${data.durationDays ?? null}, ${data.discountPercent ?? null},
       ${attr?.gclid ?? null}, ${attr?.gbraid ?? null}, ${attr?.wbraid ?? null},
       ${attr?.fbclid ?? null}, ${attr?.fbp ?? null}, ${attr?.fbc ?? null},
       ${attr?.utmSource ?? null}, ${attr?.utmMedium ?? null}, ${attr?.utmCampaign ?? null},
       ${attr?.utmContent ?? null}, ${attr?.utmTerm ?? null},
       ${attr?.landingPage ?? null}, ${attr?.userAgent ?? null}, ${attr?.clientIp ?? null},
       ${attr?.capturedAt ?? null})
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

export async function listPurchaseConversionsDueForUpload(input: {
  limit: number;
  delayHours: number;
}): Promise<PaymentOrder[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 200);
  const delayHours = Math.max(input.delayHours, 0);
  const rows = await sql`
    SELECT po.*, cu.phone AS customer_phone
    FROM payment_orders po
    LEFT JOIN customers cu ON cu.id = po.customer_id
    WHERE po.status = 'Paid'
      AND po.paid_at IS NOT NULL
      AND po.paid_at <= NOW() - make_interval(hours => ${delayHours})
      AND COALESCE(po.conversion_upload_status, 'pending_upload') IN ('pending_upload', 'pending')
    ORDER BY po.paid_at ASC
    LIMIT ${limit}
  `;
  return (rows as DbRow[]).map(rowToOrder);
}

export async function markConversionUploadResult(input: {
  orderId: number;
  status: ConversionUploadStatus;
  error?: string | null;
  requestId?: string | null;
}): Promise<void> {
  await sql`
    UPDATE payment_orders
    SET conversion_upload_status = ${input.status},
        conversion_uploaded_at = CASE
          WHEN ${input.status} IN ('uploaded', 'extended_upload') THEN NOW()
          ELSE conversion_uploaded_at
        END,
        conversion_upload_error = ${input.error ?? null},
        conversion_upload_request_id = COALESCE(${input.requestId ?? null}, conversion_upload_request_id)
    WHERE id = ${input.orderId}
  `;
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
