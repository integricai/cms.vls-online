import { sql } from '../db/client';

export interface Sale {
  id: number;
  customerId: number;
  courseId: number;
  coursePriceId: number | null;
  paymentOrderId: number;
  amount: number;
  currency: string;
  discountPercent: number | null;
  durationDays: number;
  soldAt: Date;
  expiryDate: Date;
  createdAt: Date;
}

interface DbRow {
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
  created_at: Date;
}

function rowToSale(row: DbRow): Sale {
  return {
    id: row.id,
    customerId: row.customer_id,
    courseId: row.course_id,
    coursePriceId: row.course_price_id,
    paymentOrderId: row.payment_order_id,
    amount: Number(row.amount),
    currency: row.currency,
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : null,
    durationDays: row.duration_days,
    soldAt: row.sold_at,
    expiryDate: row.expiry_date,
    createdAt: row.created_at,
  };
}

export function computeExpiryDate(soldAt: Date, durationDays: number): Date {
  const expiry = new Date(soldAt);
  expiry.setUTCDate(expiry.getUTCDate() + durationDays);
  return expiry;
}

export async function getSaleByPaymentOrderId(paymentOrderId: number): Promise<Sale | null> {
  const rows = await sql`SELECT * FROM sales WHERE payment_order_id = ${paymentOrderId}`;
  return rows[0] ? rowToSale(rows[0] as DbRow) : null;
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
      amount, currency, discount_percent, duration_days, sold_at, expiry_date
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
      ${expiryDate}
    )
    RETURNING *
  `;
  return rowToSale(rows[0] as DbRow);
}
