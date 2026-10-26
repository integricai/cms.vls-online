import { createHmac } from 'crypto';
import type { AutoseoArticleFields } from './blogPageScraper';
import { scrapedBlogPostFromAutoseo } from './blogPageScraper';
import { buildBlogPostStoryblokContent } from './buildBlogPostStoryblokContent';
import { localBlogPath, PUBLIC_SITE_ORIGIN } from './migrationUrlUtils';
import { getContent, upsertContent } from '../models/content';
import { secretEquals } from '../utils/secretEquals';
import { slugifySegment, storyFullSlug } from '../../shared/migrationDestination';
import {
  findStoryBySlug,
  StoryblokApiError,
  updateStoryById,
  upsertStory,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';

export const AUTOSEO_WEBHOOK_PATH = '/api/autoseo/webhook';
export const AUTOSEO_BLOG_IMPORTS_KEY = 'autoseo-blog-imports';

export interface AutoseoBlogImport {
  autoseoId: number;
  slug: string;
  storyId: number;
  fullSlug: string;
  updatedAt: string;
}

interface AutoseoBlogMap {
  imports: Record<string, AutoseoBlogImport>;
}

export type AutoseoParseResult =
  | { ok: true; kind: 'test' }
  | { ok: true; kind: 'skip'; autoseoId: number | null }
  | { ok: true; kind: 'article'; article: ParsedAutoseoArticle }
  | { ok: false; status: number; error: string };

export interface ParsedAutoseoArticle {
  id: number;
  title: string;
  requestedSlug: string;
  metaDescription: string;
  html: string;
  heroImageUrl: string;
  heroImageAlt: string;
  infographicImageUrl: string;
  keywords: string[];
  faq: Array<{ question: string; answer: string }>;
  publishedAt: string;
  assetBaseUrl: string;
}

export class AutoseoImportError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.status = status;
  }
}

export function vlsBlogUrl(slug?: string): string {
  if (!slug) return `${PUBLIC_SITE_ORIGIN}/blog`;
  return `${PUBLIC_SITE_ORIGIN}${localBlogPath(slug)}`;
}

export function verifyAutoseoSignature(rawBody: Buffer, header: string | undefined, secret: string): boolean {
  const provided = String(header || '').trim().replace(/^sha256=/i, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(provided)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return secretEquals(provided, expected);
}

export function verifyAutoseoBearer(header: string | undefined, secret: string): boolean {
  const match = String(header || '').match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return secretEquals(match[1].trim(), secret);
}

export function storyContentPointsAtAutoseo(content: unknown): boolean {
  return /https?:\/\/(?:[a-z0-9-]+\.)*getautoseo\.com/i.test(JSON.stringify(content ?? ''));
}

export function chooseAutoseoSlug(input: {
  requestedSlug: string;
  autoseoId: number;
  savedSlug?: string | null;
  slugTaken: boolean;
}): string {
  if (input.savedSlug) return input.savedSlug;
  if (!input.slugTaken) return input.requestedSlug;
  const suffix = `-${input.autoseoId}`;
  const base = input.requestedSlug.endsWith(suffix)
    ? input.requestedSlug
    : `${input.requestedSlug}${suffix}`;
  return base.slice(0, 110).replace(/-+$/g, '') || `post-${input.autoseoId}`;
}

function stringField(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function numericId(value: unknown): number | null {
  const id = typeof value === 'number'
    ? value
    : typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : NaN;
  if (!Number.isInteger(id) || id <= 0) return null;
  return id;
}

function stringList(...values: unknown[]): string[] {
  const items: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = String(item ?? '').trim();
        if (text) items.push(text);
      }
      continue;
    }
    if (typeof value === 'string') {
      for (const item of value.split(',')) {
        const text = item.trim();
        if (text) items.push(text);
      }
    }
  }
  return [...new Set(items)];
}

function faqList(value: unknown): Array<{ question: string; answer: string }> {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    const question = stringField(record.question);
    const answer = stringField(record.answer);
    if (!question || !answer) return [];
    return [{ question, answer }];
  }).slice(0, 20);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(text: string): string {
  const tokens: string[] = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    tokens.push(escapeHtml(text.slice(last, index)));
    if (match[2]) {
      tokens.push(`<img src="${escapeHtml(match[2])}" alt="${escapeHtml(match[1] || '')}">`);
    } else if (match[4]) {
      tokens.push(`<a href="${escapeHtml(match[4])}">${escapeHtml(match[3] || '')}</a>`);
    }
    last = index + match[0].length;
  }
  tokens.push(escapeHtml(text.slice(last)));
  return tokens.join('');
}

function markdownToHtml(markdown: string): string {
  const html: string[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (!paragraph.length) return;
    html.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  for (const line of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      flush();
      const level = Math.min(4, Math.max(2, heading[1].length));
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return html.join('\n');
}

function visibleTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
}

function articleHtml(record: Record<string, unknown>): string {
  const html = stringField(record.content_html);
  const markdown = stringField(record.content_markdown);
  if (visibleTextLength(html) >= 80) return html;
  if (markdown) return markdownToHtml(markdown);
  return html;
}

function isEnglish(language: string): boolean {
  if (!language) return true;
  return /^en(?:[-_]|$)/i.test(language);
}

function assetBaseFromPublishedUrl(value: unknown): string {
  const raw = stringField(value);
  if (!raw) return 'https://getautoseo.com/';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'https://getautoseo.com/';
    return `${url.origin}/`;
  } catch {
    return 'https://getautoseo.com/';
  }
}

