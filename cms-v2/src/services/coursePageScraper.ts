import dns from 'dns/promises';
import net from 'net';
import type {
  ScrapedCourseDescription,
  ScrapedCoursePage,
  ScrapedFaqItem,
  ScrapedHero,
  ScrapedHeroRightItem,
  ScrapedLearnItem,
  ScrapedTabPanel,
} from '../../shared/migrationTypes';

const MAX_PAGE_BYTES = 4 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 45_000;
const FETCH_ATTEMPTS = 3;
const ALLOWED_HOSTS = new Set(['vls-online.com', 'www.vls-online.com', 'vls.newzenler.com']);

/** Zenler origin — faster and more reliable than vls-online.com via Cloudflare from serverless. */
function fetchOriginUrl(url: URL): URL {
  const fetchUrl = new URL(url.toString());
  const host = fetchUrl.hostname.toLowerCase();
  if (host === 'vls-online.com' || host === 'www.vls-online.com') {
    fetchUrl.hostname = 'vls.newzenler.com';
  }
  return fetchUrl;
}

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

async function validateCourseUrl(raw: string): Promise<URL> {
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
  if (!ALLOWED_HOSTS.has(host)) {
    throw new CoursePageScrapeError('Only vls-online.com course page URLs are allowed');
  }
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host) && isPrivateIp(host)) {
    throw new CoursePageScrapeError('Local and private network URLs are not allowed');
  }
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(address => isPrivateIp(address.address))) {
    throw new CoursePageScrapeError('URL resolves to a private or internal network address');
  }
  if (!parsed.pathname.includes('/courses/')) {
    throw new CoursePageScrapeError('URL must point to a course page (/courses/{slug})');
  }
  return parsed;
}

