import { sql } from '../db/client';
import type {
  CourseGeoPrice,
  CourseGeoPriceInput,
  CoursePricingSummary,
} from '../../shared/types';
import {
  discountedPriceForInput,
  effectiveAmount,
} from '../services/courseGeoPriceValidation';

interface DbRow {
  id: number;
  course_id: number;
  course_name?: string;
  zenler_course_id?: string;
  course_slug?: string | null;
  name: string;
  currency: string;
  amount: string;
  compare_at_amount: string | null;
  discount_percent: string | null;
  discounted_price: string | null;
  is_default: boolean;
  is_active: boolean;
  stripe_price_id: string | null;
  valid_from: Date | null;
  valid_until: Date | null;
  priority: number;
  duration_months: number;
  created_at: Date;
  updated_at: Date;
}

interface SummaryDbRow {
  course_id: number;
  course_title: string;
  zenler_course_id: string;
  course_slug: string | null;
  status: string | null;
  is_active: boolean;
  default_price_id: number | null;
  default_price_name: string | null;
  default_amount: string | null;
  default_currency: string | null;
  default_compare_at_amount: string | null;
  default_discount_percent: string | null;
  default_discounted_price: string | null;
  default_duration_months: number | null;
  active_price_count: string;
  has_active_default: boolean;
  updated_at: Date | null;
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function rowToCourseGeoPrice(row: DbRow): CourseGeoPrice {
  const amount = Number(row.amount);
  const discountedPrice = row.discounted_price != null ? Number(row.discounted_price) : null;
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    zenlerCourseId: row.zenler_course_id,
    courseSlug: row.course_slug,
    name: row.name,
    currency: row.currency,
    amount,
    compareAtAmount: row.compare_at_amount != null ? Number(row.compare_at_amount) : null,
    discountPercent: row.discount_percent != null ? Number(row.discount_percent) : null,
    discountedPrice,
    effectiveAmount: effectiveAmount(amount, discountedPrice),
    isDefault: row.is_default,
    isActive: row.is_active,
    stripePriceId: row.stripe_price_id,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    priority: row.priority,
    durationMonths: row.duration_months,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCoursePricingSummaries(search?: string): Promise<CoursePricingSummary[]> {
  const q = String(search ?? '').trim();
  const like = q ? `%${q}%` : null;

  const rows = like
    ? await sql`
        SELECT
          c.id AS course_id,
          c.name AS course_title,
          c.zenler_course_id,
          c.slug AS course_slug,
          c.status,
          c.is_active,
          dp.id AS default_price_id,
          dp.name AS default_price_name,
          dp.amount AS default_amount,
          dp.currency AS default_currency,
          dp.compare_at_amount AS default_compare_at_amount,
          dp.discount_percent AS default_discount_percent,
          dp.discounted_price AS default_discounted_price,
          dp.duration_months AS default_duration_months,
          COALESCE(stats.active_price_count, 0) AS active_price_count,
          (dp.id IS NOT NULL) AS has_active_default,
          COALESCE(stats.updated_at, c.updated_at) AS updated_at
        FROM courses c
        LEFT JOIN LATERAL (
          SELECT id, name, amount, currency, compare_at_amount, discount_percent, discounted_price, duration_months
          FROM course_geo_prices
          WHERE course_id = c.id AND is_default = true AND is_active = true
          ORDER BY priority DESC, id ASC
          LIMIT 1
        ) dp ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE is_active = true) AS active_price_count,
            MAX(updated_at) AS updated_at
          FROM course_geo_prices
          WHERE course_id = c.id
        ) stats ON true
        WHERE c.name ILIKE ${like}
           OR c.zenler_course_id ILIKE ${like}
           OR COALESCE(c.slug, '') ILIKE ${like}
        ORDER BY c.sort_order ASC, c.name ASC
      `
    : await sql`
        SELECT
          c.id AS course_id,
          c.name AS course_title,
          c.zenler_course_id,
          c.slug AS course_slug,
          c.status,
          c.is_active,
          dp.id AS default_price_id,
          dp.name AS default_price_name,
          dp.amount AS default_amount,
          dp.currency AS default_currency,
          dp.compare_at_amount AS default_compare_at_amount,
          dp.discount_percent AS default_discount_percent,
          dp.discounted_price AS default_discounted_price,
          dp.duration_months AS default_duration_months,
          COALESCE(stats.active_price_count, 0) AS active_price_count,
          (dp.id IS NOT NULL) AS has_active_default,
          COALESCE(stats.updated_at, c.updated_at) AS updated_at
        FROM courses c
        LEFT JOIN LATERAL (
          SELECT id, name, amount, currency, compare_at_amount, discount_percent, discounted_price, duration_months
          FROM course_geo_prices
          WHERE course_id = c.id AND is_default = true AND is_active = true
          ORDER BY priority DESC, id ASC
          LIMIT 1
        ) dp ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE is_active = true) AS active_price_count,
            MAX(updated_at) AS updated_at
          FROM course_geo_prices
          WHERE course_id = c.id
        ) stats ON true
        ORDER BY c.sort_order ASC, c.name ASC
      `;

  return (rows as SummaryDbRow[]).map(row => {
    const amount = row.default_amount != null ? Number(row.default_amount) : 0;
    const discountedPrice = row.default_discounted_price != null
      ? Number(row.default_discounted_price)
      : null;
    return {
      courseId: row.course_id,
      courseTitle: row.course_title,
      zenlerCourseId: row.zenler_course_id,
      courseSlug: row.course_slug,
      status: row.status,
      isActive: row.is_active,
      defaultPrice: row.default_price_id != null
        ? {
            id: row.default_price_id,
            name: row.default_price_name ?? '',
            amount,
            currency: row.default_currency ?? 'USD',
            compareAtAmount: row.default_compare_at_amount != null
              ? Number(row.default_compare_at_amount)
              : null,
            discountPercent: row.default_discount_percent != null
              ? Number(row.default_discount_percent)
              : null,
            discountedPrice,
            effectiveAmount: effectiveAmount(amount, discountedPrice),
            durationMonths: row.default_duration_months ?? 6,
          }
        : null,
      activePriceCount: Number(row.active_price_count),
      hasActiveDefault: row.has_active_default,
      updatedAt: row.updated_at,
    };
  });
}

export async function listGeoPricesForCourse(courseId: number): Promise<CourseGeoPrice[]> {
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.course_id = ${courseId}
    ORDER BY p.is_default DESC, p.priority DESC, p.name ASC, p.id ASC
  `;
  return (rows as DbRow[]).map(rowToCourseGeoPrice);
}

export async function listActiveGeoPricesForCourse(courseId: number): Promise<CourseGeoPrice[]> {
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.course_id = ${courseId}
      AND p.is_active = true
      AND (p.valid_from IS NULL OR p.valid_from <= NOW())
      AND (p.valid_until IS NULL OR p.valid_until >= NOW())
    ORDER BY p.priority DESC, p.id ASC
  `;
  return (rows as DbRow[]).map(rowToCourseGeoPrice);
}

export async function getGeoPriceById(id: number): Promise<CourseGeoPrice | null> {
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.id = ${id}
    LIMIT 1
  `;
  return rows[0] ? rowToCourseGeoPrice(rows[0] as DbRow) : null;
}

export async function findGeoPriceByUpsertKey(data: {
  courseId: number;
  name: string;
  durationMonths: number;
}): Promise<CourseGeoPrice | null> {
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.course_id = ${data.courseId}
      AND LOWER(p.name) = ${data.name.toLowerCase()}
      AND p.duration_months = ${data.durationMonths}
    LIMIT 1
  `;
  return rows[0] ? rowToCourseGeoPrice(rows[0] as DbRow) : null;
}

async function clearOtherActiveDefaults(courseId: number, keepId?: number): Promise<void> {
  if (keepId != null) {
    await sql`
      UPDATE course_geo_prices
      SET is_default = false, updated_at = NOW()
      WHERE course_id = ${courseId}
        AND is_active = true
        AND is_default = true
        AND id <> ${keepId}
    `;
  } else {
    await sql`
      UPDATE course_geo_prices
      SET is_default = false, updated_at = NOW()
      WHERE course_id = ${courseId}
        AND is_active = true
        AND is_default = true
    `;
  }
}

export async function createGeoPrice(input: CourseGeoPriceInput): Promise<CourseGeoPrice> {
  const isDefault = Boolean(input.isDefault);
  const isActive = input.isActive !== false;
  const discountedPrice = discountedPriceForInput(input);

  if (isDefault && isActive) {
    await clearOtherActiveDefaults(input.courseId);
  }

  const rows = await sql`
    INSERT INTO course_geo_prices (
      course_id, name, currency, amount, compare_at_amount,
      discount_percent, discounted_price,
      is_default, is_active, stripe_price_id, valid_from, valid_until, priority, duration_months
    ) VALUES (
      ${input.courseId},
      ${input.name.trim()},
      'USD',
      ${input.amount},
      ${input.compareAtAmount ?? null},
      ${input.discountPercent ?? null},
      ${discountedPrice},
      ${isDefault},
      ${isActive},
      ${input.stripePriceId?.trim() || null},
      ${toDateOrNull(input.validFrom)},
      ${toDateOrNull(input.validUntil)},
      ${Number.isFinite(input.priority) ? Number(input.priority) : 0},
      ${input.durationMonths ?? 6}
    )
    RETURNING *
  `;

  const created = rowToCourseGeoPrice(rows[0] as DbRow);
  const full = await getGeoPriceById(created.id);
  return full ?? created;
}

export async function updateGeoPrice(id: number, input: Partial<CourseGeoPriceInput>): Promise<CourseGeoPrice | null> {
  const existing = await getGeoPriceById(id);
  if (!existing) return null;

  const nextInput: CourseGeoPriceInput = {
    courseId: existing.courseId,
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    currency: 'USD',
    amount: input.amount !== undefined ? Number(input.amount) : existing.amount,
    compareAtAmount: input.compareAtAmount !== undefined ? input.compareAtAmount : existing.compareAtAmount,
    discountPercent: input.discountPercent !== undefined ? input.discountPercent : existing.discountPercent,
    isDefault: input.isDefault !== undefined ? Boolean(input.isDefault) : existing.isDefault,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive,
    stripePriceId: input.stripePriceId !== undefined
      ? (input.stripePriceId?.trim() || null)
      : existing.stripePriceId,
    validFrom: input.validFrom !== undefined ? input.validFrom : existing.validFrom,
    validUntil: input.validUntil !== undefined ? input.validUntil : existing.validUntil,
    priority: input.priority !== undefined
      ? (Number.isFinite(input.priority) ? Number(input.priority) : 0)
      : existing.priority,
    durationMonths: input.durationMonths !== undefined
      ? Number(input.durationMonths)
      : existing.durationMonths,
  };

  const discountedPrice = discountedPriceForInput(nextInput);

  if (nextInput.isDefault && nextInput.isActive) {
    await clearOtherActiveDefaults(existing.courseId, id);
  }

  const rows = await sql`
    UPDATE course_geo_prices
    SET name = ${nextInput.name},
        currency = 'USD',
        amount = ${nextInput.amount},
        compare_at_amount = ${nextInput.compareAtAmount},
        discount_percent = ${nextInput.discountPercent ?? null},
        discounted_price = ${discountedPrice},
        is_default = ${nextInput.isDefault},
        is_active = ${nextInput.isActive},
        stripe_price_id = ${nextInput.stripePriceId},
        valid_from = ${toDateOrNull(nextInput.validFrom)},
        valid_until = ${toDateOrNull(nextInput.validUntil)},
        priority = ${nextInput.priority},
        duration_months = ${nextInput.durationMonths},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  return rows[0] ? (await getGeoPriceById(id)) : null;
}

export async function deactivateGeoPrice(id: number): Promise<CourseGeoPrice | null> {
  return updateGeoPrice(id, { isActive: false, isDefault: false });
}

export async function setDefaultGeoPrice(courseId: number, priceId: number): Promise<CourseGeoPrice | null> {
  const price = await getGeoPriceById(priceId);
  if (!price || price.courseId !== courseId) return null;
  return updateGeoPrice(priceId, { isDefault: true, isActive: true });
}

export async function upsertGeoPriceByKey(input: CourseGeoPriceInput): Promise<{ price: CourseGeoPrice; created: boolean }> {
  const existing = await findGeoPriceByUpsertKey({
    courseId: input.courseId,
    name: input.name,
    durationMonths: input.durationMonths ?? 6,
  });

  if (existing) {
    const price = await updateGeoPrice(existing.id, input);
    if (!price) throw new Error('Failed to update geo price');
    return { price, created: false };
  }

  const price = await createGeoPrice(input);
  return { price, created: true };
}

export async function getCourseById(id: number): Promise<{ id: number; name: string; zenlerCourseId: string; slug: string | null; isActive: boolean } | null> {
  const rows = await sql`
    SELECT id, name, zenler_course_id, slug, is_active
    FROM courses
    WHERE id = ${id}
    LIMIT 1
  `;
  const row = rows[0] as {
    id: number;
    name: string;
    zenler_course_id: string;
    slug: string | null;
    is_active: boolean;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    zenlerCourseId: row.zenler_course_id,
    slug: row.slug,
    isActive: row.is_active,
  };
}

export async function getCourseBySlug(slug: string): Promise<{ id: number; name: string; zenlerCourseId: string; slug: string | null; isActive: boolean } | null> {
  const rows = await sql`
    SELECT id, name, zenler_course_id, slug, is_active
    FROM courses
    WHERE LOWER(slug) = ${slug.toLowerCase()}
    LIMIT 1
  `;
  const row = rows[0] as {
    id: number;
    name: string;
    zenler_course_id: string;
    slug: string | null;
    is_active: boolean;
  } | undefined;
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    zenlerCourseId: row.zenler_course_id,
    slug: row.slug,
    isActive: row.is_active,
  };
}

export async function listActiveCoursesMissingDefaultPrice(): Promise<Array<{ id: number; name: string; zenlerCourseId: string }>> {
  const rows = await sql`
    SELECT c.id, c.name, c.zenler_course_id
    FROM courses c
    WHERE c.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM course_geo_prices p
        WHERE p.course_id = c.id
          AND p.is_default = true
          AND p.is_active = true
      )
    ORDER BY c.name ASC
  `;
  return (rows as Array<{ id: number; name: string; zenler_course_id: string }>).map(row => ({
    id: row.id,
    name: row.name,
    zenlerCourseId: row.zenler_course_id,
  }));
}