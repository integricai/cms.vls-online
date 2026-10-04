import { randomUUID } from 'crypto';
import { sql } from '../db/client';
import type { CheckoutAttribution, CheckoutEnvironment, ConversionUploadStatus } from '../services/attribution';
import { parsePaymentProviderId, type PaymentProviderId } from '../services/payments/types';

export type PaymentOrderStatus = 'Pending' | 'Paid' | 'Failed' | 'Cancelled' | 'Refunded';

export interface PaymentOrder {
  id: number;
  paymentOptionId: number | null;
  courseId: number | null;
  coursePriceId: number | null;
  customerId: number | null;
  zenlerCourseId: string;
  accessZenlerCourseIds: string[];
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
  provider: PaymentProviderId;
  providerCheckoutId: string | null;
  providerPaymentId: string | null;
  providerRefundId: string | null;
  providerCustomerEmail: string | null;
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
  checkoutEnvironment: CheckoutEnvironment;
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
  access_zenler_course_ids: string[] | null;
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
  provider?: string | null;
  provider_checkout_id?: string | null;
  provider_payment_id?: string | null;
  provider_refund_id?: string | null;
  provider_customer_email?: string | null;
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
  checkout_environment: CheckoutEnvironment | null;
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
    accessZenlerCourseIds: row.access_zenler_course_ids ?? [],
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
    provider: parsePaymentProviderId(row.provider),
    providerCheckoutId: row.provider_checkout_id ?? row.stripe_checkout_session_id ?? null,
    providerPaymentId: row.provider_payment_id ?? row.stripe_payment_intent_id ?? null,
    providerRefundId: row.provider_refund_id ?? row.stripe_refund_id ?? null,
    providerCustomerEmail: row.provider_customer_email ?? row.stripe_customer_email ?? null,
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
    checkoutEnvironment: row.checkout_environment === 'production' ? 'production' : 'staging',
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
  accessZenlerCourseIds?: string[] | null;
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
  environment?: CheckoutEnvironment | null;
  provider?: PaymentProviderId | null;
}): Promise<PaymentOrder> {
  const attr = data.attribution;
  const environment = data.environment
    ?? attr?.environment
    ?? 'staging';
  const provider = parsePaymentProviderId(data.provider);
  const rows = await sql`
    INSERT INTO payment_orders
      (payment_option_id, course_id, course_price_id, customer_id, zenler_course_id, access_zenler_course_ids, course_title,
       option_type, student_name, student_email, student_phone, country_code, amount, currency, duration_days, discount_percent,
       provider,
       gclid, gbraid, wbraid, fbclid, fbp, fbc,
       utm_source, utm_medium, utm_campaign, utm_content, utm_term,
       landing_page, checkout_environment, attr_user_agent, attr_client_ip, attr_captured_at)
    VALUES
      (${data.paymentOptionId ?? null}, ${data.courseId ?? null}, ${data.coursePriceId ?? null},
       ${data.customerId ?? null}, ${data.zenlerCourseId}, ${data.accessZenlerCourseIds ?? null}, ${data.courseTitle}, ${data.optionType},
       ${data.studentName}, ${data.studentEmail}, ${data.studentPhone ?? null}, ${data.countryCode ?? null},
       ${data.amount}, ${data.currency}, ${data.durationDays ?? null}, ${data.discountPercent ?? null},
       ${provider},
       ${attr?.gclid ?? null}, ${attr?.gbraid ?? null}, ${attr?.wbraid ?? null},
       ${attr?.fbclid ?? null}, ${attr?.fbp ?? null}, ${attr?.fbc ?? null},
       ${attr?.utmSource ?? null}, ${attr?.utmMedium ?? null}, ${attr?.utmCampaign ?? null},
       ${attr?.utmContent ?? null}, ${attr?.utmTerm ?? null},
       ${attr?.landingPage ?? null}, ${environment}, ${attr?.userAgent ?? null}, ${attr?.clientIp ?? null},
       ${attr?.capturedAt ?? null})
    RETURNING *
  `;
  return rowToOrder(rows[0] as DbRow);
}

