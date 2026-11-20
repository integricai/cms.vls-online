import type { ScrapedBook } from '../../shared/types';
import { copy, put } from '@vercel/blob';
import crypto from 'crypto';
import path from 'path';

const BOOKS_URL = 'https://vls-online.com/bppbooks';
const COMMON_NINJA_BOOKS_WIDGET_ID = 'e48e2d3a-ef6d-4a10-818c-a0cfb38deb13';
const COMMON_NINJA_EMBED_URL = `https://cdn.commoninja.com/api/v1/embed/${COMMON_NINJA_BOOKS_WIDGET_ID}`;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);

interface CommonNinjaCatalogItem {
  title?: unknown;
  description?: unknown;
  mediaUrl?: unknown;
  buttonUrl?: unknown;
  hidden?: unknown;
}

interface CommonNinjaEmbedResponse {
  success?: boolean;
  message?: string;
  data?: {
    widgetData?: {
      pluginData?: {
        data?: {
          content?: {
            items?: CommonNinjaCatalogItem[];
          };
        };
      };
    };
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function textFromHtml(html: string): string {
  return decodeEntities(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizePrice(value: unknown): number {
  const amount = String(value ?? '').replace(/,/g, '').match(/\d+(?:\.\d{1,2})?/);
  return amount ? Number(amount[0]) : 0;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'book';
}

function extFromImage(sourceUrl: string, contentType: string): string {
  const ext = path.extname(new URL(sourceUrl).pathname).replace('.', '').toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
  return IMAGE_TYPES.get(contentType) || 'webp';
}

async function fetchImage(sourceUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VLS-CMS-BookSync/1.0 (+https://vls-online.com)' },
    });
    if (!response.ok) throw new Error(`Image returned HTTP ${response.status}`);

    const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '';
    if (!IMAGE_TYPES.has(contentType)) throw new Error(`Unsupported image type "${contentType || 'unknown'}"`);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Image response did not include a body');

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) throw new Error('Image is too large');
      chunks.push(value);
    }

    return { buffer: Buffer.concat(chunks.map(chunk => Buffer.from(chunk))), contentType };
  } finally {
    clearTimeout(timeout);
  }
}

async function uploadBookImage(sourceUrl: string, title: string): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error('Book image sync requires Vercel Blob storage. Set BLOB_READ_WRITE_TOKEN before syncing books.');
  }

  const hash = crypto.createHash('sha256').update(sourceUrl).digest('hex').slice(0, 16);
  const pathname = `cms/books/${slugify(title)}-${hash}.${extFromImage(sourceUrl, '')}`;

  try {
    const result = await copy(sourceUrl, pathname, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: 31536000,
    });
    return result.url;
  } catch {
    // Fall back to an explicit download/upload if Blob cannot copy the remote URL directly.
  }

  const { buffer, contentType } = await fetchImage(sourceUrl);
  const fallbackPathname = `cms/books/${slugify(title)}-${hash}.${extFromImage(sourceUrl, contentType)}`;
  const result = await put(fallbackPathname, buffer, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 31536000,
    contentType,
  });
  return result.url;
}

function parseCurrency(text: string): string {
  const upper = text.toUpperCase();
  if (text.includes('$') || upper.includes('USD')) return 'USD';
  if (text.includes('£') || upper.includes('GBP')) return 'GBP';
  if (text.includes('€') || upper.includes('EUR')) return 'EUR';
  return 'USD';
}

function parseLabeledPrice(text: string, label: 'Standard Price' | 'Discounted Price'): number {
  const pattern = new RegExp(`${label}\\s*:?\\s*(?:USD|GBP|EUR|[$£€])?\\s*(\\d+(?:\\.\\d{1,2})?)`, 'i');
  const match = text.match(pattern);
  return match ? normalizePrice(match[1]) : 0;
}

function cleanDescription(text: string): string {
  return text
    .replace(/\bStandard Price\s*:?\s*(?:USD|GBP|EUR|[$£€])?\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\bDiscounted Price\s*:?\s*(?:USD|GBP|EUR|[$£€])?\s*\d+(?:\.\d{1,2})?/gi, ' ')
    .replace(/\bNow\s*:?\s*/gi, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function itemToBook(
  item: CommonNinjaCatalogItem,
  imageCache: Map<string, Promise<string>>,
): Promise<ScrapedBook | null> {
  if (item.hidden === true) return null;

  const title = String(item.title ?? '').replace(/\s+/g, ' ').trim();
  const descriptionHtml = String(item.description ?? '');
  const descriptionText = textFromHtml(descriptionHtml);
  const price = parseLabeledPrice(descriptionText, 'Standard Price');
  const discountedPrice = parseLabeledPrice(descriptionText, 'Discounted Price');
  const stripeUrl = String(item.buttonUrl ?? '').trim();
  const imageUrl = String(item.mediaUrl ?? '').trim();

  if (!title || !price || !stripeUrl) return null;

  const blobImageUrl = imageUrl
    ? await (imageCache.get(imageUrl) ?? imageCache.set(imageUrl, uploadBookImage(imageUrl, title)).get(imageUrl)!)
    : '';

  return {
    isActive: true,
    title,
    description: cleanDescription(descriptionText),
    imageUrl: blobImageUrl,
    imageAltText: title,
    price,
    discountedPrice: discountedPrice || null,
    currency: parseCurrency(descriptionText),
    stripeUrl,
    sourceUrl: BOOKS_URL,
  };
}

export async function scrapeBppBooks(): Promise<ScrapedBook[]> {
  const response = await fetch(COMMON_NINJA_EMBED_URL, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'VLS-CMS-BookSync/1.0 (+https://vls-online.com)',
    },
  });

  if (!response.ok) {
    throw new Error(`Common Ninja returned HTTP ${response.status}`);
  }

  const payload = await response.json() as CommonNinjaEmbedResponse;
  if (!payload.success) {
    throw new Error(payload.message || 'Common Ninja did not return a successful catalog response.');
  }

  const items = payload.data?.widgetData?.pluginData?.data?.content?.items;
  if (!Array.isArray(items)) {
    throw new Error('Common Ninja catalog response did not include book items.');
  }

  const imageCache = new Map<string, Promise<string>>();
  const books = await Promise.all(items.map(item => itemToBook(item, imageCache)));
  return books.filter((book): book is ScrapedBook => Boolean(book));
}
