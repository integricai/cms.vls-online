import { sql } from '../db/client';
import { ensurePaymentPresentmentColumns } from './paymentOrder';
import { isValidIsoCountryCode, normalizeCountryCode } from '../utils/isoCountryCodes';
import type {
  PaymentOrderStatus,
  Sale,
  SaleAssignmentStatus,
  SaleCourseSummary,
  SaleListItem,
  SaleTutorSummary,
} from '../../shared/types';

export interface SaleDbRow {
  id: number;
  customer_id: number;
  course_id: number;
  course_price_id: number | null;
  payment_order_id: number;
  amount: string;
  currency: string;
  discount_percent: string | null;
  duration_days: number;
  session_month?: number | null;
  session_year?: number | null;
  sold_at: Date;
  expiry_date: Date;
  country_code: string | null;
  tutor_id: number | null;
  assignment_status: SaleAssignmentStatus;
  commission_percent: string | null;
  commission_amount: string | null;
  assigned_at: Date | null;
  created_at: Date;
}

interface SaleListDbRow extends SaleDbRow {
  course_name: string | null;
  customer_email: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  tutor_name: string | null;
  invite_count: string | number;
  accepted_invite_count: string | number;
  payment_status: PaymentOrderStatus | null;
  provider: string | null;
  provider_checkout_id: string | null;
  provider_payment_id: string | null;
  provider_refund_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  paid_at: Date | null;
  refunded_at: Date | null;
  option_type: string | null;
  processor_fee: string | null;
  net_amount: string | null;
  settlement_currency: string | null;
  payment_method_label: string | null;
  checkout_environment: string | null;
  presentment_amount: string | null;
  presentment_currency: string | null;
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
}

function saleCountryCode(value: string | null | undefined): string | null {
  const code = normalizeCountryCode(value);
  return code && isValidIsoCountryCode(code) ? code : null;
}

export function rowToSale(row: SaleDbRow): Sale {
  return {
    id: row.id,
    customerId: row.customer_id,
    courseId: row.course_id,
    coursePriceId: row.course_price_id,
    paymentOrderId: row.payment_order_id,
    amount: Number(row.amount),
    currency: row.currency,
    discountPercent: num(row.discount_percent),
    durationDays: row.duration_days,
    soldAt: row.sold_at,
    expiryDate: row.expiry_date,
    sessionMonth: row.session_month ?? null,
    sessionYear: row.session_year ?? null,
    countryCode: saleCountryCode(row.country_code),
    tutorId: row.tutor_id,
    assignmentStatus: row.assignment_status ?? 'AwaitingTutor',
    commissionPercent: num(row.commission_percent),
    commissionAmount: num(row.commission_amount),
    assignedAt: row.assigned_at,
    createdAt: row.created_at,
  };
}

function rowToSaleListItem(row: SaleListDbRow): SaleListItem {
  return {
    ...rowToSale(row),
    courseName: row.course_name,
    customerEmail: row.customer_email,
    customerFirstName: row.customer_first_name,
    customerLastName: row.customer_last_name,
    tutorName: row.tutor_name,
    inviteCount: Number(row.invite_count ?? 0),
    acceptedInviteCount: Number(row.accepted_invite_count ?? 0),
    paymentStatus: row.payment_status ?? null,
    provider: row.provider === 'paypal' ? 'paypal' : row.provider === 'stripe' ? 'stripe' : (row.stripe_payment_intent_id || row.stripe_checkout_session_id ? 'stripe' : null),
    providerCheckoutId: row.provider_checkout_id ?? row.stripe_checkout_session_id ?? null,
    providerPaymentId: row.provider_payment_id ?? row.stripe_payment_intent_id ?? null,
    providerRefundId: row.provider_refund_id ?? row.stripe_refund_id ?? null,
    stripeCheckoutSessionId: row.stripe_checkout_session_id ?? null,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? null,
    stripeRefundId: row.stripe_refund_id ?? null,
    paidAt: row.paid_at ?? null,
    refundedAt: row.refunded_at ?? null,
    optionType: row.option_type ?? null,
    processorFee: num(row.processor_fee),
    netAmount: num(row.net_amount),
    settlementCurrency: row.settlement_currency ?? null,
    paymentMethod: row.payment_method_label ?? null,
    checkoutEnvironment: row.checkout_environment === 'production'
      ? 'production'
      : row.checkout_environment === 'staging'
        ? 'staging'
        : null,
    presentmentAmount: row.presentment_amount != null ? Number(row.presentment_amount) : null,
    presentmentCurrency: row.presentment_currency ?? null,
  };
}