async function fetchCourseHtmlOnce(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (compatible; VLS-CMS-CourseMigration/1.1; +https://vls-online.com)',
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
      error instanceof Error ? error.message : 'Could not fetch course page',
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchCourseHtml(url: URL): Promise<string> {
  const fetchUrl = fetchOriginUrl(url);
  let lastError: unknown;

  for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt += 1) {
    try {
      return await fetchCourseHtmlOnce(fetchUrl);
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
    : new CoursePageScrapeError('Could not fetch course page', 502);
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

function parseHero(heroHtml: string): ScrapedHero | null {
  if (!heroHtml.trim()) return null;

  const breadcrumb = stripTags(extractFirstMatch(heroHtml, /<p[^>]*>([\s\S]*?)<\/p>/i));
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
  )) || "WHAT YOU'LL LEARN";

  const learnItems: ScrapedLearnItem[] = [];
  const learnCardPattern = /<div[^>]*display:grid[^>]*>[\s\S]*?<\/div>\s*<\/div>/i;
  const learnSection = heroHtml.match(learnCardPattern)?.[0] ?? heroHtml;
  const cardPattern = /<p[^>]*font-weight:600[^>]*>([\s\S]*?)<\/p>\s*(?:<p[^>]*>([\s\S]*?)<\/p>)?/gi;
  for (const match of learnSection.matchAll(cardPattern)) {
    const title = stripTags(match[1]);
    const subtitle = stripTags(match[2] ?? '');
    if (title && title !== learnLabel) learnItems.push({ title, subtitle });
  }

  if (!heading && !description) return null;

  return {
    breadcrumb,
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

function parseZenlerCourseDescription(descSlice: string): ScrapedCourseDescription | null {
  const cleaned = descSlice
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  const sections: Array<{ heading: string; html: string; text: string }> = [];
  const sectionPattern = /<p[^>]*font-size:\s*25px[^>]*>([\s\S]*?)<\/p>\s*(<p[^>]*>[\s\S]*?<\/p>)/gi;
  for (const match of cleaned.matchAll(sectionPattern)) {
    const heading = stripTags(match[1]);
    const html = match[2].trim();
    const text = stripTags(html);
    if (heading && text) sections.push({ heading, html, text });
  }

  if (sections.length) {
    return {
      icon: '📖',
      title: 'About This Course',
      introBold: sections[0]?.heading ?? '',
      introP1: sections[0]?.text ?? '',
      introP2: sections[1]?.text ?? '',
      bodyHtml: sections.slice(2).map(section => `<h3>${section.heading}</h3>${section.html}`).join('\n'),
      bodyText: sections.slice(2).map(section => `${section.heading}\n${section.text}`).join('\n\n'),
      source: 'zenler',
    };
  }

  const headings = extractAllMatches(cleaned, /<p[^>]*font-size:\s*25px[^>]*>([\s\S]*?)<\/p>/gi)
    .map(stripTags)
    .filter(Boolean);
  const paragraphs = extractAllMatches(cleaned, /<p[^>]*class="[^"]*dynamic-text[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
    .map(html => ({ html, text: stripTags(html) }))
    .filter(item => item.text.length > 40);

  if (!paragraphs.length) return null;

  return {
    icon: '📖',
    title: 'About This Course',
    introBold: headings[0] ?? '',
    introP1: paragraphs[0]?.text ?? '',
    introP2: paragraphs[1]?.text ?? '',
    bodyHtml: [
      ...headings.slice(2).map((heading, index) => `<h3>${heading}</h3>${paragraphs[index + 2]?.html ?? ''}`),
      ...paragraphs.slice(2 + Math.max(0, headings.length - 2)).map(item => item.html),
    ].filter(Boolean).join('\n'),
    bodyText: paragraphs.slice(2).map(item => item.text).join('\n\n'),
    source: 'zenler',
  };
}

function parseCourseDescription(html: string): ScrapedCourseDescription | null {
  const descSlice = findDescriptionSlice(html);
  if (!descSlice.trim()) return null;

  return parseCmsCourseDescription(descSlice) ?? parseZenlerCourseDescription(descSlice);
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

function parseFaqFromJsonLd(html: string): ScrapedCoursePage['faq'] | null {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)
    ?? html.match(/<script[^>]*>[\s\S]*?<\/script>/gi)
    ?? [];

  for (const script of scripts) {
    const jsonText = script.replace(/<\/?script[^>]*>/gi, '').trim();
    if (!jsonText.includes('FAQPage') || !jsonText.includes('mainEntity')) continue;
    try {
      const data = JSON.parse(jsonText) as {
        '@type'?: string;
        '@graph'?: Array<{
          '@type'?: string;
          mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
        }>;
        mainEntity?: Array<{ name?: string; acceptedAnswer?: { text?: string } }>;
      };

      const nodes = Array.isArray(data['@graph']) ? data['@graph'] : [data];
      const faqNode = nodes.find(node => node['@type'] === 'FAQPage');
      const mainEntity = faqNode?.mainEntity ?? (data['@type'] === 'FAQPage' ? data.mainEntity : undefined);
      if (!Array.isArray(mainEntity)) continue;

      const items = mainEntity
        .map(entity => ({
          question: String(entity.name ?? '').trim(),
          answerHtml: richTextParagraph(String(entity.acceptedAnswer?.text ?? '').trim()),
          answerText: String(entity.acceptedAnswer?.text ?? '').trim(),
        }))
        .filter(item => item.question);
      if (!items.length) continue;
      return { title: 'Frequently Asked Questions', icon: '❔', items };
    } catch {
      // ignore malformed FAQ JSON
    }
  }
  return null;
}

function richTextParagraph(text: string): string {
  return `<p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
}

function parseFaq(html: string): ScrapedCoursePage['faq'] {
  const fromJson = parseFaqFromJsonLd(html);
  if (fromJson) return fromJson;

  const uidMatch = html.match(/<div class="(vlsfaq[a-z0-9]+)"(?=[\s>])/i);
  if (!uidMatch) return null;

  const uid = uidMatch[1];
  const start = html.indexOf(uidMatch[0]);
  const faqHtml = html.slice(start, start + 250000);
  const title = stripTags(extractFirstMatch(faqHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i)) || 'Frequently Asked Questions';
  const icon = extractFirstMatch(faqHtml, /<span class="[^"]*-head-ico"[^>]*>([\s\S]*?)<\/span>/i);

  const items: ScrapedFaqItem[] = [];
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

export async function scrapeCoursePage(sourceUrl: string): Promise<ScrapedCoursePage> {
  const url = await validateCourseUrl(sourceUrl);
  const normalizedUrl = `https://vls-online.com${url.pathname.replace(/\/$/, '')}`;

  const html = await fetchCourseHtml(url);
  const slug = inferSlug(url);
  const title = meta(html, /<meta[^>]+property=["']og:title["'][^>]*>/i)
    || meta(html, /<title[^>]*>/i)
    || stripTags(extractFirstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i));
  const metaDescription = meta(html, /<meta[^>]+name=["']description["'][^>]*>/i)
    || meta(html, /<meta[^>]+property=["']og:description["'][^>]*>/i);
  const jsonLd = parseJsonLdCourse(html);
  const hero = parseHero(extractDivByIdPrefix(html, 'ch-'));
  const heroRight = parseHeroRight(extractDivByIdPrefix(html, 'chr-'));
  const courseDescription = parseCourseDescription(html);
  const tabs = parseTabs(html);
  const faq = parseFaq(html);

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
    faq,
    schemaDescription: jsonLd.description,
  };
}
