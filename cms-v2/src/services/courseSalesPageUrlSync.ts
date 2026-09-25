import { listCourses, updateCoursePageUrlByZenlerId } from '../models/course';
import type { CourseSalesPageUrlIssue } from '../../shared/types';
import { storyblokSlugToPath } from './sitemapPaths';
import { normalizePublicCoursePath } from './courseUrlRewrite';
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
  missing: CourseSalesPageUrlIssue[];
  conflicts: CourseSalesPageUrlIssue[];
  error?: string;
};

export type CourseSalesPageUrlCourse = {
  zenlerCourseId: string;
  name: string;
  coursePageUrl: string | null;
  isActive: boolean;
};

export type CourseSalesPageUrlStory = {
  isFolder?: boolean;
  fullSlug: string;
  component: string;
  zenlerCourseId: string;
  published?: boolean;
};

export type CourseSalesPageUrlPlan = {
  scanned: number;
  updates: Array<{ zenlerCourseId: string; pageUrl: string }>;
  unchanged: number;
  unmatched: number;
  missing: CourseSalesPageUrlIssue[];
  conflicts: CourseSalesPageUrlIssue[];
};

function canonicalPageUrl(fullSlug: string): string {
  const path = storyblokSlugToPath(fullSlug);
  return normalizePublicCoursePath(path) ?? path;
}

function storedPathMatches(current: string | null, pageUrl: string): boolean {
  return (current ?? '').trim() === pageUrl;
}

/**
 * Storyblok course pages are the only source for CMS course URLs.
 * Zenler contributes the course id used to match a page to a CMS course.
 * The scan is held in memory, then each matching CMS course URL is replaced
 * with that Storyblok path. A Zenler or full website URL is not kept.
 */
export function planCourseSalesPageUrlSync(
  courses: CourseSalesPageUrlCourse[],
  stories: CourseSalesPageUrlStory[],
): CourseSalesPageUrlPlan {
  const byZenlerId = new Map(courses.map(course => [course.zenlerCourseId, course]));
  const pagesByZenlerId = new Map<string, Array<{ path: string; published: boolean }>>();
  let scanned = 0;
  let unmatched = 0;

  for (const story of stories) {
    if (story.isFolder) continue;
    const component = story.component.trim();
    if (component && component !== 'course_page') continue;

    scanned += 1;
    const zenlerCourseId = story.zenlerCourseId.trim();
    if (!zenlerCourseId || !byZenlerId.has(zenlerCourseId)) {
      unmatched += 1;
      continue;
    }

    const pages = pagesByZenlerId.get(zenlerCourseId) ?? [];
    pages.push({
      path: canonicalPageUrl(story.fullSlug),
      published: story.published !== false,
    });
    pagesByZenlerId.set(zenlerCourseId, pages);
  }

  const updates: CourseSalesPageUrlPlan['updates'] = [];
  const conflicts: CourseSalesPageUrlIssue[] = [];
  let unchanged = 0;

  for (const [zenlerCourseId, paths] of pagesByZenlerId) {
    const course = byZenlerId.get(zenlerCourseId);
    if (!course) continue;

    const published = paths.filter(page => page.published);
    const chosen = published.length ? published : paths;
    const unique = [...new Set(chosen.map(page => page.path))];
    if (unique.length !== 1) {
      unmatched += paths.length;
      conflicts.push({
        zenlerCourseId,
        name: course.name,
        detail: `More than one published Storyblok course page uses this course id: ${unique.join(', ')}`,
      });
      continue;
    }

    const pageUrl = unique[0];
    if (storedPathMatches(course.coursePageUrl, pageUrl)) {
      unchanged += 1;
      continue;
    }

    updates.push({ zenlerCourseId, pageUrl });
  }

  const missing = courses
    .filter(course => course.isActive && !pagesByZenlerId.has(course.zenlerCourseId))
    .map(course => ({
      zenlerCourseId: course.zenlerCourseId,
      name: course.name,
      detail: 'No Storyblok course page is linked to this course.',
    }));

  return { scanned, updates, unchanged, unmatched, missing, conflicts };
}

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
      missing: [],
      conflicts: [],
      error: 'Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.',
    };
  }

  const stories = await listStories(resolved, {
    starts_with: 'courses/',
    per_page: 100,
  });

  const courses = await listCourses();
  const storyRefs: CourseSalesPageUrlStory[] = [];
  for (const story of stories) {
    if (story.is_folder) {
      storyRefs.push({
        isFolder: true,
        fullSlug: story.full_slug,
        component: '',
        zenlerCourseId: '',
      });
      continue;
    }

    const content = await resolveStoryContent(resolved, story);
    const publishedAt = (story as StoryblokStoryRecord & { published_at?: string | null }).published_at;
    storyRefs.push({
      fullSlug: story.full_slug,
      component: String(content?.component ?? ''),
      zenlerCourseId: zenlerIdFromStoryContent(content),
      published: publishedAt === undefined ? true : Boolean(publishedAt),
    });
  }

  const storyblokUrls = planCourseSalesPageUrlSync(
    courses.map(course => ({
      zenlerCourseId: course.zenlerCourseId,
      name: course.name,
      coursePageUrl: course.coursePageUrl,
      isActive: course.isActive,
    })),
    storyRefs,
  );

  let updated = 0;
  let unmatched = storyblokUrls.unmatched;
  for (const change of storyblokUrls.updates) {
    const saved = await updateCoursePageUrlByZenlerId(change.zenlerCourseId, change.pageUrl);
    if (saved) updated += 1;
    else unmatched += 1;
  }

  return {
    ok: true,
    scanned: storyblokUrls.scanned,
    updated,
    unchanged: storyblokUrls.unchanged,
    unmatched,
    missing: storyblokUrls.missing,
    conflicts: storyblokUrls.conflicts,
  };
}