export function computeExpiryDate(soldAt: Date, durationDays: number): Date {
  const expiry = new Date(soldAt);
  expiry.setUTCDate(expiry.getUTCDate() + durationDays);
  return expiry;
}

export function computeCommissionAmount(amount: number, commissionPercent: number): number {
  return Math.round((amount * commissionPercent) / 100 * 100) / 100;
}

export async function getSaleById(id: number): Promise<Sale | null> {
  const rows = await sql`SELECT * FROM sales WHERE id = ${id}`;
  return rows[0] ? rowToSale(rows[0] as SaleDbRow) : null;
}

export async function getSaleByPaymentOrderId(paymentOrderId: number): Promise<Sale | null> {
  const rows = await sql`SELECT * FROM sales WHERE payment_order_id = ${paymentOrderId}`;
  return rows[0] ? rowToSale(rows[0] as SaleDbRow) : null;
}

export async function getSaleListItemById(id: number): Promise<SaleListItem | null> {
  await ensurePaymentPresentmentColumns();
  const rows = await sql`
    SELECT
      s.*,
      c.name AS course_name,
      cu.email AS customer_email,
      cu.first_name AS customer_first_name,
      cu.last_name AS customer_last_name,
      t.name AS tutor_name,
      COALESCE(inv.invite_count, 0) AS invite_count,
      COALESCE(inv.accepted_invite_count, 0) AS accepted_invite_count,
      po.status AS payment_status,
      po.provider,
      po.provider_checkout_id,
      po.provider_payment_id,
      po.provider_refund_id,
      po.stripe_checkout_session_id,
      po.stripe_payment_intent_id,
      po.stripe_refund_id,
      po.paid_at,
      po.refunded_at,
      po.option_type,
      po.processor_fee,
      po.net_amount,
      po.payment_method_label,
      po.checkout_environment,
      po.presentment_amount,
      po.presentment_currency,
      po.settlement_currency
    FROM sales s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN customers cu ON cu.id = s.customer_id
    LEFT JOIN tutors t ON t.id = s.tutor_id
    LEFT JOIN payment_orders po ON po.id = s.payment_order_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS invite_count,
        COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted_invite_count
      FROM sale_tutor_invites sti
      WHERE sti.sale_id = s.id
    ) inv ON TRUE
    WHERE s.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToSaleListItem(rows[0] as SaleListDbRow) : null;
}

export async function createSale(data: {
  customerId: number;
  courseId: number;
  coursePriceId: number | null;
  paymentOrderId: number;
  amount: number;
  currency: string;
  discountPercent: number | null;
  durationDays: number;
  soldAt: Date;
  /** When set, this is the 15th of the exam sitting instead of soldAt + durationDays. */
  expiryDate?: Date | null;
  sessionMonth?: number | null;
  sessionYear?: number | null;
  countryCode?: string | null;
}): Promise<Sale> {
  const expiryDate = data.expiryDate ?? computeExpiryDate(data.soldAt, data.durationDays);
  const countryCode = saleCountryCode(data.countryCode);
  const rows = await sql`
    INSERT INTO sales (
      customer_id, course_id, course_price_id, payment_order_id,
      amount, currency, discount_percent, duration_days, sold_at, expiry_date,
      session_month, session_year, session_checked_at,
      country_code, assignment_status
    )
    VALUES (
      ${data.customerId},
      ${data.courseId},
      ${data.coursePriceId},
      ${data.paymentOrderId},
      ${data.amount},
      ${data.currency},
      ${data.discountPercent},
      ${data.durationDays},
      ${data.soldAt},
      ${expiryDate},
      ${data.sessionMonth ?? null},
      ${data.sessionYear ?? null},
      NOW(),
      ${countryCode},
      'AwaitingTutor'
    )
    RETURNING *
  `;
  return rowToSale(rows[0] as SaleDbRow);
}

export type ListSalesFilters = {
  status?: SaleAssignmentStatus | 'Unassigned' | 'AssignedAny' | 'All';
  courseId?: number;
  tutorId?: number;
  /** Inclusive London calendar dates, YYYY-MM-DD. */
  fromDate?: string | null;
  toDate?: string | null;
  /** Omit to include both live and sandbox checkouts. */
  environment?: 'production' | 'staging' | null;
};

export async function listSales(filters: ListSalesFilters = {}): Promise<SaleListItem[]> {
  await ensurePaymentPresentmentColumns();
  const status = filters.status ?? 'All';
  const courseId = filters.courseId ?? null;
  const tutorId = filters.tutorId ?? null;
  const fromDate = filters.fromDate ?? null;
  const toDate = filters.toDate ?? null;
  const environment = filters.environment ?? null;

  const rows = await sql`
    SELECT
      s.*,
      c.name AS course_name,
      cu.email AS customer_email,
      cu.first_name AS customer_first_name,
      cu.last_name AS customer_last_name,
      t.name AS tutor_name,
      COALESCE(inv.invite_count, 0) AS invite_count,
      COALESCE(inv.accepted_invite_count, 0) AS accepted_invite_count,
      po.status AS payment_status,
      po.provider,
      po.provider_checkout_id,
      po.provider_payment_id,
      po.provider_refund_id,
      po.stripe_checkout_session_id,
      po.stripe_payment_intent_id,
      po.stripe_refund_id,
      po.paid_at,
      po.refunded_at,
      po.option_type,
      po.processor_fee,
      po.net_amount,
      po.payment_method_label,
      po.checkout_environment,
      po.presentment_amount,
      po.presentment_currency,
      po.settlement_currency
    FROM sales s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN customers cu ON cu.id = s.customer_id
    LEFT JOIN tutors t ON t.id = s.tutor_id
    LEFT JOIN payment_orders po ON po.id = s.payment_order_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*)::int AS invite_count,
        COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted_invite_count
      FROM sale_tutor_invites sti
      WHERE sti.sale_id = s.id
    ) inv ON TRUE
    WHERE (${courseId}::int IS NULL OR s.course_id = ${courseId})
      AND (${tutorId}::int IS NULL OR s.tutor_id = ${tutorId})
      AND (
        ${fromDate}::text IS NULL
        OR (s.sold_at AT TIME ZONE 'Europe/London')::date >= CAST(${fromDate} AS date)
      )
      AND (
        ${toDate}::text IS NULL
        OR (s.sold_at AT TIME ZONE 'Europe/London')::date <= CAST(${toDate} AS date)
      )
      AND (${environment}::text IS NULL OR po.checkout_environment = ${environment})
      AND (
        ${status}::text = 'All'
        OR (
          (${status}::text = 'Unassigned' OR ${status}::text = 'AwaitingTutor')
          AND s.tutor_id IS NULL
        )
        OR (
          ${status}::text = 'AssignedAny'
          AND s.tutor_id IS NOT NULL
        )
        OR (
          (${status}::text = 'Assigned' OR ${status}::text = 'AdminAssigned')
          AND s.tutor_id IS NOT NULL
          AND s.assignment_status = ${status}
        )
      )
    ORDER BY s.sold_at DESC, s.id DESC
  `;

  return (rows as SaleListDbRow[]).map(rowToSaleListItem);
}

export async function summarizeSalesByCourse(): Promise<SaleCourseSummary[]> {
  const rows = await sql`
    SELECT
      s.course_id,
      COALESCE(c.name, 'Unknown course') AS course_name,
      COUNT(*)::int AS sale_count,
      COUNT(*) FILTER (WHERE s.tutor_id IS NULL)::int AS unassigned_count,
      COALESCE(SUM(s.amount), 0) AS total_amount,
      COALESCE(SUM(s.commission_amount), 0) AS total_commission,
      COALESCE(array_remove(array_agg(DISTINCT s.currency), NULL), ARRAY[]::text[]) AS currencies
    FROM sales s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN payment_orders po ON po.id = s.payment_order_id
    WHERE COALESCE(po.status, 'Paid') <> 'Refunded'
    GROUP BY s.course_id, c.name
    ORDER BY COUNT(*) DESC, c.name ASC
  `;

  return (rows as Array<{
    course_id: number;
    course_name: string;
    sale_count: number;
    unassigned_count: number;
    total_amount: string;
    total_commission: string;
    currencies: string[];
  }>).map(row => ({
    courseId: row.course_id,
    courseName: row.course_name,
    saleCount: Number(row.sale_count),
    unassignedCount: Number(row.unassigned_count),
    totalAmount: Number(row.total_amount),
    totalCommission: Number(row.total_commission),
    currencies: row.currencies ?? [],
  }));
}

export async function summarizeSalesByTutor(): Promise<SaleTutorSummary[]> {
  const rows = await sql`
    SELECT
      s.tutor_id,
      COALESCE(t.name, 'Unknown tutor') AS tutor_name,
      COALESCE(t.commission_percent, 0) AS commission_percent,
      COUNT(*)::int AS sale_count,
      COALESCE(SUM(s.amount), 0) AS total_amount,
      COALESCE(SUM(s.commission_amount), 0) AS total_commission,
      COALESCE(array_remove(array_agg(DISTINCT s.currency), NULL), ARRAY[]::text[]) AS currencies
    FROM sales s
    LEFT JOIN tutors t ON t.id = s.tutor_id
    LEFT JOIN payment_orders po ON po.id = s.payment_order_id
    WHERE s.tutor_id IS NOT NULL
      AND COALESCE(po.status, 'Paid') <> 'Refunded'
    GROUP BY s.tutor_id, t.name, t.commission_percent
    ORDER BY COALESCE(SUM(s.commission_amount), 0) DESC, t.name ASC
  `;

  return (rows as Array<{
    tutor_id: number;
    tutor_name: string;
    commission_percent: string;
    sale_count: number;
    total_amount: string;
    total_commission: string;
    currencies: string[];
  }>).map(row => ({
    tutorId: row.tutor_id,
    tutorName: row.tutor_name,
    commissionPercent: Number(row.commission_percent),
    saleCount: Number(row.sale_count),
    totalAmount: Number(row.total_amount),
    totalCommission: Number(row.total_commission),
    currencies: row.currencies ?? [],
  }));
}

export async function assignSaleToTutor(params: {
  saleId: number;
  tutorId: number;
  commissionPercent: number;
  assignmentStatus: 'Assigned' | 'AdminAssigned';
}): Promise<Sale | null> {
  const rows = await sql`
    UPDATE sales
    SET
      tutor_id = ${params.tutorId},
      assignment_status = ${params.assignmentStatus},
      commission_percent = ${params.commissionPercent},
      commission_amount = ROUND((amount * ${params.commissionPercent}) / 100.0, 2),
      assigned_at = NOW()
    WHERE id = ${params.saleId}
      AND tutor_id IS NULL
      AND assignment_status = 'AwaitingTutor'
    RETURNING *
  `;

  return rows[0] ? rowToSale(rows[0] as SaleDbRow) : null;
}

export async function getSaleDetailForInvite(saleId: number): Promise<{
  sale: Sale;
  courseName: string | null;
  studentFirstName: string | null;
  studentEmail: string | null;
} | null> {
  const rows = await sql`
    SELECT
      s.*,
      c.name AS course_name,
      cu.first_name AS customer_first_name,
      cu.email AS customer_email
    FROM sales s
    LEFT JOIN courses c ON c.id = s.course_id
    LEFT JOIN customers cu ON cu.id = s.customer_id
    WHERE s.id = ${saleId}
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const row = rows[0] as SaleDbRow & {
    course_name: string | null;
    customer_first_name: string | null;
    customer_email: string | null;
  };
  return {
    sale: rowToSale(row),
    courseName: row.course_name,
    studentFirstName: row.customer_first_name,
    studentEmail: row.customer_email,
  };
}

