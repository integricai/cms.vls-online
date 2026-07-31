import type { ScrapedBlogImage, ScrapedBlogPost, ScrapedFaqItem } from '../../shared/migrationTypes';
import { CoursePageScrapeError, fetchPageHtml } from './coursePageScraper';
import { toPublicOriginUrl } from './migrationUrlUtils';
import { slugifySegment } from '../../shared/migrationDestination';

const STORYBLOK_TOPICS = [
  'ACCA',
  'CIMA',
  'CMA',
  'CIA',
  'Career Advice',
  'Exam Tips',
  'Finance',
  'Accounting',
  'Tax',
  'Audit',
  'Study Tips',
] as const;

type StoryblokTopic = (typeof STORYBLOK_TOPICS)[number];

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

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function attr(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
    ?? tag.match(new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*([^\\s>]+)`, 'i'));
  return decodeEntities(match?.[2] ?? match?.[1] ?? '').trim();
}

function meta(html: string, selector: RegExp): string {
  const match = html.match(selector);
  return match ? decodeEntities(attr(match[0], 'content') || attr(match[0], 'href')) : '';
}

function firstSrcsetUrl(value: string): string {
  return value.split(',')[0]?.trim().split(/\s+/)[0] || '';
}

function imageSource(tag: string): string {
  return attr(tag, 'src')
    || attr(tag, 'data-src')
    || attr(tag, 'data-lazy-src')
    || firstSrcsetUrl(attr(tag, 'srcset'))
    || firstSrcsetUrl(attr(tag, 'data-srcset'));
}

function canonicalUrl(raw: string, baseUrl: URL): string {
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw.trim();
  }
}

function extractBalancedElement(html: string, start: number, tagName: string): string {
  const pattern = new RegExp(`<\\/?${escapeRegExp(tagName)}\\b[^>]*>`, 'gi');
  pattern.lastIndex = start;
  let depth = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html))) {
    const tag = match[0];
    const isClosing = /^<\//.test(tag);
    const isSelfClosing = /\/>$/.test(tag);
    if (isClosing) {
      depth -= 1;
      if (depth === 0) return html.slice(start, pattern.lastIndex);
    } else if (!isSelfClosing) {
      depth += 1;
    }
  }
  return '';
}

function removeLayoutChrome(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '');
}

function chooseArticleHtml(html: string): string {
  const cleaned = removeLayoutChrome(html);
  const patterns: Array<{ regex: RegExp; priority: number }> = [
    { regex: /<article\b[^>]*>/gi, priority: 4 },
    { regex: /<(?:div|section)\b[^>]*(?:class|id)=["'][^"']*(?:article-content|post-content|entry-content|markdown|blog-post|post-body)[^"']*["'][^>]*>/gi, priority: 3 },
    { regex: /<(?:div|section)\b[^>]*(?:class|id)=["'][^"']*(?:post|article|blog|content|entry)[^"']*["'][^>]*>/gi, priority: 2 },
    { regex: /<main\b[^>]*>/gi, priority: 1 },
  ];
  const candidates: Array<{ html: string; priority: number }> = [];
  for (const pattern of patterns) {
    for (const match of cleaned.matchAll(pattern.regex)) {
      const tagName = match[0].match(/^<([a-z0-9-]+)/i)?.[1];
      const start = match.index ?? -1;
      if (!tagName || start < 0) continue;
      const candidate = extractBalancedElement(cleaned, start, tagName);
      if (candidate) candidates.push({ html: candidate, priority: pattern.priority });
    }
  }
  if (!candidates.length) return cleaned;
  return candidates.sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return stripTags(b.html).length - stripTags(a.html).length;
  })[0]?.html ?? cleaned;
}

function extractArticleBody(html: string): string {
  const patterns = [
    /<div\b[^>]*class=["'][^"']*article(?:\s|["']|$)[^"']*prose[^"']*["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*prose[^"']*["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*article-content[^"']*["'][^>]*>/i,
    /<div\b[^>]*class=["'][^"']*(?:post-content|entry-content|markdown)[^"']*["'][^>]*>/i,
    /<div\b[^>]*itemprop=["']articleBody["'][^>]*>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match || match.index === undefined) continue;
    const block = extractBalancedElement(html, match.index, 'div');
    if (!block) continue;
    const inner = block.replace(/^<div[^>]*>/i, '').replace(/<\/div>\s*$/i, '').trim();
    if (stripTags(inner).length >= 120) return inner;
  }
  return html;
}

function extractBackgroundImages(html: string, baseUrl: URL): ScrapedBlogImage[] {
  const images: ScrapedBlogImage[] = [];
  for (const match of html.matchAll(/style=["'][^"']*background-image\s*:[^"']*url\((['"]?)([^)'"]+)\1\)[^"']*["']/gi)) {
    const raw = match[2]?.trim();
    if (!raw || raw.startsWith('data:')) continue;
    const sourceUrl = canonicalUrl(raw, baseUrl);
    const nearby = html.slice(Math.max(0, (match.index ?? 0) - 160), (match.index ?? 0) + 160);
    const alt = nearby.match(/aria-label=["']([^"']+)["']/i)?.[1]?.trim() || '';
    images.push({
      sourceUrl,
      alt,
      kind: /featured-img|hero/i.test(nearby) ? 'featured' : 'inline',
    });
  }
  return images;
}

function extractImgTags(html: string, baseUrl: URL, kind: ScrapedBlogImage['kind']): ScrapedBlogImage[] {
  const images: ScrapedBlogImage[] = [];
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const raw = imageSource(tag);
    if (!raw || raw.startsWith('data:')) continue;
    images.push({
      sourceUrl: canonicalUrl(raw, baseUrl),
      alt: attr(tag, 'alt'),
      kind,
    });
  }
  return images;
}

function isScreenshotImageUrl(url: string): boolean {
  return /\/screenshots?\//i.test(url);
}

function isHeroImageUrl(url: string): boolean {
  return /\/hero_images?\//i.test(url) || /\/storage\/hero/i.test(url) || /\/thumb\//i.test(url);
}

function resolveFeaturedImageUrl(
  html: string,
  shellHtml: string,
  bodyHtml: string,
  baseUrl: URL,
  images: ScrapedBlogImage[],
): string {
  const metaImage = meta(html, /<meta\b[^>]*property=["']og:image["'][^>]*>/i)
    || meta(html, /<meta\b[^>]*name=["']twitter:image["'][^>]*>/i);
  if (metaImage && !isScreenshotImageUrl(metaImage)) return canonicalUrl(metaImage, baseUrl);

  const bgFeatured = extractBackgroundImages(shellHtml, baseUrl).find(image => image.kind === 'featured');
  if (bgFeatured) return bgFeatured.sourceUrl;

  const shellImages = extractImgTags(shellHtml, baseUrl, 'other');
  const bodyUrls = new Set(extractImgTags(bodyHtml, baseUrl, 'inline').map(image => image.sourceUrl));
  const hero = shellImages.find(image => isHeroImageUrl(image.sourceUrl))
    || shellImages.find(image => !bodyUrls.has(image.sourceUrl) && !isScreenshotImageUrl(image.sourceUrl));
  if (hero) return hero.sourceUrl;

  const fallback = images.find(image => image.kind === 'featured' || !isScreenshotImageUrl(image.sourceUrl));
  return fallback?.sourceUrl || '';
}

function sanitizeBodyHtml(html: string): string {
  const allowed = new Set([
    'section', 'div', 'span', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'strong', 'em', 'b', 'i', 'a', 'img', 'blockquote', 'br', 'figure', 'figcaption', 'hr', 'pre', 'code', 'details', 'summary',
  ]);
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '<h2>$1</h2>')
    .replace(/<\/?([a-z0-9-]+)\b([^>]*)>/gi, (tag, rawName: string) => {
      const name = rawName.toLowerCase();
      if (!allowed.has(name)) return '';
      if (tag.startsWith('</')) return `</${name}>`;
      if (name === 'br' || name === 'hr') return `<${name}>`;
      if (name === 'a') {
        const href = attr(tag, 'href');
        if (!/^https?:\/\//i.test(href) && !href.startsWith('/') && !href.startsWith('#')) return '<a>';
        return `<a href="${href.replace(/"/g, '&quot;')}">`;
      }
      if (name === 'img') {
        const src = imageSource(tag);
        if (!src) return '';
        return `<img src="${src.replace(/"/g, '&quot;')}" alt="${attr(tag, 'alt').replace(/"/g, '&quot;')}">`;
      }
      return `<${name}>`;
    })
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .trim();
}