export async function attachCheckoutSession(
  orderId: number,
  data: { provider: PaymentProviderId; checkoutId: string },
): Promise<void> {
  const stripeSessionId = data.provider === 'stripe' ? data.checkoutId : null;
  await sql`
    UPDATE payment_orders
    SET provider = ${data.provider},
        provider_checkout_id = ${data.checkoutId},
        stripe_checkout_session_id = COALESCE(${stripeSessionId}, stripe_checkout_session_id)
    WHERE id = ${orderId}
  `;
}

export async function attachStripeCheckoutSession(orderId: number, sessionId: string): Promise<void> {
  await attachCheckoutSession(orderId, { provider: 'stripe', checkoutId: sessionId });
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
        stripe_customer_email = COALESCE(stripe_customer_email, ${studentEmail ?? null}),
        provider_customer_email = COALESCE(provider_customer_email, ${studentEmail ?? null})
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

export async function getPaymentOrderByCheckoutId(
  checkoutId: string,
  provider?: PaymentProviderId | null,
): Promise<PaymentOrder | null> {
  const rows = provider
    ? await sql`
        SELECT * FROM payment_orders
        WHERE (provider_checkout_id = ${checkoutId} OR stripe_checkout_session_id = ${checkoutId})
          AND provider = ${provider}
        ORDER BY id DESC
        LIMIT 1
      `
    : await sql`
        SELECT * FROM payment_orders
        WHERE provider_checkout_id = ${checkoutId}
           OR stripe_checkout_session_id = ${checkoutId}
        ORDER BY id DESC
        LIMIT 1
      `;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function getPaymentOrderByCheckoutSession(sessionId: string): Promise<PaymentOrder | null> {
  return getPaymentOrderByCheckoutId(sessionId);
}

export async function getPaymentOrderByPaymentId(
  paymentId: string,
  provider?: PaymentProviderId | null,
): Promise<PaymentOrder | null> {
  const rows = provider
    ? await sql`
        SELECT * FROM payment_orders
        WHERE (provider_payment_id = ${paymentId} OR stripe_payment_intent_id = ${paymentId})
          AND provider = ${provider}
        ORDER BY id DESC
        LIMIT 1
      `
    : await sql`
        SELECT * FROM payment_orders
        WHERE provider_payment_id = ${paymentId}
           OR stripe_payment_intent_id = ${paymentId}
        ORDER BY id DESC
        LIMIT 1
      `;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function getPaymentOrderByPaymentIntent(paymentIntentId: string): Promise<PaymentOrder | null> {
  return getPaymentOrderByPaymentId(paymentIntentId, 'stripe');
}

export async function markPaymentOrderPaid(data: {
  orderId: number;
  provider?: PaymentProviderId | null;
  checkoutId?: string | null;
  paymentId?: string | null;
  customerEmail?: string | null;
  amountMinor?: number | null;
  currency?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerEmail?: string | null;
  amountTotal?: number | null;
}): Promise<{ order: PaymentOrder; wasAlreadyPaid: boolean }> {
  const existing = await getPaymentOrder(data.orderId);
  if (!existing) throw new Error('Payment order not found');
  if (existing.status === 'Paid' || existing.status === 'Refunded') {
    return { order: existing, wasAlreadyPaid: true };
  }

  const provider = parsePaymentProviderId(data.provider ?? existing.provider);
  const checkoutId = data.checkoutId ?? data.stripeCheckoutSessionId ?? existing.providerCheckoutId;
  const paymentId = data.paymentId ?? data.stripePaymentIntentId ?? existing.providerPaymentId;
  const customerEmail = data.customerEmail ?? data.stripeCustomerEmail ?? existing.providerCustomerEmail;
  const amountMinor = data.amountMinor ?? data.amountTotal ?? null;
  const amount = amountMinor != null ? amountMinor / 100 : existing.amount;
  const currency = data.currency?.toUpperCase() ?? existing.currency;
  const stripeCheckoutId = provider === 'stripe' ? checkoutId : existing.stripeCheckoutSessionId;
  const stripePaymentId = provider === 'stripe' ? paymentId : existing.stripePaymentIntentId;
  const stripeCustomerEmail = provider === 'stripe' ? customerEmail : existing.stripeCustomerEmail;

  if (amountMinor != null) {
    const expectedCents = Math.round(existing.amount * 100);
    if (expectedCents !== amountMinor) {
      throw new Error(
        `Payment amount mismatch: expected ${expectedCents} cents, got ${amountMinor}`,
      );
    }
  }
  if (data.currency && data.currency.toUpperCase() !== existing.currency.toUpperCase()) {
    throw new Error(
      `Payment currency mismatch: expected ${existing.currency}, got ${data.currency}`,
    );
  }

  // Claim Pending → Paid in one statement. A concurrent webhook and /status
  // both see Pending on the read above; only the update that matches wins.
  const rows = await sql`
    UPDATE payment_orders
    SET status = 'Paid',
        provider = ${provider},
        provider_checkout_id = ${checkoutId},
        provider_payment_id = ${paymentId},
        provider_customer_email = ${customerEmail},
        stripe_checkout_session_id = ${stripeCheckoutId},
        stripe_payment_intent_id = ${stripePaymentId},
        stripe_customer_email = ${stripeCustomerEmail},
        amount = ${amount},
        currency = ${currency},
        paid_at = COALESCE(paid_at, NOW())
    WHERE id = ${data.orderId}
      AND status = 'Pending'
    RETURNING *
  `;
  const paid = rows[0] as DbRow | undefined;
  if (!paid) {
    const current = await getPaymentOrder(data.orderId);
    if (!current) throw new Error('Payment order not found');
    if (current.status === 'Paid' || current.status === 'Refunded') {
      return { order: current, wasAlreadyPaid: true };
    }
    throw new Error(`Cannot mark payment order paid in status ${current.status}`);
  }
  return { order: rowToOrder(paid), wasAlreadyPaid: false };
}

export async function markPaymentOrderRefunded(data: {
  orderId: number;
  provider?: PaymentProviderId | null;
  refundId?: string | null;
  paymentId?: string | null;
  stripeRefundId?: string | null;
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

  const provider = parsePaymentProviderId(data.provider ?? existing.provider);
  const refundId = data.refundId ?? data.stripeRefundId ?? existing.providerRefundId;
  const paymentId = data.paymentId ?? data.stripePaymentIntentId ?? existing.providerPaymentId;
  const stripeRefundId = provider === 'stripe' ? refundId : existing.stripeRefundId;
  const stripePaymentId = provider === 'stripe' ? paymentId : existing.stripePaymentIntentId;

  // Claim Paid → Refunded in one statement so concurrent refund calls
  // cannot both send the confirmation email.
  const rows = await sql`
    UPDATE payment_orders
    SET status = 'Refunded',
        provider = ${provider},
        provider_refund_id = COALESCE(${refundId}, provider_refund_id),
        provider_payment_id = COALESCE(${paymentId}, provider_payment_id),
        stripe_refund_id = COALESCE(${stripeRefundId}, stripe_refund_id),
        stripe_payment_intent_id = COALESCE(${stripePaymentId}, stripe_payment_intent_id),
        refunded_at = COALESCE(refunded_at, NOW())
    WHERE id = ${data.orderId}
      AND status = 'Paid'
    RETURNING *
  `;
  const refunded = rows[0] as DbRow | undefined;
  if (!refunded) {
    const current = await getPaymentOrder(data.orderId);
    if (!current) throw new Error('Payment order not found');
    if (current.status === 'Refunded') {
      return { order: current, wasAlreadyRefunded: true };
    }
    throw new Error(`Cannot refund payment order in status ${current.status}`);
  }
  return { order: rowToOrder(refunded), wasAlreadyRefunded: false };
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
          zenler_user_created = CASE
            WHEN ${data.zenlerUserCreated === true} THEN true
            ELSE zenler_user_created
          END
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

export async function getPaymentOrderForConversion(id: number): Promise<PaymentOrder | null> {
  const rows = await sql`
    SELECT po.*, cu.phone AS customer_phone
    FROM payment_orders po
    LEFT JOIN customers cu ON cu.id = po.customer_id
    WHERE po.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToOrder(rows[0] as DbRow) : null;
}

export async function listPaidConversionOrders(input: {
  search?: string;
  uploadStatus?: ConversionUploadStatus | 'all';
  environment?: CheckoutEnvironment | 'all';
  page?: number;
  pageSize?: number;
}): Promise<{ items: PaymentOrder[]; total: number; page: number; pageSize: number }> {
  const search = input.search?.trim().toLowerCase() || null;
  const uploadStatus = input.uploadStatus && input.uploadStatus !== 'all' ? input.uploadStatus : 'all';
  const environment = input.environment && input.environment !== 'all' ? input.environment : 'all';
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 50)));
  const offset = (page - 1) * pageSize;

  const rows = await sql`
    SELECT po.*, cu.phone AS customer_phone, COUNT(*) OVER()::int AS total_count
    FROM payment_orders po
    LEFT JOIN customers cu ON cu.id = po.customer_id
    WHERE po.status = 'Paid'
      AND (
        ${search}::text IS NULL
        OR po.id::text = ${search}
        OR LOWER(COALESCE(po.student_email, '')) LIKE '%' || ${search} || '%'
        OR LOWER(COALESCE(po.stripe_customer_email, '')) LIKE '%' || ${search} || '%'
        OR LOWER(COALESCE(po.provider_customer_email, '')) LIKE '%' || ${search} || '%'
        OR LOWER(COALESCE(po.student_name, '')) LIKE '%' || ${search} || '%'
        OR LOWER(COALESCE(po.course_title, '')) LIKE '%' || ${search} || '%'
        OR LOWER(COALESCE(po.gclid, '')) LIKE '%' || ${search} || '%'
      )
      AND (
        ${uploadStatus}::text = 'all'
        OR COALESCE(po.conversion_upload_status, 'pending_upload') = ${uploadStatus}
      )
      AND (
        ${environment}::text = 'all'
        OR COALESCE(po.checkout_environment, 'staging') = ${environment}
      )
    ORDER BY po.paid_at DESC NULLS LAST, po.id DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = Number((rows[0] as { total_count?: number } | undefined)?.total_count ?? 0);
  return {
    items: (rows as DbRow[]).map(rowToOrder),
    total,
    page,
    pageSize,
  };
}

/**
 * Paid orders whose Zenler enrolment or confirmation emails did not finish.
 * Limited to a recent paid_at window so historical rows with null send
 * timestamps are not emailed again. Never-attempted rows come first, then
 * the least recently attempted, so persistent failures rotate out of the batch.
 */
export async function listPaidOrdersNeedingReconciliation(input: {
  limit: number;
  minAgeMinutes: number;
  lookbackDays: number;
  includeAdminEmail: boolean;
}): Promise<PaymentOrder[]> {
  const limit = Math.min(Math.max(Math.trunc(input.limit), 1), 50);
  const minAgeMinutes = Math.max(Math.trunc(input.minAgeMinutes), 0);
  const lookbackDays = Math.max(Math.trunc(input.lookbackDays), 1);
  const includeAdminEmail = input.includeAdminEmail;

  const rows = await sql`
    SELECT po.*
    FROM payment_orders po
    WHERE po.status = 'Paid'
      AND po.paid_at IS NOT NULL
      AND po.paid_at <= NOW() - make_interval(mins => ${minAgeMinutes})
      AND po.paid_at >= NOW() - make_interval(days => ${lookbackDays})
      AND (
        (
          po.confirmation_email_sent_at IS NULL
          AND length(btrim(COALESCE(po.student_email, po.provider_customer_email, po.stripe_customer_email, ''))) > 0
        )
        OR (
          ${includeAdminEmail}::boolean
          AND po.admin_email_sent_at IS NULL
        )
        OR (
          (
            po.zenler_enrollment_status IS NULL
            OR po.zenler_enrollment_status IN ('pending', 'failed', 'skipped', '')
          )
          AND length(btrim(COALESCE(po.student_email, po.stripe_customer_email, ''))) > 0
          AND (
            EXISTS (
              SELECT 1
              FROM unnest(COALESCE(po.access_zenler_course_ids, ARRAY[]::text[])) AS cid
              WHERE btrim(cid) ~ '^[0-9]+$'
            )
            OR (
              COALESCE(cardinality(po.access_zenler_course_ids), 0) = 0
              AND btrim(COALESCE(po.zenler_course_id, '')) ~ '^[0-9]+$'
            )
          )
        )
      )
    ORDER BY po.fulfillment_attempted_at ASC NULLS FIRST, po.paid_at ASC
    LIMIT ${limit}
  `;
  return (rows as DbRow[]).map(rowToOrder);
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
      AND COALESCE(po.checkout_environment, 'staging') = 'production'
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

export function paymentOrderPayerEmail(order: PaymentOrder): string | null {
  return order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail ?? null;
}

export function paymentOrderCheckoutId(order: PaymentOrder): string | null {
  return order.providerCheckoutId ?? order.stripeCheckoutSessionId ?? null;
}

export function paymentOrderPaymentId(order: PaymentOrder): string | null {
  return order.providerPaymentId ?? order.stripePaymentIntentId ?? null;
}

export function paymentOrderRefundId(order: PaymentOrder): string | null {
  return order.providerRefundId ?? order.stripeRefundId ?? null;
}

/** Long enough to cover a live send, short enough that a crashed claim is retried. */
const EMAIL_CLAIM_MINUTES = 2;

/**
 * Take an expiring claim. The sent timestamp stays null until delivery succeeds.
 * A crashed process leaves the claim to expire so a later attempt can send.
 * Returns the claim token, or null when another live claim already owns the send.
 */
export async function claimOrderEmailSend(orderId: number, kind: 'student' | 'admin'): Promise<string | null> {
  const claimMinutes = EMAIL_CLAIM_MINUTES;
  const token = randomUUID();
  const rows = kind === 'student'
    ? await sql`
        UPDATE payment_orders
        SET confirmation_email_claim_until = NOW() + make_interval(mins => ${claimMinutes}),
            confirmation_email_claim_token = ${token}
        WHERE id = ${orderId}
          AND confirmation_email_sent_at IS NULL
          AND (
            confirmation_email_claim_until IS NULL
            OR confirmation_email_claim_until < NOW()
          )
        RETURNING id
      `
    : await sql`
        UPDATE payment_orders
        SET admin_email_claim_until = NOW() + make_interval(mins => ${claimMinutes}),
            admin_email_claim_token = ${token}
        WHERE id = ${orderId}
          AND admin_email_sent_at IS NULL
          AND (
            admin_email_claim_until IS NULL
            OR admin_email_claim_until < NOW()
          )
        RETURNING id
      `;
  return rows.length > 0 ? token : null;
}

export async function markOrderEmailSent(
  orderId: number,
  kind: 'student' | 'admin',
  claimToken: string,
): Promise<void> {
  if (kind === 'student') {
    await sql`
      UPDATE payment_orders
      SET confirmation_email_sent_at = NOW(),
          confirmation_email_claim_until = NULL,
          confirmation_email_claim_token = NULL
      WHERE id = ${orderId}
        AND confirmation_email_sent_at IS NULL
        AND confirmation_email_claim_token = ${claimToken}
    `;
    return;
  }
  await sql`
    UPDATE payment_orders
    SET admin_email_sent_at = NOW(),
        admin_email_claim_until = NULL,
        admin_email_claim_token = NULL
    WHERE id = ${orderId}
      AND admin_email_sent_at IS NULL
      AND admin_email_claim_token = ${claimToken}
  `;
}

export async function releaseOrderEmailSend(
  orderId: number,
  kind: 'student' | 'admin',
  claimToken: string,
): Promise<void> {
  if (kind === 'student') {
    await sql`
      UPDATE payment_orders
      SET confirmation_email_claim_until = NULL,
          confirmation_email_claim_token = NULL
      WHERE id = ${orderId}
        AND confirmation_email_sent_at IS NULL
        AND confirmation_email_claim_token = ${claimToken}
    `;
    return;
  }
  await sql`
    UPDATE payment_orders
    SET admin_email_claim_until = NULL,
        admin_email_claim_token = NULL
    WHERE id = ${orderId}
      AND admin_email_sent_at IS NULL
      AND admin_email_claim_token = ${claimToken}
  `;
}

/** Move this order behind others that have not been attempted yet. */
export async function markFulfillmentAttempted(orderId: number): Promise<void> {
  await sql`
    UPDATE payment_orders
    SET fulfillment_attempted_at = NOW()
    WHERE id = ${orderId}
  `;
}
