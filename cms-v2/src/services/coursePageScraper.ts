import dns from 'dns/promises';
import net from 'net';
import type {
  ScrapedCourseDescription,
  ScrapedCoursePage,
  ScrapedHero,
  ScrapedHeroRightItem,
  ScrapedLearnItem,
  ScrapedPromotionSection,
  ScrapedTabPanel,
  ScrapedTestimonialCard,
  ScrapedTestimonials,
} from '../../shared/migrationTypes';
import { breadcrumbTrailText, parseBreadcrumbFromHtml } from './breadcrumbUtils';
import {
  ALLOWED_HOSTS,
  isVlsHost,
  toPublicOriginUrl,
  toZenlerFetchUrl,
} from './migrationUrlUtils';
import { parseFaq } from './faqParser';

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 45_000;
const FETCH_ATTEMPTS = 3;

export type FetchPageHtmlOptions = {
  /** When true, any public http(s) host is allowed (SSRF-safe). Used for external blog imports. */
  allowExternal?: boolean;
};

export class CoursePageScrapeError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

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

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
    ?? tag.match(new RegExp(`\\s${name}\\s*=\\s*([^\\s>]+)`, 'i'));
  return decodeEntities(match?.[2] ?? match?.[1] ?? '').trim();
}

function pageTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? stripTags(match[1]) : '';
}

function meta(html: string, selector: RegExp): string {
  const match = html.match(selector);
  if (!match) return '';
  const tag = match[0];
  if (/^<title/i.test(tag)) return pageTitle(html);
  return decodeEntities(attr(tag, 'content') || attr(tag, 'href'));
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    return parts[0] === 10
      || parts[0] === 127
      || (parts[0] === 169 && parts[1] === 254)
      || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)
      || (parts[0] === 192 && parts[1] === 168)
      || parts[0] === 0;
  }
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    return normalized === '::1'
      || normalized.startsWith('fc')
      || normalized.startsWith('fd')
      || normalized.startsWith('fe80:')
      || normalized === '::';
  }
  return true;
}

async function validateSiteUrl(
  raw: string,
  requireCoursePath = true,
  allowExternal = false,
): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    throw new CoursePageScrapeError('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new CoursePageScrapeError('Only http and https URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase();
  if (!allowExternal && !ALLOWED_HOSTS.has(host)) {
    throw new CoursePageScrapeError('Only vls-online.com page URLs are allowed');
  }
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host) && isPrivateIp(host)) {
    throw new CoursePageScrapeError('Local and private network URLs are not allowed');
  }
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(address => isPrivateIp(address.address))) {
    throw new CoursePageScrapeError('URL resolves to a private or internal network address');
  }
  if (requireCoursePath && !parsed.pathname.includes('/courses/')) {
    throw new CoursePageScrapeError('URL must point to a course page (/courses/{slug})');
  }
  return parsed;
}

async function fetchHtmlOnce(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; VLS-CMS-CourseMigration/1.2; +https://vls-online.com)',
      },
    });
    if (!response.ok) {
      throw new CoursePageScrapeError(`Page returned HTTP ${response.status}`, 502);
    }

    const reader = response.body?.getReader();
    if (!reader) return await response.text();

    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_PAGE_BYTES) {
        throw new CoursePageScrapeError('Page HTML exceeds the maximum allowed size');
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString('utf8');
  } catch (error) {
    if (error instanceof CoursePageScrapeError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new CoursePageScrapeError(
        `Page fetch timed out after ${REQUEST_TIMEOUT_MS / 1000} seconds`,
        504,
      );
    }
    throw new CoursePageScrapeError(
      error instanceof Error ? error.message : 'Could not fetch page',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPageHtml(
  sourceUrl: string,
  options: FetchPageHtmlOptions = {},
): Promise<string> {
  const allowExternal = Boolean(options.allowExternal);
  const url = await validateSiteUrl(sourceUrl, false, allowExternal);
  const fetchUrl = allowExternal && !isVlsHost(url.hostname)
    ? url
    : toZenlerFetchUrl(url);
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchHtmlOnce(fetchUrl);
    } catch (error) {
      lastError = error;
      const retryable = error instanceof CoursePageScrapeError
        && (error.status === 502 || error.status === 504);
      if (!retryable || attempt >= FETCH_ATTEMPTS) break;
      await new Promise(resolve => setTimeout(resolve, attempt * 1500));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new CoursePageScrapeError('Could not fetch page', 502);
}

function extractDivByIdPrefix(html: string, idPrefix: string): string {
  const re = new RegExp(`<div\\s+id="${idPrefix}[^"]*"[^>]*>`, 'i');
  const match = re.exec(html);
  if (!match) return '';

  const start = match.index + match[0].length;
  let depth = 1;
  let i = start;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) break;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
    } else {
      depth -= 1;
      if (depth === 0) return html.slice(start, nextClose);
      i = nextClose + 6;
    }
  }
  return '';
}