function materializeBackgroundImages(html: string, baseUrl: URL): string {
  return html.replace(
    /<([a-z0-9-]+)([^>]*?)style=["']([^"']*background-image\s*:[^"']*url\((['"]?)([^)'"]+)\4\)[^"']*)["']([^>]*)>(?:\s*<\/\1>)?/gi,
    (full, tag: string, before: string, _style: string, _q: string, url: string, after: string) => {
      if (!url || url.startsWith('data:')) return full;
      const abs = canonicalUrl(url, baseUrl);
      const aria = attr(`x ${before} ${after}`, 'aria-label');
      const cls = attr(`x ${before} ${after}`, 'class');
      if (/featured-img/i.test(cls)) return ''; // featured image is a separate field
      return `<figure><img src="${abs}" alt="${(aria || '').replace(/"/g, '&quot;')}"></figure>`;
    },
  );
}

function stripNoiseFromBody(html: string, title: string): string {
  let next = html;
  const titleText = stripTags(title).toLowerCase();
  next = next.replace(/^(\s|<!--[\s\S]*?-->)*(<h[1-2]\b[^>]*>[\s\S]*?<\/h[1-2]>)/i, (match, _p, heading: string) => (
    stripTags(heading).toLowerCase() === titleText ? '' : match
  ));
  next = next
    .replace(/<div\b[^>]*class=["'][^"']*takeaways[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    // Plain H2/H3 "Key Takeaways" + following list — kept as the dedicated Storyblok field instead.
    .replace(
      /<h([2-4])\b[^>]*>\s*Key\s*Takeaways?\s*<\/h\1>\s*(?:<(?:ul|ol)\b[^>]*>[\s\S]*?<\/(?:ul|ol)>\s*)?/gi,
      '',
    )
    .replace(/<div\b[^>]*class=["'][^"']*(?:mid-cta|rail-cta|article-foot|share-row|post-meta|topic-pill)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div\b[^>]*class=["'][^"']*faq[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<h2\b[^>]*>\s*Frequently asked questions\s*<\/h2>/gi, '')
    .replace(/<h2\b[^>]*>\s*More Articles\s*<\/h2>[\s\S]*?(?=<h2\b|$)/gi, '')
    .replace(/<section\b[^>]*class=["'][^"']*related[^"']*["'][^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<h[2-4]\b[^>]*>\s*Want to create content like this\?\s*<\/h[2-4]>[\s\S]*?(?=<h[2-4]\b|$)/gi, '')
    .replace(/<p\b[^>]*>\s*(?:AutoSEO|Powered by AutoSEO|This article was shared from AutoSEO)[\s\S]*?<\/p>/gi, '');
  return next.trim();
}

function extractTakeaways(html: string): string[] {
  const block = html.match(/<div\b[^>]*class=["'][^"']*takeaways[^"']*["'][^>]*>[\s\S]*?<\/div>/i)?.[0]
    || html.match(/Key takeaways[\s\S]{0,40}<ul\b[^>]*>[\s\S]*?<\/ul>/i)?.[0]
    || '';
  if (!block) return [];
  return [...block.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map(match => stripTags(match[1]))
    .filter(Boolean)
    .slice(0, 12);
}

function extractFaqItems(html: string): ScrapedFaqItem[] {
  const items: ScrapedFaqItem[] = [];
  for (const match of html.matchAll(/<details\b[^>]*class=["'][^"']*qa[^"']*["'][^>]*>[\s\S]*?<\/details>/gi)) {
    const block = match[0];
    const question = stripTags(block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] || '');
    const answerHtml = block.match(/<div\b[^>]*class=["'][^"']*qa-body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
      || block.replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, '');
    const answerText = stripTags(answerHtml || '');
    if (question && answerText) {
      items.push({ question, answerHtml: answerHtml?.trim() || answerText, answerText });
    }
  }
  if (items.length) return items;

  // Schema.org FAQ fallback
  const scriptBlocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const script of scriptBlocks) {
    try {
      const data = JSON.parse(script[1]);
      const nodes = Array.isArray(data) ? data : [data];
      for (const node of nodes) {
        const graph = Array.isArray(node?.['@graph']) ? node['@graph'] : [node];
        for (const entry of graph) {
          if (entry?.['@type'] !== 'FAQPage') continue;
          for (const entity of entry.mainEntity || []) {
            const question = String(entity?.name || '').trim();
            const answerText = String(entity?.acceptedAnswer?.text || '').trim();
            if (question && answerText) {
              items.push({ question, answerHtml: answerText, answerText });
            }
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  return items.slice(0, 20);
}

function extractCta(
  html: string,
  selector: RegExp,
): ScrapedBlogPost['sidebarCta'] {
  const block = html.match(selector)?.[0];
  if (!block) return null;
  const heading = stripTags(block.match(/<h[3-4]\b[^>]*>([\s\S]*?)<\/h[3-4]>/i)?.[1]
    || block.match(/class=["'][^"']*mc-t[^"']*["'][^>]*>([\s\S]*?)</i)?.[1]
    || '');
  const text = stripTags(block.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i)?.[1]
    || block.match(/class=["'][^"']*mc-s[^"']*["'][^>]*>([\s\S]*?)</i)?.[1]
    || '');
  const linkTag = block.match(/<a\b[^>]*>[\s\S]*?<\/a>/i)?.[0] || '';
  const label = stripTags(linkTag);
  const link = attr(linkTag, 'href');
  if (!heading && !label) return null;
  return {
    heading: heading || label,
    text,
    label: label || 'Learn more',
    link: link && link !== '#' ? link : '/courses',
  };
}

function extractPublishedDate(html: string): string {
  const metaDate = meta(html, /<meta\b[^>]*(?:property|name)=["'](?:article:published_time|publishdate|date|datePublished)["'][^>]*>/i);
  if (metaDate) {
    const parsed = new Date(metaDate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    return metaDate;
  }
  const time = html.match(/<time\b[^>]*>/i);
  if (time) {
    const datetime = attr(time[0], 'datetime');
    if (datetime) {
      const parsed = new Date(datetime);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }
  const metaTxt = html.match(/class=["'][^"']*meta-txt[^"']*["'][^>]*>([^<]+)/i)?.[1];
  if (metaTxt) {
    const parsed = new Date(metaTxt.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return '';
}

function extractReadingTime(html: string): number | null {
  const match = html.match(/(\d+)\s*min(?:ute)?s?\s*read/i);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

function firstParagraph(html: string): string {
  const match = html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
  return match ? stripTags(match[1]).slice(0, 280) : stripTags(html).slice(0, 220);
}

function normalizeTopic(raw: string): StoryblokTopic | null {
  const value = raw.trim();
  if (!value) return null;
  const direct = STORYBLOK_TOPICS.find(topic => topic.toLowerCase() === value.toLowerCase());
  if (direct) return direct;
  if (/exam\s*prep/i.test(value)) return 'Exam Tips';
  if (/career/i.test(value)) return 'Career Advice';
  if (/study/i.test(value)) return 'Study Tips';
  return null;
}

function inferTopicAndTags(title: string, bodyText: string, sourceUrl: string, html: string): { topic: string; tags: string[] } {
  const section = meta(html, /<meta\b[^>]*property=["']article:section["'][^>]*>/i);
  const metaTags = [...html.matchAll(/<meta\b[^>]*property=["']article:tag["'][^>]*>/gi)]
    .map(match => normalizeTopic(attr(match[0], 'content')))
    .filter((value): value is StoryblokTopic => Boolean(value));

  const pill = stripTags(html.match(/class=["'][^"']*topic-pill[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] || '');
  const pillTopics = pill.split(/[·|,/]/).map(part => normalizeTopic(part)).filter((value): value is StoryblokTopic => Boolean(value));

  const haystack = `${title} ${sourceUrl} ${bodyText.slice(0, 4000)}`;
  const scores = new Map<StoryblokTopic, number>(STORYBLOK_TOPICS.map(topic => [topic, 0]));
  const bump = (topic: StoryblokTopic, points: number) => scores.set(topic, (scores.get(topic) || 0) + points);

  if (/\bacca\b/i.test(haystack)) bump('ACCA', 8);
  if (/\bcima\b/i.test(haystack)) bump('CIMA', 8);
  if (/\bcma\b/i.test(haystack)) bump('CMA', 7);
  if (/\bcia\b/i.test(haystack)) bump('CIA', 7);
  if (/\baccounting|accountant|ifrs|bookkeeping\b/i.test(haystack)) bump('Accounting', 4);
  if (/\bfinance|financial|investment|valuation\b/i.test(haystack)) bump('Finance', 4);
  if (/\btax|vat|hmrc\b/i.test(haystack)) bump('Tax', 5);
  if (/\baudit|assurance\b/i.test(haystack)) bump('Audit', 5);
  if (/\bstudy|revision|learning\b/i.test(haystack)) bump('Study Tips', 4);
  if (/\bexam|paper|pass|mock|mistakes\b/i.test(haystack)) bump('Exam Tips', 5);
  if (/\bcareer|job|interview|salary\b/i.test(haystack)) bump('Career Advice', 5);

  const topic = normalizeTopic(section)
    || pillTopics[0]
    || [...scores.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    || 'Study Tips';

  const tags = new Set<StoryblokTopic>([topic, ...pillTopics, ...metaTags]);
  for (const [candidate, score] of scores.entries()) {
    if (score >= 4) tags.add(candidate);
  }
  return { topic, tags: [...tags].slice(0, 8) };
}

function mergeImages(...groups: ScrapedBlogImage[][]): ScrapedBlogImage[] {
  const map = new Map<string, ScrapedBlogImage>();
  for (const group of groups) {
    for (const image of group) {
      const existing = map.get(image.sourceUrl);
      if (!existing || (existing.kind !== 'featured' && image.kind === 'featured')) {
        map.set(image.sourceUrl, image);
      }
    }
  }
  return [...map.values()];
}

function inferSlug(pathname: string, title: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const blogIndex = parts.findIndex(part => part.toLowerCase() === 'blog');
  const fromPath = blogIndex >= 0 ? parts.slice(blogIndex + 1).join('-') : parts[parts.length - 1];
  return slugifySegment(fromPath || title || 'post');
}

export function collectBlogScrapeWarnings(scraped: ScrapedBlogPost): string[] {
  const warnings = [...(scraped.extractionWarnings || [])];
  if (!scraped.featuredImageUrl) warnings.push('No featured image was found on the live blog post.');
  if (!scraped.bodyHtml || stripTags(scraped.bodyHtml).length < 120) {
    warnings.push('Article body looks thin — review the migrated richtext before publishing.');
  }
  if (!scraped.topic) warnings.push('Could not infer a Storyblok topic; defaulting may be required.');
  if (!scraped.images.length) warnings.push('No images were discovered in the blog post HTML.');
  return warnings;
}

export async function scrapeBlogPage(sourceUrl: string): Promise<ScrapedBlogPost> {
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl.trim());
  } catch {
    throw new CoursePageScrapeError('Invalid blog URL', 400);
  }

  const html = await fetchPageHtml(sourceUrl);
  const baseUrl = new URL(toPublicOriginUrl(parsed));
  const warnings: string[] = [];

  const title = stripTags(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || '')
    || meta(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i)
    || stripTags(html.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0] || '');
  if (!title) throw new CoursePageScrapeError('Blog post is missing a title', 422);

  const shell = chooseArticleHtml(html);
  const rawBody = extractArticleBody(shell);
  const withBgImages = materializeBackgroundImages(rawBody, baseUrl);
  const sanitized = sanitizeBodyHtml(withBgImages);
  const bodyHtml = stripNoiseFromBody(sanitized, title);
  if (stripTags(bodyHtml).length < 120) {
    throw new CoursePageScrapeError('Blog post body content could not be extracted', 422);
  }

  const keyTakeaways = extractTakeaways(shell) || extractTakeaways(html);
  const faqItems = extractFaqItems(shell).length ? extractFaqItems(shell) : extractFaqItems(html);
  const sidebarCta = extractCta(html, /<div\b[^>]*class=["'][^"']*rail-cta[^"']*["'][^>]*>[\s\S]*?<\/div>/i);
  const midCta = extractCta(html, /<div\b[^>]*class=["'][^"']*mid-cta[^"']*["'][^>]*>[\s\S]*?<\/div>/i);

  const bodyImages = [
    ...extractImgTags(bodyHtml, baseUrl, 'inline'),
    ...extractBackgroundImages(rawBody, baseUrl).map(image => ({ ...image, kind: 'inline' as const })),
  ];
  const shellImages = [
    ...extractImgTags(shell, baseUrl, 'other'),
    ...extractBackgroundImages(shell, baseUrl),
  ];
  const featuredImageUrl = resolveFeaturedImageUrl(html, shell, bodyHtml, baseUrl, mergeImages(bodyImages, shellImages));
  const images = mergeImages(
    featuredImageUrl ? [{ sourceUrl: featuredImageUrl, alt: title, kind: 'featured' }] : [],
    bodyImages,
    shellImages.filter(image => !isScreenshotImageUrl(image.sourceUrl)),
  );

  const excerpt = meta(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i)
    || meta(html, /<meta\b[^>]*name=["']description["'][^>]*>/i)
    || stripTags(html.match(/class=["'][^"']*post-excerpt[^"']*["'][^>]*>([\s\S]*?)</i)?.[1] || '')
    || firstParagraph(bodyHtml);

  const { topic, tags } = inferTopicAndTags(title, stripTags(bodyHtml), sourceUrl, html);
  if (!meta(html, /<meta\b[^>]*property=["']article:section["'][^>]*>/i) && !html.match(/topic-pill/i)) {
    warnings.push(`Inferred topic "${topic}" from article content.`);
  }

  return {
    kind: 'blog_post',
    sourceUrl: toPublicOriginUrl(parsed),
    slug: inferSlug(parsed.pathname, title),
    title,
    excerpt,
    metaTitle: meta(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i) || title,
    metaDescription: excerpt,
    topic,
    tags,
    featuredImageUrl,
    publishDate: extractPublishedDate(html),
    readingTimeMinutes: extractReadingTime(html),
    bodyHtml,
    keyTakeaways,
    faqItems,
    sidebarCta,
    midCta,
    images,
    extractionWarnings: warnings,
  };
}
