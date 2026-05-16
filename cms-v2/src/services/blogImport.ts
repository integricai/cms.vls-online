import dns from 'dns/promises';
import net from 'net';
import path from 'path';
import { put } from '@vercel/blob';
import type { BlogImage, BlogPost } from '../models/blog';

const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 12000;
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'svg']);
const IMAGE_TYPES = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/svg+xml', 'svg'],
]);

const TOPICS = [
  'ACCA',
  'Accounting',
  'Finance',
  'Tax',
  'Audit',
  'Study Tips',
  'Exam Preparation',
  'Career Advice',
];

const TAG_RULES: Array<[string, RegExp]> = [
  ['ACCA', /\bacca\b/i],
  ['AFM', /\bafm\b|advanced financial management/i],
  ['Strategic Professional', /strategic professional/i],
  ['Exam Tips', /\bexam\b|paper|pass|passing|revision|mistakes/i],
  ['Finance', /\bfinance|financial|investment|valuation|risk\b/i],
  ['Tax', /\btax|vat|corporation tax|hmrc\b/i],
  ['Audit', /\baudit|assurance|controls?\b/i],
  ['Accounting', /\baccounting|accountant|accounts?|ifrs|bookkeeping\b/i],
  ['Study Tips', /\bstudy|revision|learning|practice|mock\b/i],
  ['Career Advice', /\bcareer|job|interview|salary|promotion\b/i],
];

export interface ImportRequest {
  sourceUrl: string;
  topicOverride?: string;
  slugOverride?: string;
  status?: 'draft' | 'published';
  existingPosts: BlogPost[];
  replacePostId?: string;
}

export interface ImportResult {
  post: BlogPost;
  warnings: string[];
}

interface ScrapedImage {
  sourceUrl: string;
  alt: string;
}

interface ScrapedPost {
  title: string;
  metaTitle: string;
  metaDescription: string;
  bodyHtml: string;
  summary: string;
  featuredImageUrl: string;
  images: ScrapedImage[];
  canonicalUrl: string;
  author: string;
  publishDate: string;
}

class ImportError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export class BlogImportError extends ImportError {}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 110) || `blog-${Date.now().toString(36)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  const match = tag.match(new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*(["'])(.*?)\\1`, 'i'))
    ?? tag.match(new RegExp(`\\s${escapeRegExp(name)}\\s*=\\s*([^\\s>]+)`, 'i'));
  return decodeEntities(match?.[2] ?? match?.[1] ?? '').trim();
}

function meta(html: string, selector: RegExp): string {
  const match = html.match(selector);
  return match ? decodeEntities(attr(match[0], 'content') || attr(match[0], 'href')) : '';
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

async function validatePublicUrl(raw: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new BlogImportError('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new BlogImportError('Only http and https URLs are allowed');
  }
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host) && isPrivateIp(host)) {
    throw new BlogImportError('Local and private network URLs are not allowed');
  }
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some(address => isPrivateIp(address.address))) {
    throw new BlogImportError('URL resolves to a private or internal network address');
  }
  return parsed;
}

async function fetchWithLimit(url: URL, maxBytes: number): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  let current = url;
  for (let redirect = 0; redirect < 5; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'User-Agent': 'VLS CMS Blog Importer/1.0' },
      });
    } catch {
      throw new BlogImportError('URL not reachable or request timed out', 502);
    } finally {
      clearTimeout(timeout);
    }

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new BlogImportError('Redirect response did not include a destination', 502);
      current = await validatePublicUrl(new URL(location, current).toString());
      continue;
    }

    if (!response.ok || !response.body) {
      throw new BlogImportError(`URL returned HTTP ${response.status}`, 502);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) throw new BlogImportError('Downloaded content is too large');
      chunks.push(value);
    }
    return {
      buffer: Buffer.concat(chunks.map(chunk => Buffer.from(chunk))),
      contentType: response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() || '',
      finalUrl: current.toString(),
    };
  }
  throw new BlogImportError('Too many redirects', 502);
}

