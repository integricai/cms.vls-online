import { listCourses, updateCoursePageUrlByZenlerId } from '../models/course';
import { storyblokSlugToPath } from './sitemapPaths';
import {
  getStoryById,
  listStories,
  type StoryblokConfig,
  type StoryblokStoryRecord,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';

export type CourseSalesPageUrlSyncResult = {
  ok: boolean;
  scanned: number;
  updated: number;
  unchanged: number;
  unmatched: number;
  error?: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function zenlerIdFromBlok(value: unknown): string {
  const blok = asRecord(value);
  if (!blok) return '';
  const own = String(blok.zenler_course_id ?? '').trim();
  if (own) return own;
  for (const key of ['left', 'right', 'items', 'body']) {
    const children = blok[key];
    if (!Array.isArray(children)) continue;
    for (const child of children) {
      const nested = zenlerIdFromBlok(child);
      if (nested) return nested;
    }
  }
  return '';
}

export function zenlerIdFromStoryContent(content?: Record<string, unknown> | null): string {
  if (!content) return '';
  const top = String(content.zenler_course_id ?? '').trim();
  if (top) return top;
  const body = Array.isArray(content.body) ? content.body : [];
  for (const blok of body) {
    const id = zenlerIdFromBlok(blok);
    if (id) return id;
  }
  return '';
}

async function resolveStoryContent(
  config: StoryblokConfig,
  story: StoryblokStoryRecord,
): Promise<Record<string, unknown> | null> {
  if (story.content && Object.keys(story.content).length > 0) return story.content;
  const full = await getStoryById(config, story.id);
  return full?.content ?? null;
}

export async function syncCourseSalesPageUrlsFromStoryblok(
  config?: StoryblokConfig | null,
): Promise<CourseSalesPageUrlSyncResult> {
  const resolved = config ?? resolveStoryblokConfigFromEnv();
  if (!resolved) {
    return {
      ok: false,
      scanned: 0,
      updated: 0,
      unchanged: 0,
      unmatched: 0,
      error: 'Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.',
    };
  }

  const stories = await listStories(resolved, {
    starts_with: 'courses/',
    per_page: 100,
  });

  const courses = await listCourses();
  const byZenlerId = new Map(courses.map(course => [course.zenlerCourseId, course]));

  let scanned = 0;
  let updated = 0;
  let unchanged = 0;
  let unmatched = 0;

  for (const story of stories) {
    if (story.is_folder) continue;
    scanned += 1;

    const content = await resolveStoryContent(resolved, story);
    const component = String(content?.component ?? '');
    if (component && component !== 'course_page') continue;

    const zenlerCourseId = zenlerIdFromStoryContent(content);
    if (!zenlerCourseId) {
      unmatched += 1;
      continue;
    }

    const course = byZenlerId.get(zenlerCourseId);
    if (!course) {
      unmatched += 1;
      continue;
    }

    const pageUrl = storyblokSlugToPath(story.full_slug);
    if ((course.coursePageUrl ?? null) === pageUrl) {
      unchanged += 1;
      continue;
    }

    const saved = await updateCoursePageUrlByZenlerId(zenlerCourseId, pageUrl);
    if (saved) {
      course.coursePageUrl = saved.coursePageUrl;
      updated += 1;
    } else {
      unmatched += 1;
    }
  }

  return { ok: true, scanned, updated, unchanged, unmatched };
}
