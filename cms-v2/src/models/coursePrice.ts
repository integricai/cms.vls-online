import { sql } from '../db/client';
import type { CoursePriceRecord, ScrapedCoursePrice } from '../../shared/types';

interface DbRow {
  id: number;
  course_id: number;
  course_name?: string;
  zenler_course_id?: string;
  course_slug?: string | null;
  regular_price: string;
  currency: string;
  discount_percent: string;
  final_price: string;
  source_url: string | null;
  raw_price_text: string | null;
  last_scraped_price: string | null;
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

function rowToCoursePrice(row: DbRow): CoursePriceRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    courseName: row.course_name,
    zenlerCourseId: row.zenler_course_id,
    courseSlug: row.course_slug,
    regularPrice: Number(row.regular_price),
    currency: row.currency,
    discountPercent: Number(row.discount_percent),
    finalPrice: Number(row.final_price),
    sourceUrl: row.source_url,
    rawPriceText: row.raw_price_text,
    lastScrapedPrice: row.last_scraped_price != null ? Number(row.last_scraped_price) : null,
    lastScrapedAt: row.last_scraped_at,
    lastScrapeStatus: row.last_scrape_status,
    lastScrapeError: row.last_scrape_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listCoursePrices(): Promise<CoursePriceRecord[]> {
  const rows = await sql`
    SELECT cp.*, c.name AS course_name, c.zenler_course_id, c.slug AS course_slug
    FROM course_prices cp
    INNER JOIN courses c ON c.id = cp.course_id
    ORDER BY c.sort_order ASC, c.name ASC
  `;
  return (rows as DbRow[]).map(rowToCoursePrice);
}

export async function upsertCoursePrices(
  prices: Array<{
    courseId: number;
    regularPrice: number;
    currency: string;
    discountPercent: number;
    sourceUrl?: string | null;
    rawPriceText?: string | null;
  }>,
): Promise<CoursePriceRecord[]> {
  for (const price of prices) {
    const regularPrice = Math.max(0, Number(price.regularPrice) || 0);
    const discountPercent = Math.max(0, Math.min(100, Number(price.discountPercent) || 0));
    const computedFinal = finalPrice(regularPrice, discountPercent);

    await sql`
      INSERT INTO course_prices
        (course_id, regular_price, currency, discount_percent, final_price, source_url, raw_price_text, last_scrape_status)
      VALUES
        (${price.courseId}, ${regularPrice}, ${price.currency || 'GBP'}, ${discountPercent}, ${computedFinal},
         ${price.sourceUrl ?? null}, ${price.rawPriceText ?? null}, 'manual')
      ON CONFLICT (course_id) DO UPDATE
        SET regular_price = EXCLUDED.regular_price,
            currency = EXCLUDED.currency,
            discount_percent = EXCLUDED.discount_percent,
            final_price = EXCLUDED.final_price,
            source_url = COALESCE(EXCLUDED.source_url, course_prices.source_url),
            raw_price_text = COALESCE(EXCLUDED.raw_price_text, course_prices.raw_price_text),
            last_scrape_status = 'manual',
            updated_at = NOW()
    `;
  }

  return listCoursePrices();
}

export async function upsertScrapedCoursePrices(scraped: ScrapedCoursePrice[]): Promise<CoursePriceRecord[]> {
  for (const item of scraped) {
    if (item.matched && item.price != null) {
      await sql`
        INSERT INTO course_prices
          (course_id, regular_price, currency, discount_percent, final_price, source_url, raw_price_text,
           last_scraped_price, last_scraped_at, last_scrape_status, last_scrape_error)
        VALUES
          (${item.courseId}, ${item.price}, ${item.currency}, 0, ${item.price}, ${item.url}, ${item.rawPriceText},
           ${item.price}, NOW(), 'matched', NULL)
        ON CONFLICT (course_id) DO UPDATE
          SET regular_price = EXCLUDED.regular_price,
              currency = EXCLUDED.currency,
              final_price = ROUND((EXCLUDED.regular_price * (1 - (course_prices.discount_percent / 100.0)))::numeric, 2),
              source_url = EXCLUDED.source_url,
              raw_price_text = EXCLUDED.raw_price_text,
              last_scraped_price = EXCLUDED.last_scraped_price,
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
          (${item.courseId}, 0, ${item.currency || 'GBP'}, 0, 0, ${item.url || null}, ${item.rawPriceText},
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