function extractFirstMatch(html: string, pattern: RegExp): string {
  return html.match(pattern)?.[1]?.trim() ?? '';
}

function extractAllMatches(html: string, pattern: RegExp): string[] {
  return Array.from(html.matchAll(pattern), match => match[1]?.trim() ?? '').filter(Boolean);
}

function parseHeroLearnItems(html: string): ScrapedLearnItem[] {
  const learnMarker = html.search(/WHAT YOU['']LL LEARN/i);
  if (learnMarker === -1) return [];

  const slice = html.slice(learnMarker, learnMarker + 25000);
  const items: ScrapedLearnItem[] = [];
  const cardPattern = /display:flex;align-items:flex-start;gap:12px;[\s\S]*?<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/gi;

  for (const match of slice.matchAll(cardPattern)) {
    const title = stripTags(match[1]);
    const subtitle = stripTags(match[2]);
    if (title && !/what you/i.test(title)) {
      items.push({ title, subtitle });
    }
  }

  return items;
}

function parseHero(heroHtml: string, pageUrl: string): ScrapedHero | null {
  if (!heroHtml.trim()) return null;

  const breadcrumbParagraph = extractFirstMatch(heroHtml, /<p[^>]*>([\s\S]*?)<\/p>/i);
  const breadcrumbItems = parseBreadcrumbFromHtml(breadcrumbParagraph, pageUrl);
  const breadcrumb = breadcrumbTrailText(breadcrumbItems);
  const heading = stripTags(extractFirstMatch(heroHtml, /<h1[^>]*>([\s\S]*?)<\/h1>/i));

  const descMatch = heroHtml.match(/<p[^>]*class="[^"]*-desc"[^>]*>([\s\S]*?)<\/p>/i)
    ?? heroHtml.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  const description = descMatch ? stripTags(descMatch[1]) : '';

  const eyebrowRaw = extractFirstMatch(heroHtml, /<p[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/p>/i);
  const eyebrow = stripTags(eyebrowRaw.replace(/&#x25CF;|●/gi, ' · '));

  const tags = eyebrow
    .split('·')
    .map(tag => tag.trim())
    .filter(Boolean);

  const learnLabel = stripTags(extractFirstMatch(
    heroHtml,
    /<p[^>]*text-transform:uppercase[^>]*margin:0 0 16px[^>]*>([\s\S]*?)<\/p>/i,
  )) || stripTags(extractFirstMatch(
    heroHtml,
    /WHAT YOU['']LL LEARN/i,
  )) || "WHAT YOU'LL LEARN";

  let learnItems = parseHeroLearnItems(heroHtml);
  if (!learnItems.length) {
    const learnCardPattern = /<div[^>]*display:grid[^>]*>[\s\S]*?<\/div>\s*<\/div>/i;
    const learnSection = heroHtml.match(learnCardPattern)?.[0] ?? heroHtml;
    const cardPattern = /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
    for (const match of learnSection.matchAll(cardPattern)) {
      const title = stripTags(match[1]);
      const subtitle = stripTags(match[2] ?? '');
      if (title && title !== learnLabel && !/what you/i.test(title)) {
        learnItems.push({ title, subtitle });
      }
    }
  }

  if (!heading && !description) return null;

  return {
    breadcrumb,
    breadcrumbItems,
    eyebrow: tags.join(' · '),
    heading,
    description,
    tags,
    learnLabel,
    learnItems,
  };
}

function parseHeroRight(heroRightHtml: string): ScrapedCoursePage['heroRight'] {
  if (!heroRightHtml.trim()) return null;

  const label = stripTags(extractFirstMatch(
    heroRightHtml,
    /<p[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/p>/i,
  ));

  const items: ScrapedHeroRightItem[] = [];
  const rowPattern = /<div[^>]*display:flex[^>]*align-items:flex-start[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const rowMatch of heroRightHtml.matchAll(rowPattern)) {
    const row = rowMatch[1];
    const icon = extractFirstMatch(row, /<span[^>]*>([\s\S]*?)<\/span>/i);
    const paragraphs = extractAllMatches(row, /<p[^>]*>([\s\S]*?)<\/p>/gi);
    const badge = stripTags(extractFirstMatch(row, /<span[^>]*border-radius:999px[^>]*>([\s\S]*?)<\/span>/i));
    if (!paragraphs.length) continue;
    items.push({
      icon: stripTags(icon),
      title: paragraphs[0] ?? '',
      description: paragraphs[1] ?? '',
      badge,
    });
  }

  const ctaMatch = heroRightHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
  const ctaText = ctaMatch ? stripTags(ctaMatch[2]) : '';
  const ctaUrl = ctaMatch?.[1] ?? '';

  if (!label && !items.length) return null;
  return { label, items, ctaText, ctaUrl };
}

function findDescriptionSlice(html: string): string {
  const tabsStart = html.search(/<div\b[^>]*data-vctabs="1"/i);
  if (tabsStart === -1) return '';

  const markers = [
    '<!-- Right Hero Section ends here -->',
    '<!-- Course Hero ends here -->',
    '<!-- Left Hero Section ends here -->',
  ];
  let descStart = -1;
  for (const marker of markers) {
    const idx = html.lastIndexOf(marker, tabsStart);
    if (idx >= 0) descStart = Math.max(descStart, idx + marker.length);
  }

  if (descStart < 0) {
    const chrMatch = html.slice(0, tabsStart).match(/<div id="chr-[^"]+"/i);
    if (chrMatch?.index !== undefined) {
      const chrOpen = html.slice(chrMatch.index).match(/^<div id="chr-[^"]+"[^>]*>/i)?.[0] ?? '';
      const chrInner = extractDivByIdPrefix(html, 'chr-');
      descStart = chrMatch.index + chrOpen.length + chrInner.length + 6;
    }
  }

  if (descStart < 0) return '';
  return html.slice(descStart, tabsStart);
}

function parseCmsCourseDescription(descSlice: string): ScrapedCourseDescription | null {
  const btnMatch = descSlice.match(/<button[^>]*id="(cd[a-z0-9]+)B"[^>]*>[\s\S]*?Read more/i);
  if (!btnMatch) return null;

  const btnIndex = descSlice.indexOf(btnMatch[0]);
  const beforeBtn = descSlice.slice(0, btnIndex);
  const baseUid = btnMatch[1].replace(/B$/, '');

  const titleMatch = beforeBtn.match(/<p[^>]*font-weight:700[^>]*>([\s\S]*?)<\/p>/i);
  const icon = titleMatch
    ? stripTags(extractFirstMatch(titleMatch[1], /<span[^>]*>([\s\S]*?)<\/span>/i))
    : '📖';
  const title = titleMatch
    ? stripTags(titleMatch[1].replace(/<span[\s\S]*?<\/span>/gi, ''))
    : 'About This Course';

  const introParagraphs = extractAllMatches(beforeBtn, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter(text => text && text !== title);

  const introBold = introParagraphs[0] ?? '';
  const introP1 = introParagraphs[1] ?? '';
  const introP2 = introParagraphs[2] ?? '';

  const expandedHtml = extractDivByIdPrefix(descSlice, `${baseUid}M`);
  const bodyHtml = expandedHtml.trim();

  if (!title && !introBold && !introP1 && !bodyHtml) return null;

  return {
    icon: icon || '📖',
    title: title || 'About This Course',
    introBold,
    introP1,
    introP2,
    bodyHtml,
    bodyText: stripTags(bodyHtml),
    source: 'cms',
  };
}

type ZenlerDescriptionSection = { heading: string; html: string; text: string };

function headingMatchesText(heading: string, text: string): boolean {
  return text === heading || text.toLowerCase() === heading.toLowerCase();
}

function findZenlerSectionBody(slice: string, heading: string): { html: string; text: string } | null {
  const paragraphPattern = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  for (const match of slice.matchAll(paragraphPattern)) {
    const text = stripTags(match[1]);
    if (text.length < 20) continue;
    if (headingMatchesText(heading, text)) continue;
    return { html: match[0], text };
  }
  return null;
}

function extractZenlerDescriptionSections(cleaned: string): ZenlerDescriptionSection[] {
  const headingPattern = /<(p|h2|h3)\b[^>]*font-size:\s*25px[^>]*>([\s\S]*?)<\/\1>/gi;
  const headings: Array<{ index: number; endIndex: number; text: string }> = [];

  for (const match of cleaned.matchAll(headingPattern)) {
    const text = stripTags(match[2]);
    if (!text) continue;
    const index = match.index ?? 0;
    headings.push({ index, endIndex: index + match[0].length, text });
  }

  const sections: ZenlerDescriptionSection[] = [];
  for (let i = 0; i < headings.length; i += 1) {
    const sliceEnd = i + 1 < headings.length ? headings[i + 1].index : cleaned.length;
    const body = findZenlerSectionBody(cleaned.slice(headings[i].endIndex, sliceEnd), headings[i].text);
    if (!body) continue;
    sections.push({ heading: headings[i].text, html: body.html, text: body.text });
  }

  return sections;
}

function buildZenlerCourseDescription(sections: ZenlerDescriptionSection[]): ScrapedCourseDescription {
  return {
    icon: '📖',
    title: 'About This Course',
    introBold: sections[0]?.heading ?? '',
    introP1: sections[0]?.text ?? '',
    introP2: '',
    bodyHtml: sections.slice(1).map(section => `<h3>${section.heading}</h3>${section.html}`).join('\n'),
    bodyText: sections.slice(1).map(section => `${section.heading}\n${section.text}`).join('\n\n'),
    source: 'zenler',
  };
}

function parseZenlerCourseDescription(descSlice: string): ScrapedCourseDescription | null {
  const cleaned = descSlice
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const pairedSections = extractZenlerDescriptionSections(cleaned);
  if (pairedSections.length) {
    return buildZenlerCourseDescription(pairedSections);
  }

  const legacySections: ZenlerDescriptionSection[] = [];
  const sectionPattern = /<p[^>]*font-size:\s*25px[^>]*>([\s\S]*?)<\/p>\s*(<p[^>]*>[\s\S]*?<\/p>)/gi;
  for (const match of cleaned.matchAll(sectionPattern)) {
    const heading = stripTags(match[1]);
    const sectionHtml = match[2].trim();
    const text = stripTags(sectionHtml);
    if (heading && text && !headingMatchesText(heading, text)) {
      legacySections.push({ heading, html: sectionHtml, text });
    }
  }
  if (legacySections.length) {
    return buildZenlerCourseDescription(legacySections);
  }

  const plainParagraphs = extractAllMatches(cleaned, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter(text => text.length > 40);

  if (!plainParagraphs.length) return null;

  const legacyHeadings = extractAllMatches(cleaned, /<p[^>]*font-size:\s*25px[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter(Boolean);
  const introBold = legacyHeadings[0] ?? '';

  return {
    icon: '📖',
    title: 'About This Course',
    introBold: introBold || plainParagraphs[0]?.slice(0, 120) || '',
    introP1: plainParagraphs[0] ?? '',
    introP2: plainParagraphs[1] ?? '',
    bodyHtml: plainParagraphs.slice(2).map(text => `<p>${text}</p>`).join('\n'),
    bodyText: plainParagraphs.slice(2).join('\n\n'),
    source: 'zenler',
  };
}

function parseCourseDescription(html: string): ScrapedCourseDescription | null {
  const descSlice = findDescriptionSlice(html);
  if (!descSlice.trim()) return null;

  return parseCmsCourseDescription(descSlice) ?? parseZenlerCourseDescription(descSlice);
}

function parseTabPanelIntro(cleaned: string): Record<string, string> | null {
  const panelHtml =
    extractFirstMatch(cleaned, /<div class="[^"]*panel"[^>]*>([\s\S]*?)<\/div>/i)
    || extractFirstMatch(cleaned, /<div[^>]*background:#0f1e3c[^>]*>([\s\S]*?)<\/div>/i);
  if (!panelHtml) return null;

  const eyebrow = stripTags(
    extractFirstMatch(panelHtml, /<p[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/p>/i)
    || extractFirstMatch(panelHtml, /<p[^>]*letter-spacing:[^"']*uppercase[^>]*>([\s\S]*?)<\/p>/i),
  );
  const heading = stripTags(
    extractFirstMatch(panelHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || extractFirstMatch(panelHtml, /<p[^>]*font-weight:700[^>]*>([\s\S]*?)<\/p>/i),
  );
  const description = stripTags(
    extractFirstMatch(panelHtml, /<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i)
    || extractFirstMatch(panelHtml, /<p[^>]*font-weight:700[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i),
  );

  if (!heading && !description) return null;

  return {
    eyebrow: eyebrow || "WHAT'S INCLUDED",
    heading: heading || 'Everything you need to pass',
    description: description || '',
  };
}

function parseFeatureCardRows(cleaned: string): string[] {
  const cards: string[] = [];
  const patterns = [
    /<div style="display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">([\s\S]*?)<\/div>\s*(?=<div style="display:flex;gap:12px|<\/div>\s*<\/div>)/gi,
    /<div[^>]*display:grid[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi,
  ];

  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern)) {
      const cardHtml = match[1];
      const icon = stripTags(
        extractFirstMatch(cardHtml, /<div[^>]*font-size:20px[^>]*>([\s\S]*?)<\/div>/i)
        || extractFirstMatch(cardHtml, /<span[^>]*>([\s\S]*?)<\/span>/i),
      );
      const title = stripTags(extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>/i));
      const description = stripTags(
        extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/is)
        || extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>[\s\S]*?<\/div>\s*<p[^>]*>([\s\S]*?)<\/p>/is),
      );
      if (title) cards.push(`${icon}|${title}|${description}`);
    }
    if (cards.length) break;
  }

  return cards;
}

function parsePromoGridCards(cleaned: string): string[] {
  const cards: string[] = [];
  const pattern = /<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;">([\s\S]*?)<\/div>\s*(?=<div style="background:#fff|$)/gi;
  for (const match of cleaned.matchAll(pattern)) {
    const cardHtml = match[1];
    const icon = stripTags(
      extractFirstMatch(cardHtml, /<div[^>]*font-size:24px[^>]*>([\s\S]*?)<\/div>/i)
      || extractFirstMatch(cardHtml, /<div[^>]*font-size:20px[^>]*>([\s\S]*?)<\/div>/i),
    );
    const title = stripTags(extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>/i));
    const description = stripTags(
      extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/is),
    );
    const ctaText = stripTags(extractFirstMatch(cardHtml, /<a[^>]*>([\s\S]*?)<\/a>/i));
    const ctaHref = extractFirstMatch(cardHtml, /<a[^>]*href="([^"]*)"[^>]*>/i);
    if (title) cards.push(`${icon}|${title}|${description}|${ctaText}|${ctaHref}`);
  }
  return cards;
}

function parseStepRows(cleaned: string): string[] {
  const steps: string[] = [];
  const pattern = /<div style="display:flex;gap:16px;align-items:flex-start;">([\s\S]*?)<\/div>\s*(?=<div style="display:flex;gap:16px|<\/div>\s*<\/div>|$)/gi;

  for (const match of cleaned.matchAll(pattern)) {
    const stepHtml = match[1];
    const icon = stripTags(
      extractFirstMatch(stepHtml, /<div[^>]*border-radius:50%[^>]*>([\s\S]*?)<\/div>/i)
      || extractFirstMatch(stepHtml, /<span[^>]*>([\s\S]*?)<\/span>/i),
    );
    const title = stripTags(
      extractFirstMatch(stepHtml, /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>/i)
      || extractFirstMatch(stepHtml, /<p[^>]*font-size:15px[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>/i),
    );
    const description = stripTags(
      extractFirstMatch(stepHtml, /<p[^>]*font-weight:600[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/is)
      || extractFirstMatch(stepHtml, /<p[^>]*font-size:15px[^>]*font-weight:600[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/is),
    );
    if (title) steps.push(`${icon}|${title}|${description}`);
  }

  return steps;
}

function parseHeadingParagraphSections(cleaned: string): Array<{ heading: string; paragraph: string }> {
  const sections: Array<{ heading: string; paragraph: string }> = [];
  const patterns = [
    /<div style="margin-bottom:1\.25rem;">([\s\S]*?)<\/div>/gi,
    /<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/gi,
  ];

  for (const match of cleaned.matchAll(patterns[0])) {
    const block = match[1];
    const heading = stripTags(extractFirstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i));
    const paragraph = stripTags(extractFirstMatch(block, /<h3[^>]*>[\s\S]*?<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/is));
    if (heading && paragraph) sections.push({ heading, paragraph });
  }

  if (!sections.length) {
    for (const match of cleaned.matchAll(patterns[1])) {
      const heading = stripTags(match[1]);
      const paragraph = stripTags(match[2]);
      if (heading && paragraph) sections.push({ heading, paragraph });
    }
  }

  return sections;
}

function parseTabPanelBlocks(panelHtml: string): Array<{ blockType: string; fields: Record<string, string> }> {
  const blocks: Array<{ blockType: string; fields: Record<string, string> }> = [];
  const cleaned = panelHtml.trim();
  if (!cleaned) return blocks;

  const panelIntro = parseTabPanelIntro(cleaned);
  if (panelIntro) {
    blocks.push({ blockType: 'panel-intro', fields: panelIntro });
  }

  const featureCards = parseFeatureCardRows(cleaned);
  if (featureCards.length) {
    blocks.push({ blockType: 'inc-cards', fields: { cards: featureCards.join('\n') } });
  }

  const promoCards = parsePromoGridCards(cleaned);
  if (promoCards.length) {
    blocks.push({ blockType: 'more-cards', fields: { cards: promoCards.join('\n') } });
  }

  const steps = parseStepRows(cleaned);
  if (steps.length) {
    blocks.push({ blockType: 'steps', fields: { steps: steps.join('\n') } });
  }

  for (const section of parseHeadingParagraphSections(cleaned)) {
    blocks.push({
      blockType: 'heading-para',
      fields: {
        heading: section.heading,
        paragraph: section.paragraph,
      },
    });
  }

  const bullets = extractAllMatches(cleaned, /<li[^>]*>([\s\S]*?)<\/li>/gi).map(stripTags).filter(Boolean);
  if (bullets.length) {
    blocks.push({ blockType: 'bullets', fields: { bullet_items: bullets.join('\n') } });
  }

  if (!blocks.length) {
    const paragraphs = extractAllMatches(cleaned, /<p[^>]*>([\s\S]*?)<\/p>/gi)
      .map(stripTags)
      .filter((text) => text.length > 30);
    if (paragraphs.length) {
      blocks.push({
        blockType: 'heading-para',
        fields: {
          heading: paragraphs[0] ?? 'Overview',
          paragraph: paragraphs.slice(1).join('\n\n') || paragraphs[0] || '',
        },
      });
    }
  }

  if (!blocks.length) {
    blocks.push({
      blockType: 'paragraph',
      fields: { paragraph: stripTags(cleaned).slice(0, 8000) },
    });
  }

  return blocks;
}

function parseTabs(html: string): ScrapedTabPanel[] {
  const tabsStart = html.search(/<div\b[^>]*data-vctabs="1"/i);
  if (tabsStart === -1) return [];

  const contextStart = Math.max(0, tabsStart - 8000);
  const tabsRoot = html.slice(tabsStart);
  const uidMatch = html.slice(contextStart, tabsStart + 120000).match(/\.(vct[a-z0-9]+)-nav/i);
  const uid = uidMatch?.[1] ?? 'vct';

  const labels: Array<{ label: string; icon: string }> = [];
  const btnPattern = new RegExp(`<button[^>]*class="[^"]*${uid}-btn[^"]*"[^>]*>([\\s\\S]*?)<\\/button>`, 'gi');
  for (const match of tabsRoot.matchAll(btnPattern)) {
    const inner = match[1];
    const icon = stripTags(extractFirstMatch(inner, /<span[^>]*>([\s\S]*?)<\/span>/i));
    const label = stripTags(inner.replace(/<span[\s\S]*?<\/span>/gi, ''));
    if (label) labels.push({ label, icon });
  }

  const panels: ScrapedTabPanel[] = [];
  const panelOpenPattern = new RegExp(`<div\\s+id="${uid}-(\\d+)"\\s+data-vctpanel="1"[^>]*>`, 'gi');
  let panelIndex = 0;
  for (const match of tabsRoot.matchAll(panelOpenPattern)) {
    const panelHtml = extractDivByIdPrefix(tabsRoot, `${uid}-${match[1]}`);
    const meta = labels[panelIndex] ?? { label: `Tab ${panelIndex + 1}`, icon: '' };
    panels.push({
      label: meta.label,
      icon: meta.icon,
      contentHtml: panelHtml.trim(),
      contentText: stripTags(panelHtml).slice(0, 8000),
    });
    panelIndex += 1;
  }

  return panels;
}

function parseTestimonials(html: string): ScrapedTestimonials | null {
  const testimonialMatch = html.match(/data-vls-testimonials|vls-testimonial|testimonial-carousel/i);
  if (!testimonialMatch) return null;

  const sectionStart = html.indexOf(testimonialMatch[0]);
  const sectionHtml = html.slice(Math.max(0, sectionStart - 500), sectionStart + 120000);
  const cards: ScrapedTestimonialCard[] = [];

  const cardPattern = /<div[^>]*class="[^"]*testimonial[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
  for (const match of sectionHtml.matchAll(cardPattern)) {
    const cardHtml = match[1];
    const quote = stripTags(extractFirstMatch(cardHtml, /<p[^>]*>([\s\S]*?)<\/p>/i));
    const author = stripTags(extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>/i));
    const role = stripTags(extractFirstMatch(cardHtml, /<p[^>]*font-weight:600[^>]*>[\s\S]*?<\/p>\s*<p[^>]*>([\s\S]*?)<\/p>/i));
    if (quote) cards.push({ quote, author, role });
  }

  if (!cards.length) return null;

  return {
    eyebrow: stripTags(extractFirstMatch(sectionHtml, /<p[^>]*text-transform:uppercase[^>]*>([\s\S]*?)<\/p>/i)),
    titlePrefix: stripTags(extractFirstMatch(sectionHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i)),
    titleAccent: '',
    subtitle: stripTags(extractFirstMatch(sectionHtml, /<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i)),
    cards,
  };
}

function parsePromotion(html: string): ScrapedPromotionSection | null {
  const promoMatch = html.match(/data-vls-promotion|promotion-section|vls-promotion/i);
  if (!promoMatch) return null;

  const sectionStart = html.indexOf(promoMatch[0]);
  const sectionHtml = html.slice(Math.max(0, sectionStart - 200), sectionStart + 40000);
  const title = stripTags(extractFirstMatch(sectionHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i))
    || stripTags(extractFirstMatch(sectionHtml, /<p[^>]*font-weight:700[^>]*>([\s\S]*?)<\/p>/i));
  const subtitle = stripTags(extractFirstMatch(sectionHtml, /<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i));
  const ctaMatch = sectionHtml.match(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);

  if (!title && !subtitle) return null;
  return {
    title: title || 'Promotion',
    subtitle,
    ctaText: ctaMatch ? stripTags(ctaMatch[2]) : 'Sign Up',
    ctaUrl: ctaMatch?.[1] ?? '',
  };
}

function hasCourseFinderBanner(html: string): boolean {
  return /data-vls-course-finder-banner="1"/i.test(html);
}

function parseJsonLdCourse(html: string): { name: string; description: string; courseId: string } {
  const scripts = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const jsonText = script.replace(/<\/?script[^>]*>/gi, '').trim();
    try {
      const data = JSON.parse(jsonText) as {
        '@graph'?: Array<{ '@type'?: string; name?: string; description?: string; '@id'?: string }>;
        '@type'?: string;
        name?: string;
        description?: string;
        '@id'?: string;
      };
      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const course = nodes.find(node => node['@type'] === 'Course');
      if (!course) continue;
      return {
        name: String(course.name ?? '').trim(),
        description: String(course.description ?? '').trim(),
        courseId: String(course['@id'] ?? ''),
      };
    } catch {
      // ignore malformed JSON-LD blocks
    }
  }
  return { name: '', description: '', courseId: '' };
}

function inferCourseCode(slug: string, title: string): string {
  const fromTitle = title.match(/\b(FA1|FA2|MA1|MA2|FBT|FAB|FMA|FFA|SBL|SBR|AFM|APM|ATX|AAA|BA1|BA2|BA3|BA4|E1|P1|F1|E2|P2|F2|E3|P3|F3|BT|MA|FA|LW|PM|TX|FR|AA|FM)\b/i);
  if (fromTitle) return fromTitle[1].toUpperCase();
  return slug.toUpperCase().slice(0, 6);
}

function inferSlug(url: URL): string {
  const parts = url.pathname.split('/').filter(Boolean);
  const coursesIndex = parts.indexOf('courses');
  if (coursesIndex >= 0 && parts[coursesIndex + 1]) {
    return parts[coursesIndex + 1].toLowerCase().replace(/[^a-z0-9-]/g, '');
  }
  return parts[parts.length - 1]?.toLowerCase().replace(/[^a-z0-9-]/g, '') ?? 'course';
}

function inferZenlerCourseId(html: string): string {
  const thumbMatch = html.match(/contents\.newzenler\.com\/(\d+)\/courses\/(\d+)\//i);
  if (thumbMatch) return thumbMatch[2];
  const dataMatch = html.match(/data-course-id="(\d+)"/i);
  if (dataMatch) return dataMatch[1];
  return '';
}

function parseHeroVideoUrl(html: string): string | null {
  const tabsStart = html.search(/<div\b[^>]*data-vctabs="1"/i);
  const slice = tabsStart > 0 ? html.slice(0, tabsStart) : html.slice(0, 180000);
  const match = slice.match(/https?:\/\/player\.vimeo\.com\/video\/\d+[^"'\s]*/i);
  return match?.[0]?.trim() || null;
}

export async function scrapeCoursePage(sourceUrl: string): Promise<ScrapedCoursePage> {
  const url = await validateSiteUrl(sourceUrl, true);
  const normalizedUrl = toPublicOriginUrl(url);

  const html = await fetchPageHtml(sourceUrl);
  const slug = inferSlug(url);
  const title = meta(html, /<meta[^>]+property=["']og:title["'][^>]*>/i)
    || meta(html, /<title[^>]*>/i)
    || stripTags(extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const metaDescription = meta(html, /<meta[^>]+name=["']description["'][^>]*>/i)
    || meta(html, /<meta[^>]+property=["']og:description["'][^>]*>/i);
  const jsonLd = parseJsonLdCourse(html);
  const hero = parseHero(extractDivByIdPrefix(html, 'ch-'), normalizedUrl);
  const heroRight = parseHeroRight(extractDivByIdPrefix(html, 'chr-'));
  const courseDescription = parseCourseDescription(html);
  const tabs = parseTabs(html);
  const heroVideoUrl = parseHeroVideoUrl(html);
  const { faq, warnings: faqWarnings } = parseFaq(html);
  const testimonials = parseTestimonials(html);
  const promotion = parsePromotion(html);

  return {
    sourceUrl: normalizedUrl,
    slug,
    title: jsonLd.name || title,
    metaDescription: jsonLd.description || metaDescription,
    zenlerCourseId: inferZenlerCourseId(html),
    courseCode: inferCourseCode(slug, jsonLd.name || title),
    hero,
    heroRight,
    courseDescription,
    tabs,
    heroVideoUrl,
    faq,
    testimonials,
    promotion,
    hasCourseFinderBanner: hasCourseFinderBanner(html),
    schemaDescription: jsonLd.description,
    extractionWarnings: faqWarnings,
  };
}

export { parseTabPanelBlocks };

/** Exported for unit tests — parses course description blocks from full page HTML. */
export function parseCourseDescriptionFromHtml(html: string): ScrapedCourseDescription | null {
  return parseCourseDescription(html);
}