export type SessionBackfillCandidate = {
  saleId: number;
  soldAt: Date;
  orderId: number;
  optionType: string | null;
  orderSessionMonth: number | null;
  orderSessionYear: number | null;
};

/** Paid sales that have not yet been checked for an exam sitting. */
export async function listSalesNeedingSessionBackfill(limit = 25): Promise<SessionBackfillCandidate[]> {
  const rows = await sql`
    SELECT
      s.id AS sale_id,
      s.sold_at,
      po.id AS order_id,
      po.option_type,
      po.session_month,
      po.session_year
    FROM sales s
    JOIN payment_orders po ON po.id = s.payment_order_id
    WHERE s.session_checked_at IS NULL
      AND s.session_month IS NULL
      AND po.status = 'Paid'
    ORDER BY s.session_check_attempts ASC, s.sold_at ASC
    LIMIT ${limit}
  `;
  return (rows as Array<{
    sale_id: number;
    sold_at: Date;
    order_id: number;
    option_type: string | null;
    session_month: number | null;
    session_year: number | null;
  }>).map(row => ({
    saleId: row.sale_id,
    soldAt: row.sold_at,
    orderId: row.order_id,
    optionType: row.option_type,
    orderSessionMonth: row.session_month,
    orderSessionYear: row.session_year,
  }));
}