function removeLayout(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, '')
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, '')
    .replace(/<header\b[\s\S]*?<\/header>/gi, '')
    .replace(/<footer\b[\s\S]*?<\/footer>/gi, '')
    .replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
    .replace(/<aside\b[\s\S]*?<\/aside>/gi, '')
    .replace(/<form\b[\s\S]*?<\/form>/gi, '')
    .replace(/<[^>]+(?:cookie|share|social|related|advert|sidebar)[^>]*>[\s\S]*?<\/[^>]+>/gi, '');
}

function chooseArticleHtml(html: string): string {
  const cleaned = removeLayout(html);
  const candidates: string[] = [];
  const patterns = [
    /<article\b[\s\S]*?<\/article>/gi,
    /<main\b[\s\S]*?<\/main>/gi,
    /<(?:section|div)\b[^>]*(?:class|id)=["'][^"']*(?:post|article|blog|content|entry)[^"']*["'][^>]*>[\s\S]*?<\/(?:section|div)>/gi,
  ];
  for (const pattern of patterns) {
    const matches = cleaned.match(pattern);
    if (matches) candidates.push(...matches);
  }
  if (!candidates.length) return cleaned;
  return candidates.sort((a, b) => stripTags(b).length - stripTags(a).length)[0] ?? cleaned;
}

function sanitizeHtml(html: string): string {
  const allowed = new Set(['h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'strong', 'em', 'b', 'i', 'a', 'img', 'blockquote', 'br', 'figure', 'figcaption']);
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '<h2>$1</h2>')
    .replace(/<\/?([a-z0-9-]+)\b([^>]*)>/gi, (tag, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      if (!allowed.has(name)) return '';
      if (tag.startsWith('</')) return `</${name}>`;
      if (name === 'br') return '<br>';
      if (name === 'a') {
        const href = attr(tag, 'href');
        if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) return '<a>';
        return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">`;
      }
      if (name === 'img') {
        const src = attr(tag, 'src');
        if (!src) return '';
        return `<img src="${escapeHtml(src)}" alt="${escapeHtml(attr(tag, 'alt'))}">`;
      }
      if (['td', 'th'].includes(name)) {
        const colspan = attr(`<x ${rawAttrs}>`, 'colspan').replace(/[^0-9]/g, '');
        const rowspan = attr(`<x ${rawAttrs}>`, 'rowspan').replace(/[^0-9]/g, '');
        return `<${name}${colspan ? ` colspan="${colspan}"` : ''}${rowspan ? ` rowspan="${rowspan}"` : ''}>`;
      }
      return `<${name}>`;
    })
    .replace(/\son[a-z]+\s*=\s*(["']).*?\1/gi, '')
    .replace(/\sstyle\s*=\s*(["']).*?\1/gi, '')
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function extractImages(html: string, baseUrl: URL): ScrapedImage[] {
  const images = new Map<string, ScrapedImage>();
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    const raw = attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-lazy-src');
    if (!raw || raw.startsWith('data:')) continue;
    try {
      const sourceUrl = new URL(raw, baseUrl).toString();
      images.set(sourceUrl, { sourceUrl, alt: attr(tag, 'alt') });
    } catch {
      continue;
    }
  }
  return [...images.values()];
}

function replaceImageSources(html: string, replacements: Map<string, string>, baseUrl: URL): string {
  return html.replace(/<img\b[^>]*>/gi, tag => {
    const raw = attr(tag, 'src') || attr(tag, 'data-src') || attr(tag, 'data-lazy-src');
    if (!raw) return tag;
    let absolute = '';
    try {
      absolute = new URL(raw, baseUrl).toString();
    } catch {
      return tag;
    }
    const local = replacements.get(absolute);
    if (!local) return '';
    const alt = attr(tag, 'alt');
    return `<img src="${escapeHtml(local)}" alt="${escapeHtml(alt)}">`;
  });
}

function extractPublishedDate(html: string): string {
  const metaDate = meta(html, /<meta\b[^>]*(?:property|name)=["'](?:article:published_time|publishdate|date|datePublished)["'][^>]*>/i);
  if (metaDate) return metaDate;
  const time = html.match(/<time\b[^>]*>/i);
  return time ? attr(time[0], 'datetime') : '';
}

function scrapeHtml(html: string, baseUrl: URL): ScrapedPost {
  const title = stripTags(html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i)?.[0] || '')
    || meta(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i)
    || stripTags(html.match(/<title\b[^>]*>[\s\S]*?<\/title>/i)?.[0] || '');
  if (!title) throw new BlogImportError('Missing title');

  const articleHtml = chooseArticleHtml(html);
  const sanitized = sanitizeHtml(articleHtml);
  const bodyText = stripTags(sanitized);
  if (bodyText.length < 180) throw new BlogImportError('Missing body content');

  const canonical = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i);
  const images = extractImages(articleHtml, baseUrl);
  const featuredImageUrl = meta(html, /<meta\b[^>]*property=["']og:image["'][^>]*>/i)
    || meta(html, /<meta\b[^>]*name=["']twitter:image["'][^>]*>/i)
    || images[0]?.sourceUrl
    || '';

  return {
    title,
    metaTitle: meta(html, /<meta\b[^>]*property=["']og:title["'][^>]*>/i) || title,
    metaDescription: meta(html, /<meta\b[^>]*name=["']description["'][^>]*>/i)
      || meta(html, /<meta\b[^>]*property=["']og:description["'][^>]*>/i)
      || bodyText.slice(0, 160),
    bodyHtml: sanitized,
    summary: bodyText.slice(0, 220),
    featuredImageUrl,
    images,
    canonicalUrl: canonical ? new URL(attr(canonical[0], 'href'), baseUrl).toString() : baseUrl.toString(),
    author: meta(html, /<meta\b[^>]*name=["']author["'][^>]*>/i)
      || meta(html, /<meta\b[^>]*property=["']article:author["'][^>]*>/i),
    publishDate: extractPublishedDate(html),
  };
}

function inferTopicAndTags(scraped: ScrapedPost, sourceUrl: string, override?: string): { topic: string; tags: string[] } {
  const haystack = `${scraped.title} ${sourceUrl} ${stripTags(scraped.bodyHtml).slice(0, 4000)}`;
  const score = new Map(TOPICS.map(topic => [topic, 0]));
  const add = (topic: string, points: number) => score.set(topic, (score.get(topic) || 0) + points);
  if (/\bacca\b/i.test(haystack)) add('ACCA', 8);
  if (/\baccounting|accountant|ifrs|bookkeeping\b/i.test(haystack)) add('Accounting', 4);
  if (/\bfinance|financial|afm|investment|valuation\b/i.test(haystack)) add('Finance', 4);
  if (/\btax|vat|hmrc\b/i.test(haystack)) add('Tax', 5);
  if (/\baudit|assurance\b/i.test(haystack)) add('Audit', 5);
  if (/\bstudy|revision|learning\b/i.test(haystack)) add('Study Tips', 4);
  if (/\bexam|paper|pass|mock|mistakes\b/i.test(haystack)) add('Exam Preparation', 5);
  if (/\bcareer|job|interview\b/i.test(haystack)) add('Career Advice', 5);

  const topic = override?.trim() || [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'Study Tips';
  const tags = new Set<string>([topic]);
  for (const [tag, pattern] of TAG_RULES) {
    if (pattern.test(haystack)) tags.add(tag);
  }
  return { topic, tags: [...tags].slice(0, 8) };
}

function cleanImageFilename(url: URL, fallback: string, contentType: string): string {
  const parsedName = path.basename(url.pathname).split('?')[0] || fallback;
  const base = slugify(parsedName.replace(/\.[a-z0-9]+$/i, '')) || fallback;
  const extFromPath = (parsedName.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
  const ext = IMAGE_EXTS.has(extFromPath) ? extFromPath : IMAGE_TYPES.get(contentType) || 'jpg';
  return `${base}.${ext}`;
}

async function storeImage(image: ScrapedImage, slug: string, index: number, existing: Map<string, BlogImage>): Promise<BlogImage> {
  const reused = existing.get(image.sourceUrl);
  if (reused) return reused;

  const url = await validatePublicUrl(image.sourceUrl);
  const downloaded = await fetchWithLimit(url, MAX_IMAGE_BYTES);
  const contentType = downloaded.contentType;
  if (!IMAGE_TYPES.has(contentType)) {
    throw new BlogImportError(`Unsupported image type for ${image.sourceUrl}`);
  }
  if (contentType === 'image/svg+xml') {
    const svg = downloaded.buffer.toString('utf8');
    if (/<script\b|on[a-z]+\s*=|<foreignObject\b/i.test(svg)) {
      throw new BlogImportError(`Unsafe SVG skipped: ${image.sourceUrl}`);
    }
  }

  const filename = cleanImageFilename(url, `image-${index + 1}`, contentType);
  const pathname = `cms/blog/${slug}/${index + 1}-${filename}`;
  const result = await put(pathname, downloaded.buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType,
  });
  return {
    sourceUrl: image.sourceUrl,
    localPath: result.url,
    alt: image.alt,
    contentType,
  };
}

export async function importBlogPost(request: ImportRequest): Promise<ImportResult> {
  const sourceUrl = (await validatePublicUrl(request.sourceUrl)).toString();
  const downloaded = await fetchWithLimit(new URL(sourceUrl), MAX_PAGE_BYTES);
  if (!downloaded.contentType.includes('text/html') && downloaded.contentType !== '') {
    throw new BlogImportError('URL did not return an HTML page');
  }

  const baseUrl = new URL(downloaded.finalUrl);
  const scraped = scrapeHtml(downloaded.buffer.toString('utf8'), baseUrl);
  const slug = slugify(request.slugOverride || scraped.title);
  const existingImages = new Map<string, BlogImage>();
  for (const post of request.existingPosts) {
    for (const image of post.images || []) existingImages.set(image.sourceUrl, image);
  }

  const imageInputs = new Map(scraped.images.map(image => [image.sourceUrl, image]));
  if (scraped.featuredImageUrl && !imageInputs.has(scraped.featuredImageUrl)) {
    imageInputs.set(scraped.featuredImageUrl, { sourceUrl: scraped.featuredImageUrl, alt: scraped.title });
  }

  const storedImages: BlogImage[] = [];
  const replacements = new Map<string, string>();
  const warnings: string[] = [];
  let imageIndex = 0;
  for (const image of imageInputs.values()) {
    try {
      const stored = await storeImage(image, slug, imageIndex, existingImages);
      storedImages.push(stored);
      replacements.set(image.sourceUrl, stored.localPath);
      imageIndex += 1;
    } catch (err) {
      warnings.push(err instanceof Error ? err.message : `Image download failed: ${image.sourceUrl}`);
    }
  }

  const { topic, tags } = inferTopicAndTags(scraped, sourceUrl, request.topicOverride);
  const now = new Date().toISOString();
  const replacedBody = replaceImageSources(scraped.bodyHtml, replacements, baseUrl);
  const cleanBody = sanitizeHtml(replacedBody);
  const existingPost = request.replacePostId
    ? request.existingPosts.find(post => post.id === request.replacePostId)
    : undefined;

  const featuredImagePath = scraped.featuredImageUrl
    ? replacements.get(scraped.featuredImageUrl) || ''
    : storedImages[0]?.localPath || '';

  return {
    warnings,
    post: {
      id: existingPost?.id || `blog-${Date.now().toString(36)}`,
      title: scraped.title,
      slug,
      topic,
      tags,
      summary: scraped.summary,
      bodyHtml: cleanBody,
      featuredImagePath,
      images: storedImages,
      originalSourceUrl: sourceUrl,
      canonicalUrl: scraped.canonicalUrl,
      metaTitle: scraped.metaTitle,
      metaDescription: scraped.metaDescription,
      author: scraped.author,
      publishDate: scraped.publishDate,
      createdDate: existingPost?.createdDate || now,
      updatedDate: now,
      status: request.status || existingPost?.status || 'published',
    },
  };
}
