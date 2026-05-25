import { sql } from '../db/client';
import type { CoursePaymentCard } from '../../shared/types';

interface DbRow {
  id: number;
  course_id: number;
  course_name?: string;
  zenler_course_id?: string;
  course_slug?: string | null;
  title: string;
  description: string;
  option_type: string | null;
  normal_price: string;
  discount_price: string | null;
  is_discount_active: boolean;
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
    zenlerCourseId: row.zenler_course_id,
    courseSlug: row.course_slug,
    title: row.title,
    description: row.description,
    optionType: row.option_type,
    normalPrice: Number(row.normal_price),
    discountPrice: row.discount_price != null ? Number(row.discount_price) : null,
    isDiscountActive: row.is_discount_active,
    finalDisplayPrice: row.is_discount_active && row.discount_price != null
      ? Number(row.discount_price)
      : Number(row.normal_price),
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
      , c.zenler_course_id, c.slug AS course_slug
    FROM course_payment_cards cpc
    LEFT JOIN courses c ON c.id = cpc.course_id
    ORDER BY cpc.created_at DESC
  `;
  return (rows as DbRow[]).map(rowToCard);
}

export async function getPaymentCard(id: number): Promise<CoursePaymentCard | null> {
  const rows = await sql`
    SELECT cpc.*, c.name AS course_name
      , c.zenler_course_id, c.slug AS course_slug
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
  optionType: string | null;
  normalPrice: number;
  discountPrice: number | null;
  isDiscountActive: boolean;
  currency: string;
  ctaButtonText: string;
  isActive: boolean;
}): Promise<CoursePaymentCard> {
  const rows = await sql`
    INSERT INTO course_payment_cards
      (course_id, title, description, option_type, normal_price, discount_price, is_discount_active, currency, cta_button_text, is_active)
    VALUES
      (${data.courseId}, ${data.title}, ${data.description}, ${data.optionType}, ${data.normalPrice},
       ${data.discountPrice}, ${data.isDiscountActive}, ${data.currency}, ${data.ctaButtonText}, ${data.isActive})
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
    optionType?: string | null;
    normalPrice?: number;
    discountPrice?: number | null;
    isDiscountActive?: boolean;
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
      option_type     = ${data.optionType     !== undefined ? data.optionType : existing.optionType},
      normal_price    = ${data.normalPrice    ?? existing.normalPrice},
      discount_price  = ${data.discountPrice  !== undefined ? data.discountPrice  : existing.discountPrice},
      is_discount_active = ${data.isDiscountActive !== undefined ? data.isDiscountActive : existing.isDiscountActive},
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

export async function getPaymentCardByZenlerCourseId(zenlerCourseId: string): Promise<CoursePaymentCard[]> {
  const rows = await sql`
    SELECT cpc.*, c.name AS course_name, c.zenler_course_id, c.slug AS course_slug
    FROM course_payment_cards cpc
    INNER JOIN courses c ON c.id = cpc.course_id
    WHERE c.zenler_course_id = ${zenlerCourseId}
      AND cpc.is_active = true
    ORDER BY cpc.created_at DESC
  `;
  return (rows as DbRow[]).map(rowToCard);
}

export async function listActivePaymentCardsBySlug(slug: string): Promise<CoursePaymentCard[]> {
  const rows = await sql`
    SELECT cpc.*, c.name AS course_name, c.zenler_course_id, c.slug AS course_slug
    FROM course_payment_cards cpc
    INNER JOIN courses c ON c.id = cpc.course_id
    WHERE c.slug = ${slug}
      AND cpc.is_active = true
    ORDER BY cpc.created_at DESC
  `;
  return (rows as DbRow[]).map(rowToCard);
}
