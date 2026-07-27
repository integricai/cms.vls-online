import { sql } from '../db/client';
import type {
  CourseGeoPrice,
  CourseGeoPriceInput,
  CoursePricingMode,
  CoursePricingSummary,
} from '../../shared/types';
import {
  deriveLegacyDurationMonths,
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
  zenler_pricing_code: string | null;
  evendeals: string | null;
  pricing_mode: CoursePricingMode;
  exam_session_month: number | null;
  exam_session_year: number | null;
  duration_days: number | null;
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
    zenlerPricingCode: row.zenler_pricing_code,
    evenDeals: row.evendeals ?? null,
    pricingMode: row.pricing_mode,
    examSessionMonth: row.exam_session_month,
    examSessionYear: row.exam_session_year,
    durationDays: row.duration_days,
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
          ORDER BY id ASC
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
          ORDER BY id ASC
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
    ORDER BY p.is_default DESC, p.name ASC, p.id ASC
  `;
  return (rows as DbRow[]).map(rowToCourseGeoPrice);
}

/** All geo prices (including inactive) for CSV export, ordered for stable round-trip edits. */
export async function listAllGeoPricesForExport(): Promise<CourseGeoPrice[]> {
  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    ORDER BY c.name ASC, c.id ASC, p.is_default DESC, p.name ASC, p.id ASC
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
    ORDER BY p.id ASC
  `;
  return (rows as DbRow[]).map(rowToCourseGeoPrice);
}

