import type { ScrapedContentSection, ScrapedGenericPage } from '../../shared/migrationTypes';
import { breadcrumbTrailText, parseBreadcrumbFromHtml } from './breadcrumbUtils';
import { toPublicOriginUrl } from './migrationUrlUtils';
import { CoursePageScrapeError, fetchPageHtml } from './coursePageScraper';

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function stripTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function meta(html: string, selector: RegExp): string {
  const match = html.match(selector);
  if (!match) return '';
  const tag = match[0];
  const contentMatch = tag.match(/content=["']([^"']*)["']/i);
  if (contentMatch) return decodeEntities(contentMatch[1]);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? stripTags(titleMatch[1]) : '';
}

function inferSlug(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  return parts[parts.length - 1]?.toLowerCase().replace(/[^a-z0-9-]/g, '') || 'page';
}

function extractMainContent(html: string): string {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) return mainMatch[1];

  const contentMatch = html.match(/<div[^>]*class="[^"]*page-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (contentMatch) return contentMatch[1];

  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function parseSections(contentHtml: string): ScrapedContentSection[] {
  const cleaned = contentHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const sections: ScrapedContentSection[] = [];
  const headingPattern = /<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi;
  const matches = [...cleaned.matchAll(headingPattern)];

  if (!matches.length) {
    const bodyText = stripTags(cleaned);
    if (bodyText) {
      sections.push({ heading: '', bodyHtml: cleaned.trim(), bodyText });
    }
    return sections;
  }

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const heading = stripTags(match[2]);
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? cleaned.length) : cleaned.length;
    const slice = cleaned.slice(start, end).trim();
    const bodyText = stripTags(slice);
    if (heading || bodyText) {
      sections.push({ heading, bodyHtml: slice, bodyText });
    }
  }

  return sections;
}

function parseFaqSection(html: string): ScrapedGenericPage['faq'] {
  const uidMatch = html.match(/<div class="(vlsfaq[a-z0-9]+)"(?=[\s>])/i);
  if (!uidMatch) return null;

  const uid = uidMatch[1];
  const start = html.indexOf(uidMatch[0]);
  const faqHtml = html.slice(start, start + 250000);
  const title = stripTags(faqHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '') || 'Frequently Asked Questions';
  const icon = faqHtml.match(/<span class="[^"]*-head-ico"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '';

  const items: Array<{ question: string; answerHtml: string; answerText: string }> = [];
  const itemPattern = new RegExp(
    `<div[^>]*class="${uid}-item"[^>]*>[\\s\\S]*?<span[^>]*class="${uid}-q"[^>]*>([\\s\\S]*?)<\\/span>[\\s\\S]*?<div[^>]*itemprop=["']text["'][^>]*>([\\s\\S]*?)<\\/div>`,
    'gi',
  );
  for (const match of faqHtml.matchAll(itemPattern)) {
    const question = stripTags(match[1]);
    const answerHtml = match[2].trim();
    const answerText = stripTags(answerHtml);
    if (question) items.push({ question, answerHtml, answerText });
  }

  if (!items.length) return null;
  return { title, icon: stripTags(icon), items };
}

export async function scrapeGenericPage(sourceUrl: string): Promise<ScrapedGenericPage> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    throw new CoursePageScrapeError('Invalid URL');
  }

  const normalizedUrl = toPublicOriginUrl(parsed);
  const html = await fetchPageHtml(sourceUrl);
  const mainContent = extractMainContent(html);

  const breadcrumbHtml = mainContent.match(/<nav[^>]*aria-label=["']breadcrumb["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1]
    ?? mainContent.match(/<p[^>]*>([\s\S]*?(?:Home|home)[\s\S]*?(?:>|›)[\s\S]*?)<\/p>/i)?.[1]
    ?? '';
  const breadcrumbItems = parseBreadcrumbFromHtml(breadcrumbHtml, normalizedUrl);

  const title = meta(html, /<meta[^>]+property=["']og:title["'][^>]*>/i)
    || meta(html, /<title[^>]*>/i)
    || stripTags(mainContent.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '');
  const metaDescription = meta(html, /<meta[^>]+name=["']description["'][^>]*>/i)
    || meta(html, /<meta[^>]+property=["']og:description["'][^>]*>/i);

  return {
    sourceUrl: normalizedUrl,
    slug: inferSlug(parsed.pathname),
    title,
    metaDescription,
    breadcrumbItems,
    sections: parseSections(mainContent),
    faq: parseFaqSection(html),
  };
}

export function genericBreadcrumbText(page: ScrapedGenericPage): string {
  return breadcrumbTrailText(page.breadcrumbItems);
}
