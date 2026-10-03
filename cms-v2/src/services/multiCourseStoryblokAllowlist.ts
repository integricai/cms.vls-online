import {
  findStoryBySlug,
  getStoryById,
  type StoryblokConfig,
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
    const id = String(row.zenler_course_id ?? '').trim();
    if (/^\d+$/.test(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function normalizeComboStorySlug(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
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
  const comboZenlerCourseId = String(content.zenler_course_id ?? '').trim();
  const rawCount = Number(content.selection_count);
  const selectionCount = Number.isInteger(rawCount) && rawCount >= 1 ? rawCount : 2;

  return { allowlist, comboZenlerCourseId, selectionCount };
}