export async function listActiveGeoPricesByZenlerCourseId(
  zenlerCourseId: string,
): Promise<{
  courseId: number;
  courseName: string;
  zenlerCourseId: string;
  courseSlug: string | null;
  prices: CourseGeoPrice[];
} | null> {
  const rows = await sql`
    SELECT
      p.*,
      c.id AS course_id,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM courses c
    JOIN course_geo_prices p ON p.course_id = c.id AND p.is_active = true
    WHERE c.zenler_course_id = ${zenlerCourseId.trim()}
    ORDER BY p.id ASC
  `;

  if (!rows.length) return null;

  const first = rows[0] as DbRow & { course_id: number };
  return {
    courseId: first.course_id,
    courseName: first.course_name ?? '',
    zenlerCourseId: first.zenler_course_id ?? zenlerCourseId,
    courseSlug: first.course_slug ?? null,
    prices: (rows as DbRow[]).map(rowToCourseGeoPrice),
  };
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

export async function findGeoPriceByZenlerPricingCode(
  courseId: number,
  pricingCode: string,
): Promise<CourseGeoPrice | null> {
  const code = pricingCode.trim();
  if (!code) return null;

  const rows = await sql`
    SELECT
      p.*,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug
    FROM course_geo_prices p
    JOIN courses c ON c.id = p.course_id
    WHERE p.course_id = ${courseId}
      AND p.zenler_pricing_code = ${code}
    ORDER BY p.id ASC
    LIMIT 1
  `;
  return rows[0] ? rowToCourseGeoPrice(rows[0] as DbRow) : null;
}

export async function findGeoPriceByPricingSlot(data: {
  courseId: number;
  pricingMode: CoursePricingMode;
  durationDays?: number | null;
  examSessionMonth?: number | null;
  examSessionYear?: number | null;
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
      AND p.pricing_mode = ${data.pricingMode}
      AND COALESCE(p.duration_days, 0) = ${data.durationDays ?? 0}
      AND COALESCE(p.exam_session_month, 0) = ${data.examSessionMonth ?? 0}
      AND COALESCE(p.exam_session_year, 0) = ${data.examSessionYear ?? 0}
    ORDER BY p.id ASC
    LIMIT 1
  `;
  return rows[0] ? rowToCourseGeoPrice(rows[0] as DbRow) : null;
}

export async function findGeoPriceByUpsertKey(data: {
  courseId: number;
  pricingCode?: string | null;
  name?: string;
  pricingMode: CoursePricingMode;
  durationDays?: number | null;
  examSessionMonth?: number | null;
  examSessionYear?: number | null;
}): Promise<CourseGeoPrice | null> {
  if (data.pricingCode?.trim()) {
    const byCode = await findGeoPriceByZenlerPricingCode(data.courseId, data.pricingCode);
    if (byCode) return byCode;
  }

  const bySlot = await findGeoPriceByPricingSlot({
    courseId: data.courseId,
    pricingMode: data.pricingMode,
    durationDays: data.durationDays,
    examSessionMonth: data.examSessionMonth,
    examSessionYear: data.examSessionYear,
  });
  if (bySlot) return bySlot;

  if (data.name?.trim()) {
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
        AND p.pricing_mode = ${data.pricingMode}
        AND COALESCE(p.duration_days, 0) = ${data.durationDays ?? 0}
        AND COALESCE(p.exam_session_month, 0) = ${data.examSessionMonth ?? 0}
        AND COALESCE(p.exam_session_year, 0) = ${data.examSessionYear ?? 0}
      ORDER BY p.id ASC
      LIMIT 1
    `;
    return rows[0] ? rowToCourseGeoPrice(rows[0] as DbRow) : null;
  }

  return null;
}

export async function deactivateDuplicateSlotPrices(
  courseId: number,
  keepId: number,
  slot: {
    pricingMode: CoursePricingMode;
    durationDays?: number | null;
    examSessionMonth?: number | null;
    examSessionYear?: number | null;
  },
): Promise<number> {
  const rows = await sql`
    UPDATE course_geo_prices
    SET is_active = false,
        is_default = false,
        updated_at = NOW()
    WHERE course_id = ${courseId}
      AND id <> ${keepId}
      AND is_active = true
      AND pricing_mode = ${slot.pricingMode}
      AND COALESCE(duration_days, 0) = ${slot.durationDays ?? 0}
      AND COALESCE(exam_session_month, 0) = ${slot.examSessionMonth ?? 0}
      AND COALESCE(exam_session_year, 0) = ${slot.examSessionYear ?? 0}
    RETURNING id
  `;
  return rows.length;
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
  const pricingMode = input.pricingMode ?? 'duration';
  const durationMonths = deriveLegacyDurationMonths(pricingMode, input.durationDays);

  if (isDefault && isActive) {
    await clearOtherActiveDefaults(input.courseId);
  }

  const rows = await sql`
    INSERT INTO course_geo_prices (
      course_id, name, currency, amount, compare_at_amount,
      discount_percent, discounted_price,
      is_default, is_active, stripe_price_id, zenler_pricing_code, evendeals,
      pricing_mode, exam_session_month, exam_session_year, duration_days, duration_months
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
      ${input.zenlerPricingCode?.trim() || null},
      ${input.evenDeals?.trim() || null},
      ${pricingMode},
      ${pricingMode === 'session' ? (input.examSessionMonth ?? null) : null},
      ${pricingMode === 'session' ? (input.examSessionYear ?? null) : null},
      ${pricingMode === 'duration' ? (input.durationDays ?? null) : null},
      ${durationMonths}
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

  const pricingMode = input.pricingMode !== undefined ? input.pricingMode : existing.pricingMode;
  const examSessionMonth = input.examSessionMonth !== undefined ? input.examSessionMonth : existing.examSessionMonth;
  const examSessionYear = input.examSessionYear !== undefined ? input.examSessionYear : existing.examSessionYear;
  const durationDays = input.durationDays !== undefined ? input.durationDays : existing.durationDays;

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
    zenlerPricingCode: input.zenlerPricingCode !== undefined
      ? (input.zenlerPricingCode?.trim() || null)
      : existing.zenlerPricingCode,
    evenDeals: input.evenDeals !== undefined
      ? (input.evenDeals?.trim() || null)
      : existing.evenDeals,
    pricingMode,
    examSessionMonth: pricingMode === 'session' ? (examSessionMonth ?? null) : null,
    examSessionYear: pricingMode === 'session' ? (examSessionYear ?? null) : null,
    durationDays: pricingMode === 'duration' ? (durationDays ?? null) : null,
  };

  const discountedPrice = discountedPriceForInput(nextInput);
  const durationMonths = deriveLegacyDurationMonths(pricingMode, nextInput.durationDays);

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
        zenler_pricing_code = ${nextInput.zenlerPricingCode},
        evendeals = ${nextInput.evenDeals ?? null},
        pricing_mode = ${nextInput.pricingMode},
        exam_session_month = ${nextInput.examSessionMonth},
        exam_session_year = ${nextInput.examSessionYear},
        duration_days = ${nextInput.durationDays},
        duration_months = ${durationMonths},
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

export async function upsertGeoPriceByKey(input: CourseGeoPriceInput): Promise<{ price: CourseGeoPrice; created: boolean; deactivated: number }> {
  const existing = await findGeoPriceByUpsertKey({
    courseId: input.courseId,
    pricingCode: input.zenlerPricingCode,
    name: input.name,
    pricingMode: input.pricingMode ?? 'duration',
    durationDays: input.durationDays,
    examSessionMonth: input.examSessionMonth,
    examSessionYear: input.examSessionYear,
  });

  if (existing) {
    const price = await updateGeoPrice(existing.id, input);
    if (!price) throw new Error('Failed to update geo price');
    const deactivated = await deactivateDuplicateSlotPrices(input.courseId, price.id, {
      pricingMode: price.pricingMode,
      durationDays: price.durationDays,
      examSessionMonth: price.examSessionMonth,
      examSessionYear: price.examSessionYear,
    });
    return { price, created: false, deactivated };
  }

  const price = await createGeoPrice(input);
  const deactivated = await deactivateDuplicateSlotPrices(input.courseId, price.id, {
    pricingMode: price.pricingMode,
    durationDays: price.durationDays,
    examSessionMonth: price.examSessionMonth,
    examSessionYear: price.examSessionYear,
  });
  return { price, created: true, deactivated };
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