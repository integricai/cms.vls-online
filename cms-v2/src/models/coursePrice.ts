import { sql } from '../db/client';
import type { CoursePriceRecord, ScrapedCoursePrice } from '../../shared/types';

let schemaReady: Promise<void> | null = null;

interface DbRow {
  id: number;
  course_id: number;
  course_name?: string;
  zenler_course_id?: string;
  course_slug?: string | null;
  is_enabled: boolean;
  regular_price: string;
  regular_price_2: string;
  currency: string;
  discount_percent: string;
  discount_percent_2: string;
  final_price: string;
  final_price_2: string;
  source_url: string | null;
  raw_price_text: string | null;
  last_scraped_price: string | null;
  last_scraped_price_2: string | null;
  last_scraped_at: Date | null;
  last_scrape_status: string;
  last_scrape_error: string | null;
  created_at: Date;
  updated_at: Date;
}

function finalPrice(regularPrice: number, discountPercent: number): number {
  const regular = Math.max(0, Number(regularPrice) || 0);
  const discount = Math.max(0, Math.min(100, Number(discountPercent) || 0));
  return Math.round((regular - regular * (discount / 100)) * 100) / 100;
}

async function ensureCoursePriceSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`ALTER TABLE course_prices ALTER COLUMN currency SET DEFAULT 'USD'`;
    await sql`ALTER TABLE course_prices ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`ALTER TABLE course_prices ADD COLUMN IF NOT EXISTS regular_price_2 NUMERIC(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE course_prices ADD COLUMN IF NOT EXISTS discount_percent_2 NUMERIC(5,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE course_prices ADD COLUMN IF NOT EXISTS final_price_2 NUMERIC(10,2) NOT NULL DEFAULT 0`;
    await sql`ALTER TABLE course_prices ADD COLUMN IF NOT EXISTS last_scraped_price_2 NUMERIC(10,2)`;
    await sql`UPDATE course_prices SET currency = 'USD' WHERE currency IS NULL OR currency = 'GBP'`;
  })();
  return schemaReady;
}

function rowToCoursePrice(row: DbRow): CoursePriceRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    zenlerCourseId: row.zenler_course_id,
    courseSlug: row.course_slug,
    isEnabled: row.is_enabled,
    regularPrice: Number(row.regular_price),
    regularPrice2: Number(row.regular_price_2),
    currency: row.currency,
    discountPercent: Number(row.discount_percent),
    discountPercent2: Number(row.discount_percent_2),
    finalPrice: Number(row.final_price),
    finalPrice2: Number(row.final_price_2),
    sourceUrl: row.source_url,
    rawPriceText: row.raw_price_text,
    lastScrapedPrice: row.last_scraped_price != null ? Number(row.last_scraped_price) : null,
    lastScrapedPrice2: row.last_scraped_price_2 != null ? Number(row.last_scraped_price_2) : null,
    lastScrapedAt: row.last_scraped_at,
    lastScrapeStatus: row.last_scrape_status,
    lastScrapeError: row.last_scrape_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCoursePrices(): Promise<CoursePriceRecord[]> {
  await ensureCoursePriceSchema();
  const rows = await sql`
    SELECT
      COALESCE(cp.id, 0) AS id,
      c.id AS course_id,
      c.name AS course_name,
      c.zenler_course_id,
      c.slug AS course_slug,
      COALESCE(cp.is_enabled, TRUE) AS is_enabled,
      COALESCE(cp.regular_price, 0) AS regular_price,
      COALESCE(cp.regular_price_2, 0) AS regular_price_2,
      COALESCE(cp.currency, 'USD') AS currency,
      COALESCE(cp.discount_percent, 0) AS discount_percent,
      COALESCE(cp.discount_percent_2, 0) AS discount_percent_2,
      COALESCE(cp.final_price, 0) AS final_price,
      COALESCE(cp.final_price_2, 0) AS final_price_2,
      cp.source_url,
      cp.raw_price_text,
      cp.last_scraped_price,
      cp.last_scraped_price_2,
      cp.last_scraped_at,
      COALESCE(cp.last_scrape_status, 'manual') AS last_scrape_status,
      cp.last_scrape_error,
      COALESCE(cp.created_at, c.created_at) AS created_at,
      COALESCE(cp.updated_at, c.updated_at) AS updated_at
    FROM courses c
    LEFT JOIN course_prices cp ON cp.course_id = c.id
    ORDER BY c.sort_order ASC, c.name ASC
  `;
  return (rows as DbRow[]).map(rowToCoursePrice);
}

export async function upsertCoursePrices(
  prices: Array<{
    courseId: number;
    regularPrice: number;
    regularPrice2: number;
    currency: string;
    discountPercent: number;
    discountPercent2: number;
    isEnabled?: boolean;
    sourceUrl?: string | null;
    rawPriceText?: string | null;
  }>,
): Promise<CoursePriceRecord[]> {
  await ensureCoursePriceSchema();
  for (const price of prices) {
    const regularPrice = Math.max(0, Number(price.regularPrice) || 0);
    const regularPrice2 = Math.max(0, Number(price.regularPrice2) || 0);
    const discountPercent = Math.max(0, Math.min(100, Number(price.discountPercent) || 0));
    const discountPercent2 = Math.max(0, Math.min(100, Number(price.discountPercent2) || 0));
    const computedFinal = finalPrice(regularPrice, discountPercent);
    const computedFinal2 = finalPrice(regularPrice2, discountPercent2);

    await sql`
      INSERT INTO course_prices
        (course_id, is_enabled, regular_price, regular_price_2, currency, discount_percent, discount_percent_2,
         final_price, final_price_2, source_url, raw_price_text, last_scrape_status)
      VALUES
        (${price.courseId}, ${price.isEnabled ?? true}, ${regularPrice}, ${regularPrice2}, ${price.currency || 'USD'},
         ${discountPercent}, ${discountPercent2}, ${computedFinal}, ${computedFinal2},
         ${price.sourceUrl ?? null}, ${price.rawPriceText ?? null}, 'manual')
      ON CONFLICT (course_id) DO UPDATE
        SET is_enabled = CASE
              WHEN ${price.isEnabled === undefined} THEN course_prices.is_enabled
              ELSE EXCLUDED.is_enabled
            END,
            regular_price = EXCLUDED.regular_price,
            regular_price_2 = EXCLUDED.regular_price_2,
            currency = EXCLUDED.currency,
            discount_percent = EXCLUDED.discount_percent,
            discount_percent_2 = EXCLUDED.discount_percent_2,
            final_price = EXCLUDED.final_price,
            final_price_2 = EXCLUDED.final_price_2,
            source_url = COALESCE(EXCLUDED.source_url, course_prices.source_url),
            raw_price_text = COALESCE(EXCLUDED.raw_price_text, course_prices.raw_price_text),
            last_scrape_status = 'manual',
            updated_at = NOW()
    `;
  }

  return listCoursePrices();
}

export async function upsertScrapedCoursePrices(scraped: ScrapedCoursePrice[]): Promise<CoursePriceRecord[]> {
  await ensureCoursePriceSchema();
  for (const item of scraped) {
    if (item.matched && item.price != null) {
      await sql`
        INSERT INTO course_prices
          (course_id, regular_price, regular_price_2, currency, discount_percent, discount_percent_2,
           final_price, final_price_2, source_url, raw_price_text, last_scraped_price, last_scraped_price_2,
           last_scraped_at, last_scrape_status, last_scrape_error)
        VALUES
          (${item.courseId}, ${item.price}, ${item.price2 ?? 0}, ${item.currency || 'USD'}, 0, 0,
           ${item.price}, ${item.price2 ?? 0}, ${item.url}, ${item.rawPriceText}, ${item.price}, ${item.price2},
           NOW(), 'matched', NULL)
        ON CONFLICT (course_id) DO UPDATE
          SET regular_price = EXCLUDED.regular_price,
              regular_price_2 = EXCLUDED.regular_price_2,
              currency = EXCLUDED.currency,
              final_price = ROUND((EXCLUDED.regular_price * (1 - (course_prices.discount_percent / 100.0)))::numeric, 2),
              final_price_2 = ROUND((EXCLUDED.regular_price_2 * (1 - (course_prices.discount_percent_2 / 100.0)))::numeric, 2),
              source_url = EXCLUDED.source_url,
              raw_price_text = EXCLUDED.raw_price_text,
              last_scraped_price = EXCLUDED.last_scraped_price,
              last_scraped_price_2 = EXCLUDED.last_scraped_price_2,
              last_scraped_at = NOW(),
              last_scrape_status = 'matched',
              last_scrape_error = NULL,
              updated_at = NOW()
      `;
    } else {
      await sql`
        INSERT INTO course_prices
          (course_id, regular_price, currency, discount_percent, final_price, source_url, raw_price_text,
           last_scraped_at, last_scrape_status, last_scrape_error)
        VALUES
          (${item.courseId}, 0, ${item.currency || 'USD'}, 0, 0, ${item.url || null}, ${item.rawPriceText},
           NOW(), 'not_found', ${item.error ?? 'No price found'})
        ON CONFLICT (course_id) DO UPDATE
          SET source_url = COALESCE(EXCLUDED.source_url, course_prices.source_url),
              raw_price_text = EXCLUDED.raw_price_text,
              last_scraped_at = NOW(),
              last_scrape_status = 'not_found',
              last_scrape_error = EXCLUDED.last_scrape_error,
              updated_at = NOW()
      `;
    }
  }

  return listCoursePrices();
}