export async function saveBackfilledExamSession(input: {
  saleId: number;
  orderId: number;
  sessionMonth: number;
  sessionYear: number;
  durationDays: number;
  expiryDate: Date;
}): Promise<void> {
  await sql`
    UPDATE payment_orders
    SET session_month = ${input.sessionMonth},
        session_year = ${input.sessionYear}
    WHERE id = ${input.orderId}
      AND session_month IS NULL
  `;
  await sql`
    UPDATE sales
    SET session_month = ${input.sessionMonth},
        session_year = ${input.sessionYear},
        duration_days = ${input.durationDays},
        expiry_date = ${input.expiryDate},
        session_checked_at = NOW()
    WHERE id = ${input.saleId}
      AND session_month IS NULL
      AND ${input.expiryDate} > sold_at
    RETURNING id
  `;
  await markSaleSessionChecked(input.saleId);
}

export async function markSaleSessionChecked(saleId: number): Promise<void> {
  await sql`
    UPDATE sales
    SET session_checked_at = NOW()
    WHERE id = ${saleId}
      AND session_checked_at IS NULL
  `;
}

const SESSION_BACKFILL_ATTEMPT_LIMIT = 3;

/** A backfill error is retried twice, then the sale is left on its catalogue length. */
export async function noteSessionBackfillFailure(saleId: number): Promise<void> {
  await sql`
    UPDATE sales
    SET session_check_attempts = session_check_attempts + 1,
        session_checked_at = CASE
          WHEN session_check_attempts + 1 >= ${SESSION_BACKFILL_ATTEMPT_LIMIT} THEN NOW()
          ELSE session_checked_at
        END
    WHERE id = ${saleId}
      AND session_checked_at IS NULL
  `;
}

