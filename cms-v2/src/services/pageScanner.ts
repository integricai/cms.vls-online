import type { MigrationPageRecord, PageScanResult } from '../../shared/migrationTypes';
import { upsertMigrationPage, listMigrationPages } from '../models/migrationPage';
import { CourseMigrationError } from './courseMigrationService';
import {
  ALLOWED_HOSTS,
  inferTemplateFromPath,
  suggestDestinationSlug,
  toPublicOriginUrl,
  toZenlerFetchUrl,
} from './migrationUrlUtils';

const SITEMAP_URL = 'https://vls-online.com/sitemap/site-urls.xml';
const REQUEST_TIMEOUT_MS = 60_000;

function decodeXmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    switch (entity) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      default: {
        if (!entity.startsWith('#')) return match;
        const isHex = entity[1]?.toLowerCase() === 'x';
        const codePoint = Number.parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint);
      }
    }
  });
}

function extractLocValues(xml: string): string[] {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map(match => decodeXmlEntities(match[1].trim()))
    .filter(Boolean);
}

function extractTitleFromHtml(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
  if (og?.[1]) return og[1].trim();
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title?.[1]) return title[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return null;
}

function isAllowedSiteUrl(urlValue: string): boolean {
  try {
    const parsed = new URL(urlValue);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) return false;
    if (parsed.pathname.match(/\.(xml|json|pdf|jpg|jpeg|png|gif|webp|svg|css|js)$/i)) return false;
    if (parsed.pathname.includes('/blog/') && parsed.pathname !== '/blog') return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchSitemapXml(): Promise<string> {
  const fetchUrl = toZenlerFetchUrl(new URL(SITEMAP_URL));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(fetchUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'application/xml, text/xml, application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; VLS-CMS-PageScanner/1.0; +https://vls-online.com)',
      },
    });
    if (!response.ok) {
      throw new CourseMigrationError(`Sitemap returned HTTP ${response.status}`, 502);
    }
    return await response.text();
  } catch (error) {
    if (error instanceof CourseMigrationError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CourseMigrationError('Sitemap fetch timed out after 60 seconds', 504);
    }
    throw new CourseMigrationError(
      error instanceof Error ? error.message : 'Could not fetch sitemap',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageTitle(zenlerUrl: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(zenlerUrl, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; VLS-CMS-PageScanner/1.0; +https://vls-online.com)',
      },
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractTitleFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function scanAndStoreMigrationPages(options?: { fetchTitles?: boolean }): Promise<PageScanResult> {
  const xml = await fetchSitemapXml();
  const locValues = extractLocValues(xml)
    .filter(isAllowedSiteUrl);

  if (!locValues.length) {
    throw new CourseMigrationError('No page URLs were found in the sitemap', 502);
  }

  const uniqueUrls = [...new Set(locValues.map(url => {
    const parsed = new URL(url);
    return toPublicOriginUrl(parsed);
  }))].sort((a, b) => a.localeCompare(b));

  let inserted = 0;
  let updated = 0;

  for (const originUrl of uniqueUrls) {
    const parsed = new URL(originUrl);
    const template = inferTemplateFromPath(parsed.pathname);
    const suggestedDestination = suggestDestinationSlug(originUrl, template);
    const zenlerUrl = toZenlerFetchUrl(parsed).toString();

    let title: string | null = null;
    if (options?.fetchTitles) {
      title = await fetchPageTitle(zenlerUrl);
    }

    const result = await upsertMigrationPage({
      originUrl,
      zenlerUrl,
      title,
      path: parsed.pathname.replace(/\/$/, '') || '/',
      template,
      suggestedDestination,
      destinationSlug: suggestedDestination,
    });

    if (result === 'inserted') inserted += 1;
    else updated += 1;
  }

  const pages = await listMigrationPages();
  return {
    scanned: uniqueUrls.length,
    inserted,
    updated,
    pages,
  };
}

export function suggestDestinationForPage(page: MigrationPageRecord): string {
  return suggestDestinationSlug(page.originUrl, page.template);
}
