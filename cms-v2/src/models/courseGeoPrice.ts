import { sql } from '../db/client';
import type {
  CourseGeoPrice,
  CourseGeoPriceInput,
  CoursePricingSummary,
} from '../../shared/types';

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
  country_code: string | null;
  region: string | null;
  geo_group: string | null;
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
  default_duration_months: number | null;
  active_price_count: string;
  countries_covered: string;
  has_active_default: boolean;
  updated_at: Date | null;
}

function toDateOrNull(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function rowToCourseGeoPrice(row: DbRow): CourseGeoPrice {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    zenlerCourseId: row.zenler_course_id,
    courseSlug: row.course_slug,
    name: row.name,
    currency: row.currency,
    amount: Number(row.amount),
    compareAtAmount: row.compare_at_amount != null ? Number(row.compare_at_amount) : null,
    countryCode: row.country_code,
    region: row.region,
    geoGroup: row.geo_group,
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
          dp.duration_months AS default_duration_months,
          COALESCE(stats.active_price_count, 0) AS active_price_count,
          COALESCE(stats.countries_covered, 0) AS countries_covered,
          (dp.id IS NOT NULL) AS has_active_default,
          COALESCE(stats.updated_at, c.updated_at) AS updated_at
        FROM courses c
        LEFT JOIN LATERAL (
          SELECT id, name, amount, currency, compare_at_amount, duration_months
          FROM course_geo_prices
          WHERE course_id = c.id AND is_default = true AND is_active = true
          ORDER BY priority DESC, id ASC
          LIMIT 1
        ) dp ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE is_active = true) AS active_price_count,
            COUNT(DISTINCT country_code) FILTER (WHERE is_active = true AND country_code IS NOT NULL) AS countries_covered,
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
          dp.duration_months AS default_duration_months,
          COALESCE(stats.active_price_count, 0) AS active_price_count,
          COALESCE(stats.countries_covered, 0) AS countries_covered,
          (dp.id IS NOT NULL) AS has_active_default,
          COALESCE(stats.updated_at, c.updated_at) AS updated_at
        FROM courses c
        LEFT JOIN LATERAL (
          SELECT id, name, amount, currency, compare_at_amount, duration_months
          FROM course_geo_prices
          WHERE course_id = c.id AND is_default = true AND is_active = true
          ORDER BY priority DESC, id ASC
          LIMIT 1
        ) dp ON true
        LEFT JOIN LATERAL (
          SELECT
            COUNT(*) FILTER (WHERE is_active = true) AS active_price_count,
            COUNT(DISTINCT country_code) FILTER (WHERE is_active = true AND country_code IS NOT NULL) AS countries_covered,
            MAX(updated_at) AS updated_at
          FROM course_geo_prices
          WHERE course_id = c.id
        ) stats ON true
        ORDER BY c.sort_order ASC, c.name ASC
      `;

  return (rows as SummaryDbRow[]).map(row => ({
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
          amount: Number(row.default_amount),
          currency: row.default_currency ?? 'USD',
          compareAtAmount: row.default_compare_at_amount != null
            ? Number(row.default_compare_at_amount)
            : null,
          durationMonths: row.default_duration_months ?? 6,
        }
      : null,
    activePriceCount: Number(row.active_price_count),
    countriesCovered: Number(row.countries_covered),
    hasActiveDefault: row.has_active_default,
    updatedAt: row.updated_at,
  }));
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
  countryCode: string | null;
  currency: string;
  name: string;
  durationMonths: number;
}): Promise<CourseGeoPrice | null> {
  const country = data.countryCode ?? '';
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.course_id = ${data.courseId}
      AND COALESCE(p.country_code, '') = ${country}
      AND UPPER(p.currency) = ${data.currency.toUpperCase()}
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

  if (isDefault && isActive) {
    await clearOtherActiveDefaults(input.courseId);
  }

  const rows = await sql`
    INSERT INTO course_geo_prices (
      course_id, name, currency, amount, compare_at_amount, country_code, region, geo_group,
      is_default, is_active, stripe_price_id, valid_from, valid_until, priority, duration_months
    ) VALUES (
      ${input.courseId},
      ${input.name.trim()},
      ${input.currency.toUpperCase()},
      ${input.amount},
      ${input.compareAtAmount ?? null},
      ${input.countryCode ?? null},
      ${input.region?.trim() || null},
      ${input.geoGroup?.trim() || null},
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

  const next = {
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    currency: input.currency !== undefined ? String(input.currency).toUpperCase() : existing.currency,
    amount: input.amount !== undefined ? Number(input.amount) : existing.amount,
    compareAtAmount: input.compareAtAmount !== undefined ? input.compareAtAmount : existing.compareAtAmount,
    countryCode: input.countryCode !== undefined ? input.countryCode : existing.countryCode,
    region: input.region !== undefined ? (input.region?.trim() || null) : existing.region,
    geoGroup: input.geoGroup !== undefined ? (input.geoGroup?.trim() || null) : existing.geoGroup,
    isDefault: input.isDefault !== undefined ? Boolean(input.isDefault) : existing.isDefault,
    isActive: input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive,
    stripePriceId: input.stripePriceId !== undefined
      ? (input.stripePriceId?.trim() || null)
      : existing.stripePriceId,
    validFrom: input.validFrom !== undefined ? toDateOrNull(input.validFrom) : toDateOrNull(existing.validFrom),
    validUntil: input.validUntil !== undefined ? toDateOrNull(input.validUntil) : toDateOrNull(existing.validUntil),
    priority: input.priority !== undefined
      ? (Number.isFinite(input.priority) ? Number(input.priority) : 0)
      : existing.priority,
    durationMonths: input.durationMonths !== undefined
      ? Number(input.durationMonths)
      : existing.durationMonths,
  };

  if (next.isDefault && next.isActive) {
    await clearOtherActiveDefaults(existing.courseId, id);
  }

  const rows = await sql`
    UPDATE course_geo_prices
    SET name = ${next.name},
        currency = ${next.currency},
        amount = ${next.amount},
        compare_at_amount = ${next.compareAtAmount},
        country_code = ${next.countryCode},
        region = ${next.region},
        geo_group = ${next.geoGroup},
        is_default = ${next.isDefault},
        is_active = ${next.isActive},
        stripe_price_id = ${next.stripePriceId},
        valid_from = ${next.validFrom},
        valid_until = ${next.validUntil},
        priority = ${next.priority},
        duration_months = ${next.durationMonths},
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
    countryCode: input.countryCode ?? null,
    currency: input.currency,
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
