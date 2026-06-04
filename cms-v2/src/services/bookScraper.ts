import type { ScrapedBook } from '../../shared/types';

const BOOKS_URL = 'https://vls-online.com/bppbooks';
const COMMON_NINJA_BOOKS_WIDGET_ID = 'e48e2d3a-ef6d-4a10-818c-a0cfb38deb13';
const COMMON_NINJA_EMBED_URL = `https://cdn.commoninja.com/api/v1/embed/${COMMON_NINJA_BOOKS_WIDGET_ID}`;

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

function itemToBook(item: CommonNinjaCatalogItem): ScrapedBook | null {
  if (item.hidden === true) return null;

  const title = String(item.title ?? '').replace(/\s+/g, ' ').trim();
  const descriptionHtml = String(item.description ?? '');
  const descriptionText = textFromHtml(descriptionHtml);
  const price = parseLabeledPrice(descriptionText, 'Standard Price');
  const discountedPrice = parseLabeledPrice(descriptionText, 'Discounted Price');
  const stripeUrl = String(item.buttonUrl ?? '').trim();
  const imageUrl = String(item.mediaUrl ?? '').trim();

  if (!title || !price || !stripeUrl) return null;

  return {
    title,
    description: cleanDescription(descriptionText),
    imageUrl,
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

  return items
    .map(itemToBook)
    .filter((book): book is ScrapedBook => Boolean(book));
}