export function parseAutoseoWebhook(body: unknown): AutoseoParseResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, status: 400, error: 'Webhook body must be a JSON object' };
  }

  const record = body as Record<string, unknown>;
  const event = stringField(record.event).toLowerCase();
  if (event === 'test') return { ok: true, kind: 'test' };

  const autoseoId = numericId(record.id);
  if (!isEnglish(stringField(record.languageCode))) {
    return { ok: true, kind: 'skip', autoseoId };
  }

  const title = stringField(record.title);
  const html = articleHtml(record);
  const requestedSlug = slugifySegment(stringField(record.slug) || title).slice(0, 100).replace(/-+$/g, '');
  if (!autoseoId || !title || !requestedSlug || visibleTextLength(html) < 80) {
    if (event && event !== 'article.published' && event !== 'article.updated') {
      return { ok: true, kind: 'skip', autoseoId };
    }
    return { ok: false, status: 400, error: 'Webhook article is missing an id, title, or body' };
  }

  return {
    ok: true,
    kind: 'article',
    article: {
      id: autoseoId,
      title,
      requestedSlug,
      metaDescription: stringField(record.metaDescription),
      html,
      heroImageUrl: stringField(record.heroImageUrl),
      heroImageAlt: stringField(record.heroImageAlt),
      infographicImageUrl: stringField(record.infographicImageUrl),
      keywords: stringList(record.keywords, record.metaKeywords, record.wordpressTags),
      faq: faqList(record.faqSchema),
      publishedAt: stringField(record.publishedAt) || stringField(record.createdAt),
      assetBaseUrl: assetBaseFromPublishedUrl(record.published_url),
    },
  };
}

function emptyMap(): AutoseoBlogMap {
  return { imports: {} };
}

function normalizeMap(value: unknown): AutoseoBlogMap {
  const data = typeof value === 'string'
    ? (() => {
      try {
        return JSON.parse(value) as unknown;
      } catch {
        return null;
      }
    })()
    : value;
  if (!data || typeof data !== 'object') return emptyMap();
  const imports = (data as { imports?: unknown }).imports;
  if (!imports || typeof imports !== 'object' || Array.isArray(imports)) return emptyMap();
  return { imports: imports as Record<string, AutoseoBlogImport> };
}

async function loadAutoseoBlogMap(): Promise<AutoseoBlogMap> {
  const row = await getContent(AUTOSEO_BLOG_IMPORTS_KEY);
  return normalizeMap(row?.data);
}

async function saveAutoseoBlogImport(entry: AutoseoBlogImport): Promise<void> {
  const map = await loadAutoseoBlogMap();
  map.imports[String(entry.autoseoId)] = entry;
  await upsertContent(AUTOSEO_BLOG_IMPORTS_KEY, map);
}

function articleFields(article: ParsedAutoseoArticle, slug: string): AutoseoArticleFields {
  return {
    id: article.id,
    title: article.title,
    slug,
    metaDescription: article.metaDescription,
    html: article.html,
    heroImageUrl: article.heroImageUrl,
    heroImageAlt: article.heroImageAlt,
    infographicImageUrl: article.infographicImageUrl,
    keywords: article.keywords,
    faq: article.faq,
    publishedAt: article.publishedAt,
    assetBaseUrl: article.assetBaseUrl,
  };
}

export async function importAutoseoArticle(
  article: ParsedAutoseoArticle,
): Promise<{ url: string; created: boolean; slug: string; warnings: string[] }> {
  const config = resolveStoryblokConfigFromEnv();
  if (!config) throw new Error('Storyblok is not configured');

  const map = await loadAutoseoBlogMap();
  const saved = map.imports[String(article.id)] ?? null;
  const requestedFullSlug = storyFullSlug('blog', article.requestedSlug);
  const takenInMap = Object.values(map.imports).some(item =>
    item.slug === article.requestedSlug && item.autoseoId !== article.id
  );
  const existingStory = saved || takenInMap
    ? null
    : await findStoryBySlug(config, requestedFullSlug);
  const slug = chooseAutoseoSlug({
    requestedSlug: article.requestedSlug,
    autoseoId: article.id,
    savedSlug: saved?.slug,
    slugTaken: takenInMap || Boolean(existingStory),
  });

  const post = scrapedBlogPostFromAutoseo(articleFields(article, slug));
  if (!post.featuredImageUrl) {
    throw new AutoseoImportError('Article has no image to store', 400);
  }

  const built = await buildBlogPostStoryblokContent(post, config);
  const featured = built.content.featured_image;
  const featuredName = featured && typeof featured === 'object'
    ? String((featured as { filename?: unknown }).filename || '')
    : '';
  if (!featuredName || /getautoseo\.com/i.test(featuredName)) {
    throw new Error(`Featured image could not be stored in Storyblok. ${built.warnings.join(' ')}`.trim());
  }
  if (storyContentPointsAtAutoseo(built.content)) {
    throw new Error('Draft still contains an AutoSEO URL');
  }

  const fullSlug = storyFullSlug('blog', slug);
  let storyId = saved?.storyId ?? 0;
  let created = false;

  if (storyId) {
    try {
      const updated = await updateStoryById(config, storyId, {
        name: post.title,
        slug,
        parentId: built.parentFolderId,
        content: built.content,
        publish: false,
      });
      storyId = updated.id;
    } catch (err) {
      if (!(err instanceof StoryblokApiError) || err.status !== 404) throw err;
      storyId = 0;
    }
  }

  if (!storyId) {
    const upsert = await upsertStory(config, {
      name: post.title,
      slug,
      parentId: built.parentFolderId,
      fullSlug,
      content: built.content,
      publish: false,
    });
    storyId = upsert.story.id;
    created = upsert.created;
  }

  await saveAutoseoBlogImport({
    autoseoId: article.id,
    slug,
    storyId,
    fullSlug,
    updatedAt: new Date().toISOString(),
  });

  return {
    url: vlsBlogUrl(slug),
    created,
    slug,
    warnings: built.warnings,
  };
}
