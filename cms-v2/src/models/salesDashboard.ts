import { addCrossCurrencyEarnings } from '../../shared/salesFormat';
import { sql } from '../db/client';
import { ensurePaymentPresentmentColumns } from './paymentOrder';

export interface SalesDayTotal {
  date: string;
  currency: string;
  count: number;
  gross: number;
  earnings: number;
}

export interface SalesActivityRow {
  id: number;
  soldAt: Date;
  courseName: string | null;
  firstName: string | null;
  lastName: string | null;
  amount: number;
  currency: string;
  presentmentAmount: number | null;
  presentmentCurrency: string | null;
  refunded: boolean;
}

function dayKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value ?? '').slice(0, 10);
}

export async function listSalesDayTotals(startDate: string, endDate: string): Promise<SalesDayTotal[]> {
  await ensurePaymentPresentmentColumns();
  const [grossRows, settledRows] = await Promise.all([
    sql`
      SELECT
        (s.sold_at AT TIME ZONE 'Europe/London')::date AS sold_on,
        s.currency,
        COUNT(*)::int AS sale_count,
        COALESCE(SUM(s.amount), 0) AS gross_amount,
        COALESCE(SUM(
          CASE
            WHEN po.settlement_currency IS NOT NULL
              AND po.net_amount IS NOT NULL
              AND UPPER(po.settlement_currency) = UPPER(s.currency)
              THEN po.net_amount
            WHEN po.settlement_currency IS NOT NULL
              AND po.net_amount IS NOT NULL
              AND UPPER(po.settlement_currency) <> UPPER(s.currency)
              THEN 0
            WHEN po.net_amount IS NOT NULL AND po.net_amount >= 0
              THEN po.net_amount
            ELSE s.amount
          END
        ), 0) AS earnings_amount
      FROM sales s
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE COALESCE(po.status, 'Paid') <> 'Refunded'
        AND po.checkout_environment = 'production'
        AND (s.sold_at AT TIME ZONE 'Europe/London')::date >= CAST(${startDate} AS date)
        AND (s.sold_at AT TIME ZONE 'Europe/London')::date <= CAST(${endDate} AS date)
      GROUP BY 1, 2
      ORDER BY 1
    `,
    sql`
      SELECT
        (s.sold_at AT TIME ZONE 'Europe/London')::date AS sold_on,
        po.settlement_currency AS currency,
        COALESCE(SUM(po.net_amount), 0) AS earnings_amount
      FROM sales s
      JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE COALESCE(po.status, 'Paid') <> 'Refunded'
        AND po.checkout_environment = 'production'
        AND (s.sold_at AT TIME ZONE 'Europe/London')::date >= CAST(${startDate} AS date)
        AND (s.sold_at AT TIME ZONE 'Europe/London')::date <= CAST(${endDate} AS date)
        AND po.settlement_currency IS NOT NULL
        AND po.net_amount IS NOT NULL
        AND UPPER(po.settlement_currency) <> UPPER(s.currency)
      GROUP BY 1, 2
    `,
  ]);

  const days = (grossRows as Array<{
    sold_on: unknown;
    currency: string;
    sale_count: number;
    gross_amount: string;
    earnings_amount: string;
  }>).map(row => ({
    date: dayKey(row.sold_on),
    currency: row.currency || 'USD',
    count: Number(row.sale_count),
    gross: Number(row.gross_amount),
    earnings: Number(row.earnings_amount),
  }));

  const settled = (settledRows as Array<{
    sold_on: unknown;
    currency: string;
    earnings_amount: string;
  }>).map(row => ({
    date: dayKey(row.sold_on),
    currency: row.currency || 'USD',
    earnings: Number(row.earnings_amount),
  }));

  return addCrossCurrencyEarnings(days, settled);
}

export async function listRecentSalesActivity(limit: number, includeRefunded: boolean): Promise<SalesActivityRow[]> {
  await ensurePaymentPresentmentColumns();
  const rows = includeRefunded
    ? await sql`
      SELECT
        s.id,
        s.sold_at,
        s.amount,
        s.currency,
        po.presentment_amount,
        po.presentment_currency,
        CASE WHEN s.course_id IS NULL THEN 'Payment Order' ELSE c.name END AS course_name,
        cu.first_name,
        cu.last_name,
        COALESCE(po.status, 'Paid') = 'Refunded' AS refunded
      FROM sales s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE po.checkout_environment = 'production'
      ORDER BY s.sold_at DESC, s.id DESC
      LIMIT ${limit}
    `
    : await sql`
      SELECT
        s.id,
        s.sold_at,
        s.amount,
        s.currency,
        po.presentment_amount,
        po.presentment_currency,
        CASE WHEN s.course_id IS NULL THEN 'Payment Order' ELSE c.name END AS course_name,
        cu.first_name,
        cu.last_name,
        FALSE AS refunded
      FROM sales s
      LEFT JOIN courses c ON c.id = s.course_id
      LEFT JOIN customers cu ON cu.id = s.customer_id
      LEFT JOIN payment_orders po ON po.id = s.payment_order_id
      WHERE COALESCE(po.status, 'Paid') <> 'Refunded'
        AND po.checkout_environment = 'production'
      ORDER BY s.sold_at DESC, s.id DESC
      LIMIT ${limit}
    `;

  return (rows as Array<{
    id: number;
    sold_at: Date;
    amount: string;
    currency: string;
    presentment_amount: string | null;
    presentment_currency: string | null;
    course_name: string | null;
    first_name: string | null;
    last_name: string | null;
    refunded: boolean;
  }>).map(row => ({
    id: row.id,
    soldAt: row.sold_at,
    courseName: row.course_name,
    firstName: row.first_name,
    lastName: row.last_name,
    amount: Number(row.amount),
    currency: row.currency || 'USD',
    presentmentAmount: row.presentment_amount != null ? Number(row.presentment_amount) : null,
    presentmentCurrency: row.presentment_currency ?? null,
    refunded: Boolean(row.refunded),
  }));
}
