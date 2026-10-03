import { listCourses } from '../models/course';
import { fetchPageHtml } from './coursePageScraper';
import {
  getStoryById,
  listStories,
  type StoryblokConfig,
  updateStoryById,
} from './storyblokClient';
import { zenlerIdFromStoryContent } from './courseSalesPageUrlSync';
import { inferZenlerCourseIdFromHtml } from './zenlerCourseId';

const CURRICULUM_COMPONENTS = new Set(['course_curriculum', 'zenler_curriculum']);

export type NotesCurriculumPatchAction = 'filled' | 'replaced' | 'inserted' | 'unchanged';

export type NotesCurriculumBackfillResult = {
  scanned: number;
  updated: number;
  skipped: number;
  failed: number;
  stories: Array<{
    fullSlug: string;
    action: NotesCurriculumPatchAction | 'skipped' | 'failed';
    zenlerCourseId?: string;
    message?: string;
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const NOTES_HUB_SLUGS = new Set([
  'acca-notes',
  'cima-notes',
  'cma-notes',
]);

const ZENLER_NOTES_SLUG_HINTS: Array<[RegExp, string]> = [
  [/advanced-audit|\baaa\b/, 'aaanotes'],
  [/strat(?:e|a)gic-business-leader|\bsbl\b/, 'sblnotes'],
  [/strategic-business-reporting|\bsbr\b/, 'sbrnotes'],
  [/advanced-financial-management|\bafm\b/, 'afmnotes'],
  [/advanced-perfomance-management|advanced-performance-management|\bapm\b/, 'apmnotes'],
  [/\bifrs\b|dipifr|dip-ifr/, 'ifrsnotes'],
  [/cma-part-?1|\bcma1\b/, 'cma1notes'],
  [/cma-part-?2|\bcma2\b/, 'cma2notes'],
  [/business-and-technology|business-technology|\bbt\b/, 'btnotes'],
  [/\bacca-ma-|\bma-management-accounting/, 'f2notes'],
];

export function isNotesCourseStorySlug(fullSlug: string): boolean {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '');
  if (!/(?:^|\/)courses\/[^/]*notes(?:\/|$)/i.test(slug)) return false;
  return !NOTES_HUB_SLUGS.has(notesSlugFromStorySlug(slug));
}

export function notesSlugFromStorySlug(fullSlug: string): string {
  const parts = fullSlug.replace(/^\/+|\/+$/g, '').split('/');
  return parts[parts.length - 1] || '';
}

export function candidateZenlerNotesSlugs(slug: string): string[] {
  const cleaned = slug.toLowerCase().replace(/^\/+|\/+$/g, '');
  const preferred: string[] = [];
  const fallback: string[] = [];

  const add = (value: string, first = false) => {
    if (!value) return;
    if (first) preferred.push(value);
    else fallback.push(value);
  };

  for (const [pattern, mapped] of ZENLER_NOTES_SLUG_HINTS) {
    if (pattern.test(cleaned)) add(mapped, true);
  }

  const cimaPaper = cleaned.match(/\b(e[1-3]|p[1-3]|f[1-3]|ba[1-4])\b/);
  if (cimaPaper && /cima/.test(cleaned)) add(`cima${cimaPaper[1]}notes`, true);

  const accaPaper = cleaned.match(/\b(fa[12]|ma[12]|f[1-9])\b/);
  if (accaPaper && !/cima/.test(cleaned)) add(`${accaPaper[1]}notes`, true);

  const compact = cleaned.replace(/-/g, '');
  if (compact.endsWith('notes')) add(compact);
  add(cleaned);

  return [...new Set([...preferred, ...fallback])];
}

export function buildNotesCurriculumBlok(zenlerCourseId: string): Record<string, unknown> {
  return {
    _uid: blokUid(),
    component: 'course_curriculum',
    course_id: zenlerCourseId,
    zenler_course_id: zenlerCourseId,
    eyebrow: 'Course content',
    heading_prefix: 'A clear path through the',
    heading_accent: 'full syllabus.',
    section_title: 'Course Content',
    show_lesson_durations: true,
  };
}

export function isNotesContentsFallbackBlok(blok: Record<string, unknown>): boolean {
  if (blok.component !== 'feature_cards_v2') return false;
  const cards = Array.isArray(blok.cards) ? blok.cards : [];
  const text = cards
    .map((card) => {
      const rec = asRecord(card);
      return rec ? `${rec.title ?? ''} ${rec.description ?? ''} ${rec.cta_text ?? ''}` : '';
    })
    .join(' ')
    .toLowerCase();
  return /sample notes|complete notes|buy to unlock|free preview/.test(text);
}

function applyZenlerIdToHero(blok: Record<string, unknown>, zenlerCourseId: string): boolean {
  if (blok.component !== 'course_hero_layout') return false;
  const left = Array.isArray(blok.left) ? blok.left : [];
  let changed = false;
  for (const child of left) {
    const hero = asRecord(child);
    if (!hero || hero.component !== 'course_hero') continue;
    if (String(hero.zenler_course_id ?? '').trim() !== zenlerCourseId) {
      hero.zenler_course_id = zenlerCourseId;
      changed = true;
    }
  }
  return changed;
}

export function patchNotesStoryCurriculum(
  content: Record<string, unknown>,
  zenlerCourseId: string,
): { content: Record<string, unknown>; changed: boolean; action: NotesCurriculumPatchAction } {
  const id = zenlerCourseId.trim();
  if (!id) return { content, changed: false, action: 'unchanged' };

  const next = structuredClone(content) as Record<string, unknown>;
  const body = Array.isArray(next.body) ? [...(next.body as Record<string, unknown>[])] : [];
  next.body = body;
  let changed = false;
  let action: NotesCurriculumPatchAction = 'unchanged';

  for (const blok of body) {
    if (applyZenlerIdToHero(blok, id)) changed = true;
  }

  const existingCurriculum = body.find(blok =>
    CURRICULUM_COMPONENTS.has(String(blok.component ?? '')),
  );
  if (existingCurriculum) {
    if (String(existingCurriculum.zenler_course_id ?? '').trim() !== id) {
      existingCurriculum.zenler_course_id = id;
      changed = true;
      action = 'filled';
    }
    if (String(existingCurriculum.course_id ?? '').trim() !== id) {
      existingCurriculum.course_id = id;
      changed = true;
      action = 'filled';
    }
    return { content: next, changed, action: changed ? action : 'unchanged' };
  }

  const curriculum = buildNotesCurriculumBlok(id);
  const fallbackIndex = body.findIndex(isNotesContentsFallbackBlok);
  if (fallbackIndex >= 0) {
    body.splice(fallbackIndex, 1, curriculum);
    return { content: next, changed: true, action: 'replaced' };
  }

  const heroIndex = body.findIndex(blok =>
    blok.component === 'course_hero_layout' || String(blok.component ?? '').includes('hero'),
  );
  body.splice(heroIndex >= 0 ? heroIndex + 1 : 0, 0, curriculum);
  return { content: next, changed: true, action: 'inserted' };
}

async function zenlerIdFromCmsSlug(slug: string): Promise<string> {
  if (!slug) return '';
  try {
    const courses = await listCourses();
    const slugs = candidateZenlerNotesSlugs(slug);
    return courses.find(course => course.slug && slugs.includes(course.slug))?.zenlerCourseId?.trim() ?? '';
  } catch {
    return '';
  }
}

const liveIdCache = new Map<string, string>();

async function zenlerIdFromLivePage(slug: string): Promise<string> {
  if (!slug) return '';
  if (liveIdCache.has(slug)) return liveIdCache.get(slug) ?? '';
  try {
    const html = await fetchPageHtml(`https://vls-online.com/courses/${slug}`);
    const id = inferZenlerCourseIdFromHtml(html);
    liveIdCache.set(slug, id);
    return id;
  } catch {
    liveIdCache.set(slug, '');
    return '';
  }
}

export async function resolveNotesZenlerCourseId(input: {
  content?: Record<string, unknown> | null;
  slug: string;
  fetchLive?: boolean;
}): Promise<string> {
  if (input.fetchLive !== false) {
    for (const slug of candidateZenlerNotesSlugs(input.slug)) {
      const fromLive = await zenlerIdFromLivePage(slug);
      if (fromLive) return fromLive;
    }
  }

  const fromCms = await zenlerIdFromCmsSlug(input.slug);
  if (fromCms) return fromCms;

  return zenlerIdFromStoryContent(input.content);
}

export async function backfillNotesCurriculumStories(
  config: StoryblokConfig,
  options?: { publish?: boolean; dryRun?: boolean; fetchLive?: boolean },
): Promise<NotesCurriculumBackfillResult> {
  const stories = await listStories(config, {
    starts_with: 'courses/',
    per_page: 100,
  });

  const notesStories = stories.filter(story =>
    !story.is_folder && isNotesCourseStorySlug(story.full_slug),
  );

  const result: NotesCurriculumBackfillResult = {
    scanned: notesStories.length,
    updated: 0,
    skipped: 0,
    failed: 0,
    stories: [],
  };

  for (const ref of notesStories) {
    const story = await getStoryById(config, ref.id);
    if (!story?.content) {
      result.skipped += 1;
      result.stories.push({ fullSlug: ref.full_slug, action: 'skipped', message: 'No story content' });
      continue;
    }

    const slug = notesSlugFromStorySlug(story.full_slug || ref.full_slug);
    const zenlerCourseId = await resolveNotesZenlerCourseId({
      content: story.content,
      slug,
      fetchLive: options?.fetchLive,
    });

    if (!zenlerCourseId) {
      result.skipped += 1;
      result.stories.push({
        fullSlug: ref.full_slug,
        action: 'skipped',
        message: 'Could not resolve Zenler course ID',
      });
      continue;
    }

    const patched = patchNotesStoryCurriculum(story.content, zenlerCourseId);
    if (!patched.changed) {
      result.skipped += 1;
      result.stories.push({
        fullSlug: ref.full_slug,
        action: 'unchanged',
        zenlerCourseId,
      });
      continue;
    }

    if (options?.dryRun) {
      result.updated += 1;
      result.stories.push({
        fullSlug: ref.full_slug,
        action: patched.action,
        zenlerCourseId,
        message: 'dry-run',
      });
      continue;
    }

    try {
      await updateStoryById(config, story.id, {
        name: story.name,
        slug: story.slug,
        content: patched.content,
        publish: Boolean(options?.publish),
      });
      result.updated += 1;
      result.stories.push({
        fullSlug: ref.full_slug,
        action: patched.action,
        zenlerCourseId,
      });
    } catch (error) {
      result.failed += 1;
      result.stories.push({
        fullSlug: ref.full_slug,
        action: 'failed',
        zenlerCourseId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export function summarizeNotesBackfill(result: NotesCurriculumBackfillResult): string {
  const lines = result.stories.map((story) => {
    const id = story.zenlerCourseId ? ` zenler=${story.zenlerCourseId}` : '';
    const extra = story.message ? ` (${story.message})` : '';
    return `- ${story.fullSlug}: ${story.action}${id}${extra}`;
  });
  return [
    `Scanned ${result.scanned} notes stories.`,
    `Updated: ${result.updated}, skipped: ${result.skipped}, failed: ${result.failed}.`,
    ...lines,
  ].join('\n');
}
