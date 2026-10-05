import {
  findStoryBySlug,
  getStoryById,
  listStories,
  type StoryblokConfig,
  type StoryblokStoryRecord,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';

export function extractMultiCoursePaperZenlerIds(content: Record<string, unknown>): string[] {
  if (content.component !== 'multi_course_page') return [];
  const papers = content.paper_options;
  if (!Array.isArray(papers)) return [];
  const out: string[] = [];
  for (const paper of papers) {
    if (!paper || typeof paper !== 'object') continue;
    const row = paper as Record<string, unknown>;
    const id = zenlerIdFromComboStoryField(row.zenler_course_id);
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}

export function normalizeComboStorySlug(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

/** Zenler id stored on a combo page, including Storyblok datasource option objects. */
export function zenlerIdFromComboStoryField(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') {
    const id = String(value).trim();
    return /^\d+$/.test(id) ? id : '';
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const record = value as Record<string, unknown>;
  return zenlerIdFromComboStoryField(record.value) || zenlerIdFromComboStoryField(record.id);
}

/** Pricing Zenler course on a multi-course page. Paper options are not combo courses. */
export function comboPricingZenlerIdFromStoryContent(
  content: Record<string, unknown> | null | undefined,
): string {
  if (!content || content.component !== 'multi_course_page') return '';
  return zenlerIdFromComboStoryField(content.zenler_course_id);
}

export function comboZenlerIdsFromEnv(raw: string | null | undefined = process.env.COMBO_ZENLER_COURSE_IDS): string[] {
  const ids: string[] = [];
  for (const part of String(raw ?? '').split(/[\s,]+/)) {
    const id = part.trim();
    if (!/^\d+$/.test(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}

const COMBO_ID_CACHE_MS = 5 * 60 * 1000;
let comboPricingZenlerIdCache: { expires: number; ids: string[] } | null = null;

function uniqueZenlerIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const trimmed = id.trim();
    if (!/^\d+$/.test(trimmed) || out.includes(trimmed)) continue;
    out.push(trimmed);
  }
  return out;
}

async function storyContent(
  config: StoryblokConfig,
  story: StoryblokStoryRecord,
): Promise<Record<string, unknown> | null> {
  if (story.content && typeof story.content === 'object') return story.content;
  const loaded = await getStoryById(config, story.id);
  return loaded?.content ?? null;
}

/** Zenler IDs used as the price course on published multi-course pages. */
export async function loadComboPricingZenlerCourseIds(
  config?: StoryblokConfig | null,
): Promise<string[]> {
  const resolved = config === undefined ? resolveStoryblokConfigFromEnv() : config;
  if (!resolved) return [];

  const stories = await listStories(resolved, {
    contain_component: 'multi_course_page',
    per_page: 100,
  });
  const ids: string[] = [];
  for (const story of stories) {
    if (story.is_folder) continue;
    const id = comboPricingZenlerIdFromStoryContent(await storyContent(resolved, story));
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/**
 * Combo price courses configured in Storyblok, plus COMBO_ZENLER_COURSE_IDS.
 * A failed Storyblok read keeps the last successful list so checkout does not
 * forget which courses require a paper selection.
 */
export async function resolveConfiguredComboZenlerCourseIds(): Promise<string[]> {
  const fromEnv = comboZenlerIdsFromEnv();
  const now = Date.now();
  if (comboPricingZenlerIdCache && comboPricingZenlerIdCache.expires > now) {
    return uniqueZenlerIds([...fromEnv, ...comboPricingZenlerIdCache.ids]);
  }

  try {
    const fromStories = await loadComboPricingZenlerCourseIds();
    comboPricingZenlerIdCache = { expires: now + COMBO_ID_CACHE_MS, ids: fromStories };
    return uniqueZenlerIds([...fromEnv, ...fromStories]);
  } catch (err) {
    console.error('[multi-course] combo course id lookup failed', err);
    if (comboPricingZenlerIdCache) {
      return uniqueZenlerIds([...fromEnv, ...comboPricingZenlerIdCache.ids]);
    }
    return fromEnv;
  }
}

export async function loadMultiCourseStoryContent(
  comboStorySlug: string,
  config?: StoryblokConfig | null,
): Promise<Record<string, unknown> | null> {
  const slug = normalizeComboStorySlug(comboStorySlug);
  if (!slug) return null;

  const resolved = config ?? resolveStoryblokConfigFromEnv();
  if (!resolved) return null;

  const ref = await findStoryBySlug(resolved, slug);
  if (!ref?.id) return null;

  const story = await getStoryById(resolved, ref.id);
  return story?.content ?? null;
}

export async function resolveMultiCourseAllowlistFromStorySlug(
  comboStorySlug: string,
): Promise<{ allowlist: string[]; comboZenlerCourseId: string; selectionCount: number } | null> {
  const content = await loadMultiCourseStoryContent(comboStorySlug);
  if (!content || content.component !== 'multi_course_page') return null;

  const allowlist = extractMultiCoursePaperZenlerIds(content);
  const comboZenlerCourseId = zenlerIdFromComboStoryField(content.zenler_course_id);
  // Kept for older callers. Checkout allows any selection from 2 through the allowlist.
  const rawCount = Number(content.selection_count);
  const selectionCount = Number.isInteger(rawCount) && rawCount >= 1 ? rawCount : 2;

  return { allowlist, comboZenlerCourseId, selectionCount };
}
