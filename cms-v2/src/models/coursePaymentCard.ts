import { sql } from '../db/client';
import type { CoursePaymentCard } from '../../shared/types';

interface DbRow {
  id: number;
  course_id: number;
  course_name?: string;
  title: string;
  description: string;
  normal_price: string;
  discount_price: string | null;
  currency: string;
  cta_button_text: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

function rowToCard(row: DbRow): CoursePaymentCard {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    title: row.title,
    description: row.description,
    normalPrice: Number(row.normal_price),
    discountPrice: row.discount_price != null ? Number(row.discount_price) : null,
    currency: row.currency,
    ctaButtonText: row.cta_button_text,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listPaymentCards(): Promise<CoursePaymentCard[]> {
  const rows = await sql`
    SELECT cpc.*, c.name AS course_name
    FROM course_payment_cards cpc
    LEFT JOIN courses c ON c.id = cpc.course_id
    ORDER BY cpc.created_at DESC
  `;
  return (rows as DbRow[]).map(rowToCard);
}

export async function getPaymentCard(id: number): Promise<CoursePaymentCard | null> {
  const rows = await sql`
    SELECT cpc.*, c.name AS course_name
    FROM course_payment_cards cpc
    LEFT JOIN courses c ON c.id = cpc.course_id
    WHERE cpc.id = ${id}
  `;
  return rows[0] ? rowToCard(rows[0] as DbRow) : null;
}

export async function createPaymentCard(data: {
  courseId: number;
  title: string;
  description: string;
  normalPrice: number;
  discountPrice: number | null;
  currency: string;
  ctaButtonText: string;
  isActive: boolean;
}): Promise<CoursePaymentCard> {
  const rows = await sql`
    INSERT INTO course_payment_cards
      (course_id, title, description, normal_price, discount_price, currency, cta_button_text, is_active)
    VALUES
      (${data.courseId}, ${data.title}, ${data.description}, ${data.normalPrice},
       ${data.discountPrice}, ${data.currency}, ${data.ctaButtonText}, ${data.isActive})
    RETURNING id
  `;
  return (await getPaymentCard((rows[0] as { id: number }).id))!;
}

export async function updatePaymentCard(
  id: number,
  data: {
    courseId?: number;
    title?: string;
    description?: string;
    normalPrice?: number;
    discountPrice?: number | null;
    currency?: string;
    ctaButtonText?: string;
    isActive?: boolean;
  },
): Promise<CoursePaymentCard | null> {
  const existing = await getPaymentCard(id);
  if (!existing) return null;

  await sql`
    UPDATE course_payment_cards
    SET
      course_id       = ${data.courseId       ?? existing.courseId},
      title           = ${data.title          ?? existing.title},
      description     = ${data.description    ?? existing.description},
      normal_price    = ${data.normalPrice    ?? existing.normalPrice},
      discount_price  = ${data.discountPrice  !== undefined ? data.discountPrice  : existing.discountPrice},
      currency        = ${data.currency       ?? existing.currency},
      cta_button_text = ${data.ctaButtonText  ?? existing.ctaButtonText},
      is_active       = ${data.isActive       !== undefined ? data.isActive       : existing.isActive},
      updated_at      = NOW()
    WHERE id = ${id}
  `;
  return getPaymentCard(id);
}

export async function deletePaymentCard(id: number): Promise<boolean> {
  const rows = await sql`DELETE FROM course_payment_cards WHERE id = ${id} RETURNING id`;
  return rows.length > 0;
}
