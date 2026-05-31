import type { Course, ScrapedCoursePrice } from '../../shared/types';
import { listActiveCourses } from '../models/course';

const COURSE_PAGE_HOST = 'https://vls-online.com';
const PRICE_RE =
  /(?:£|\$|€)\s?\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?|\b(?:GBP|USD|EUR)\s?\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?|\d{1,5}(?:,\d{3})*(?:\.\d{1,2})?\s?(?:GBP|USD|EUR)\b/gi;

function courseUrl(course: Course): string | null {
  const raw = course.zenlerUrl || (course.slug ? `${COURSE_PAGE_HOST}/courses/${course.slug}` : null);
  if (!raw) return null;
  return raw
    .replace(/^https:\/\/[^/]+\.newzenler\.com/i, COURSE_PAGE_HOST)
    .replace(/^http:\/\/[^/]+\.newzenler\.com/i, COURSE_PAGE_HOST);
}

function normalizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/&pound;/gi, '£')
    .replace(/&dollar;/gi, '$')
    .replace(/&euro;/gi, '€')
    .replace(/&#163;/gi, '£')
    .replace(/&#36;/gi, '$')
    .replace(/&#8364;/gi, '€')
    .replace(/&nbsp;/gi, ' ');
}

function parsePriceToken(token: string): { amount: number; currency: string; raw: string } | null {
  const raw = token.replace(/\s+/g, ' ').trim();
  const upper = raw.toUpperCase();
  const amountMatch = raw.replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[0]);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10000) return null;

  let currency = 'GBP';
  if (raw.includes('$') || upper.includes('USD')) currency = 'USD';
  if (raw.includes('€') || upper.includes('EUR')) currency = 'EUR';
  if (raw.includes('£') || upper.includes('GBP')) currency = 'GBP';

  return { amount, currency, raw };
}

function extractBestPrice(html: string): Pick<ScrapedCoursePrice, 'price' | 'currency' | 'rawPriceText' | 'matched'> {
  const text = normalizeHtml(html);
  const tokens = text.match(PRICE_RE) ?? [];
  const parsed = tokens
    .map(parsePriceToken)
    .filter((item): item is { amount: number; currency: string; raw: string } => Boolean(item));

  if (!parsed.length) {
    return { price: null, currency: 'GBP', rawPriceText: null, matched: false };
  }

  const unique = Array.from(new Map(parsed.map(item => [`${item.currency}:${item.amount}`, item])).values());
  const best = [...unique].sort((a, b) => b.amount - a.amount)[0];

  return {
    price: best.amount,
    currency: best.currency,
    rawPriceText: unique.map(item => item.raw).slice(0, 8).join(', '),
    matched: true,
  };
}

async function fetchCourseHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'VLS-CMS-PriceSync/1.0 (+https://vls-online.com)',
      },
    });
    if (!response.ok) throw new Error(`Page returned HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function scrapeCourse(course: Course): Promise<ScrapedCoursePrice> {
  const url = courseUrl(course);
  if (!url) {
    return {
      courseId: course.id,
      zenlerCourseId: course.zenlerCourseId,
      courseName: course.name,
      url: '',
      price: null,
      currency: 'GBP',
      rawPriceText: null,
      matched: false,
      error: 'Course does not have a public URL or slug.',
    };
  }

  try {
    const html = await fetchCourseHtml(url);
    const price = extractBestPrice(html);
    return {
      courseId: course.id,
      zenlerCourseId: course.zenlerCourseId,
      courseName: course.name,
      url,
      ...price,
      error: price.matched ? undefined : 'No currency price was found in the page HTML.',
    };
  } catch (error) {
    return {
      courseId: course.id,
      zenlerCourseId: course.zenlerCourseId,
      courseName: course.name,
      url,
      price: null,
      currency: 'GBP',
      rawPriceText: null,
      matched: false,
      error: error instanceof Error ? error.message : 'Could not scrape course page.',
    };
  }
}

export async function scrapeActiveCoursePrices(): Promise<ScrapedCoursePrice[]> {
  const courses = await listActiveCourses();
  return mapLimit(courses, 4, scrapeCourse);
}