/** Named sittings whose sale expiry would move to the 15th. Does not write. */
export async function countNamedSessionBackfill(): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS named_sittings
    FROM sales s
    JOIN payment_orders po ON po.id = s.payment_order_id
    LEFT JOIN (
      VALUES
        ('january', 1), ('jan', 1),
        ('february', 2), ('feb', 2),
        ('march', 3), ('mar', 3),
        ('april', 4), ('apr', 4),
        ('may', 5),
        ('june', 6), ('jun', 6),
        ('july', 7), ('jul', 7),
        ('august', 8), ('aug', 8),
        ('september', 9), ('sept', 9), ('sep', 9),
        ('october', 10), ('oct', 10),
        ('november', 11), ('nov', 11),
        ('december', 12), ('dec', 12)
    ) AS names(month_name, month_number)
      ON names.month_name = lower((regexp_match(
        lower(btrim(po.option_type)),
        '^([a-z]+)[[:space:]]+([0-9]{4})([[:space:]]+session)?$'
      ))[1])
    WHERE s.session_checked_at IS NULL
      AND s.session_month IS NULL
      AND po.status = 'Paid'
      AND (
        (
          po.session_month BETWEEN 1 AND 12
          AND po.session_year BETWEEN 2000 AND 2100
          AND make_timestamptz(po.session_year, po.session_month, 16, 0, 0, 0, 'Europe/London')
            - interval '1 millisecond' > s.sold_at
        )
        OR (
          po.session_month IS NULL
          AND names.month_number IS NOT NULL
          AND (regexp_match(
            lower(btrim(po.option_type)),
            '^([a-z]+)[[:space:]]+([0-9]{4})([[:space:]]+session)?$'
          ))[2]::int BETWEEN 2000 AND 2100
          AND make_timestamptz(
            (regexp_match(
              lower(btrim(po.option_type)),
              '^([a-z]+)[[:space:]]+([0-9]{4})([[:space:]]+session)?$'
            ))[2]::int,
            names.month_number,
            16, 0, 0, 0, 'Europe/London'
          ) - interval '1 millisecond' > s.sold_at
        )
      )
  `;
  return Number((rows[0] as { named_sittings?: number } | undefined)?.named_sittings ?? 0);
}
