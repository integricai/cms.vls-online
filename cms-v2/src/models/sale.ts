import { sql } from '../db/client';
import type {
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
  sold_at: Date;
  expiry_date: Date;
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
}

function num(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return Number(value);
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
}): Promise<Sale> {
  const expiryDate = computeExpiryDate(data.soldAt, data.durationDays);
  const rows = await sql`
    INSERT INTO sales (
      customer_id, course_id, course_price_id, payment_order_id,
      amount, currency, discount_percent, duration_days, sold_at, expiry_date,
      assignment_status
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
};

export async function listSales(filters: ListSalesFilters = {}): Promise<SaleListItem[]> {
  const status = filters.status ?? 'All';
  const courseId = filters.courseId ?? null;
  const tutorId = filters.tutorId ?? null;

  let rows;
  if (status === 'Unassigned' || status === 'AwaitingTutor') {
    rows = await sql`
      SELECT
        s.*,
        c.name AS course_name,
        cu.email AS customer_email,
        cu.first_name AS customer_first_name,
        cu.last_name AS customer_last_name,
        t.name AS tutor_name,
        COALESCE(inv.invite_count, 0) AS invite_count,
        COALESCE(inv.accepted_invite_count, 0) AS accepted_invite_count
      FROM sales s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN tutors t ON t.id = s.tutor_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS invite_count,
          COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted_invite_count
        FROM sale_tutor_invites sti
        WHERE sti.sale_id = s.id
      ) inv ON TRUE
      WHERE s.tutor_id IS NULL
        AND (${courseId}::int IS NULL OR s.course_id = ${courseId})
        AND (${tutorId}::int IS NULL OR s.tutor_id = ${tutorId})
      ORDER BY s.sold_at DESC, s.id DESC
    `;
  } else if (status === 'AssignedAny' || status === 'Assigned' || status === 'AdminAssigned') {
    const exactStatus = status === 'AssignedAny' ? null : status;
    rows = await sql`
      SELECT
        s.*,
        c.name AS course_name,
        cu.email AS customer_email,
        cu.first_name AS customer_first_name,
        cu.last_name AS customer_last_name,
        t.name AS tutor_name,
        COALESCE(inv.invite_count, 0) AS invite_count,
        COALESCE(inv.accepted_invite_count, 0) AS accepted_invite_count
      FROM sales s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN tutors t ON t.id = s.tutor_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS invite_count,
          COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted_invite_count
        FROM sale_tutor_invites sti
        WHERE sti.sale_id = s.id
      ) inv ON TRUE
      WHERE s.tutor_id IS NOT NULL
        AND (${exactStatus}::text IS NULL OR s.assignment_status = ${exactStatus})
        AND (${courseId}::int IS NULL OR s.course_id = ${courseId})
        AND (${tutorId}::int IS NULL OR s.tutor_id = ${tutorId})
      ORDER BY s.sold_at DESC, s.id DESC
    `;
  } else {
    rows = await sql`
      SELECT
        s.*,
        c.name AS course_name,
        cu.email AS customer_email,
        cu.first_name AS customer_first_name,
        cu.last_name AS customer_last_name,
        t.name AS tutor_name,
        COALESCE(inv.invite_count, 0) AS invite_count,
        COALESCE(inv.accepted_invite_count, 0) AS accepted_invite_count
      FROM sales s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN tutors t ON t.id = s.tutor_id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::int AS invite_count,
          COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::int AS accepted_invite_count
        FROM sale_tutor_invites sti
        WHERE sti.sale_id = s.id
      ) inv ON TRUE
      WHERE (${courseId}::int IS NULL OR s.course_id = ${courseId})
        AND (${tutorId}::int IS NULL OR s.tutor_id = ${tutorId})
      ORDER BY s.sold_at DESC, s.id DESC
    `;
  }

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
    WHERE s.tutor_id IS NOT NULL
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
