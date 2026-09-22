import { listCourses } from '../models/course';
import {
  getCourseUrlRewriteState,
  insertCourseUrlChange,
  listCourseUrlChangesByStatus,
  listOpenCourseUrlChanges,
  markCourseUrlChangeFailed,
  markCourseUrlChangeRewriting,
  markCourseUrlChangesPublished,
  markRewritingCourseUrlChangesReady,
  resetCourseUrlChange,
  saveCourseUrlRewriteState,
  summarizeCourseUrlChanges,
  type CourseUrlChange,
  type CourseUrlChangeSummary,
} from '../models/courseUrlChange';
import {
  missingCloudflareRedirectConfigMessage,
  publishPathsToCloudflare,
} from './cloudflareRedirects';
import {
  courseSlugFromPath,
  planCourseUrlChanges,
  rewriteCourseLinksInContent,
  type CourseUrlStoryRef,
} from './courseUrlRewrite';
import { upsertFromStoryblokStory } from './sitemapSync';
import {
  findCoursesFolder,
  getStoryById,
  listStories,
  listStoriesPage,
  type StoryblokConfig,
  type StoryblokStoryRecord,
  updateStoryById,
} from './storyblokClient';
import { resolveStoryblokConfigFromEnv } from './storyblokCoursePricingSync';
import { zenlerIdFromStoryContent } from './courseSalesPageUrlSync';

const STORY_PAGE_SIZE = 25;
const DEFAULT_BUDGET_MS = 45_000;

export type CourseUrlApplyResult = {
  planned: number;
  enqueued: number;
  alreadyQueued: number;
  unchanged: number;
  renamed: number;
  storiesRewritten: number;
  linksRewritten: number;
  rewriteFinished: boolean;
  summary: CourseUrlChangeSummary;
  errors: string[];
  warnings: string[];
};

export type CourseRedirectPublishResult = {
  published: number;
  cloudflareItems: number;
  summary: CourseUrlChangeSummary;
  message?: string;
};

function parentIdOf(story: StoryblokStoryRecord): number | undefined {
  const value = (story as StoryblokStoryRecord & { parent_id?: number | null }).parent_id;
  return typeof value === 'number' && value > 0 ? value : undefined;
}

async function storyRefs(config: StoryblokConfig, stories: StoryblokStoryRecord[]): Promise<CourseUrlStoryRef[]> {
  const refs: CourseUrlStoryRef[] = [];
  for (const story of stories) {
    if (story.is_folder) continue;
    let content = story.content;
    if (!content || Object.keys(content).length === 0) {
      const full = await getStoryById(config, story.id);
      content = full?.content ?? content;
    }
    refs.push({
      id: story.id,
      fullSlug: story.full_slug,
      isFolder: story.is_folder,
      zenlerCourseId: zenlerIdFromStoryContent(content),
      component: String(content?.component ?? ''),
    });
  }
  return refs;
}

export async function enqueueCourseUrlChanges(): Promise<{
  planned: number;
  enqueued: number;
  alreadyQueued: number;
  unchanged: number;
  errors: string[];
}> {
  const config = resolveStoryblokConfigFromEnv();
  if (!config) {
    throw new Error('Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.');
  }

  const [courses, stories, open] = await Promise.all([
    listCourses(),
    listStories(config, { starts_with: 'courses/', per_page: 100 }),
    listOpenCourseUrlChanges(),
  ]);

  const plan = planCourseUrlChanges(
    courses.map(course => ({
      id: course.id,
      name: course.name,
      zenlerCourseId: course.zenlerCourseId,
      coursePageUrl: course.coursePageUrl,
    })),
    await storyRefs(config, stories),
  );

  let enqueued = 0;
  let alreadyQueued = 0;
  const errors = [...plan.errors];

  for (const change of plan.changes) {
    const openForCourse = open.filter(row => row.courseId === change.courseId);
    const same = openForCourse.find(row => row.fromPath === change.fromPath && row.toPath === change.toPath);
    const different = openForCourse.find(row => row.id !== same?.id);

    if (different && different.status !== 'failed') {
      errors.push(
        `${change.courseName} already has a URL change in progress (${different.fromPath} → ${different.toPath}). Finish that change before applying a different URL.`,
      );
      continue;
    }

    if (same && (same.status === 'queued' || same.status === 'rewriting' || same.status === 'ready')) {
      alreadyQueued += 1;
      continue;
    }

    if (same?.status === 'failed') {
      await resetCourseUrlChange(same.id, {
        fromPath: change.fromPath,
        toPath: change.toPath,
        storyblokStoryId: change.storyId,
      });
      enqueued += 1;
      continue;
    }

    if (different?.status === 'failed') {
      await resetCourseUrlChange(different.id, {
        fromPath: change.fromPath,
        toPath: change.toPath,
        storyblokStoryId: change.storyId,
      });
      enqueued += 1;
      continue;
    }

    await insertCourseUrlChange({
      courseId: change.courseId,
      fromPath: change.fromPath,
      toPath: change.toPath,
      storyblokStoryId: change.storyId,
    });
    enqueued += 1;
  }

  return {
    planned: plan.changes.length,
    enqueued,
    alreadyQueued,
    unchanged: plan.unchanged,
    errors,
  };
}

async function renameQueuedChange(change: CourseUrlChange): Promise<'renamed' | 'failed'> {
  const config = resolveStoryblokConfigFromEnv();
  if (!config) throw new Error('Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.');

  const storyId = change.storyblokStoryId;
  if (!storyId) {
    await markCourseUrlChangeFailed(change.id, 'Missing Storyblok story id');
    return 'failed';
  }

  const slug = courseSlugFromPath(change.toPath);
  if (!slug) {
    await markCourseUrlChangeFailed(change.id, `${change.toPath} is not a /courses/{slug} path`);
    return 'failed';
  }

  try {
    const story = await getStoryById(config, storyId);
    if (!story?.content) {
      await markCourseUrlChangeFailed(change.id, 'Storyblok story has no content');
      return 'failed';
    }
    const fullSlug = story.full_slug.replace(/^\/+|\/+$/g, '');
    if (!fullSlug.startsWith('courses/')) {
      await markCourseUrlChangeFailed(change.id, `Story ${story.full_slug} is not in the courses folder`);
      return 'failed';
    }

    const currentPath = `/${fullSlug}`.replace(/\/+$/, '');
    if (currentPath !== change.toPath) {
      let parentId = parentIdOf(story);
      if (!parentId) {
        const folder = await findCoursesFolder(config);
        parentId = folder?.id;
      }
      const updated = await updateStoryById(config, story.id, {
        name: story.name,
        slug,
        parentId,
        content: story.content,
        publish: true,
      });
      try {
        await upsertFromStoryblokStory({
          ...story,
          id: updated.id,
          name: updated.name,
          slug: updated.slug,
          full_slug: updated.full_slug,
          published_at: new Date().toISOString(),
        });
      } catch (error) {
        console.warn('[course-url] sitemap update failed', error);
      }
    }

    await markCourseUrlChangeRewriting(change.id, story.id);
    return 'renamed';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Storyblok slug update failed';
    await markCourseUrlChangeFailed(change.id, message);
    return 'failed';
  }
}

async function rewriteOnePage(page: number): Promise<{
  done: boolean;
  storiesRewritten: number;
  linksRewritten: number;
  warnings: string[];
}> {
  const config = resolveStoryblokConfigFromEnv();
  if (!config) throw new Error('Storyblok is not configured. Set STORYBLOK_PERSONAL_TOKEN.');

  const changes = await listCourseUrlChangesByStatus('rewriting');
  const replacements = changes.map(change => ({ fromPath: change.fromPath, toPath: change.toPath }));
  const { stories, done } = await listStoriesPage(config, { sort_by: 'created_at:asc' }, page, STORY_PAGE_SIZE);
  let storiesRewritten = 0;
  let linksRewritten = 0;
  const warnings: string[] = [];

  for (const ref of stories) {
    if (ref.is_folder) continue;
    let content = ref.content;
    let name = ref.name;
    let slug = ref.slug;
    let publishedAt = (ref as StoryblokStoryRecord & { published_at?: string | null }).published_at;
    if (!content || Object.keys(content).length === 0) {
      const full = await getStoryById(config, ref.id);
      content = full?.content;
      name = full?.name || name;
      slug = full?.slug || slug;
      if (full && 'published_at' in full) {
        publishedAt = (full as StoryblokStoryRecord & { published_at?: string | null }).published_at;
      }
    }
    if (!content) continue;

    const patched = rewriteCourseLinksInContent(content, replacements);
    if (!patched.rewritten) continue;

    try {
      await updateStoryById(config, ref.id, {
        name,
        slug,
        content: patched.content,
        publish: publishedAt !== null,
      });
      storiesRewritten += 1;
      linksRewritten += patched.rewritten;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Storyblok link update failed';
      warnings.push(`${ref.full_slug || ref.slug}: ${message}`);
    }
  }

  return { done, storiesRewritten, linksRewritten, warnings };
}

export async function drainCourseUrlChanges(options?: { budgetMs?: number }): Promise<{
  renamed: number;
  storiesRewritten: number;
  linksRewritten: number;
  rewriteFinished: boolean;
  warnings: string[];
}> {
  const budgetMs = options?.budgetMs ?? DEFAULT_BUDGET_MS;
  const started = Date.now();
  const expired = () => Date.now() - started > budgetMs;
  let renamed = 0;
  let storiesRewritten = 0;
  let linksRewritten = 0;
  let rewriteFinished = false;
  const warnings: string[] = [];

  const queued = await listCourseUrlChangesByStatus('queued');
  if (queued.length) {
    const state = await getCourseUrlRewriteState();
    if (state.active) {
      await saveCourseUrlRewriteState({ page: 1, active: false, lastError: state.lastError });
    }
  }

  for (const change of queued) {
    if (expired()) break;
    const outcome = await renameQueuedChange(change);
    if (outcome === 'renamed') renamed += 1;
  }

  const stillQueued = await listCourseUrlChangesByStatus('queued');
  const rewriting = await listCourseUrlChangesByStatus('rewriting');
  if (stillQueued.length || !rewriting.length || expired()) {
    return { renamed, storiesRewritten, linksRewritten, rewriteFinished, warnings };
  }

  let state = await getCourseUrlRewriteState();
  if (!state.active) {
    state = { page: 1, active: true, lastError: null };
    await saveCourseUrlRewriteState(state);
  }

  while (!expired()) {
    const pageResult = await rewriteOnePage(state.page);
    storiesRewritten += pageResult.storiesRewritten;
    linksRewritten += pageResult.linksRewritten;
    warnings.push(...pageResult.warnings);
    if (!pageResult.done) {
      state = { page: state.page + 1, active: true, lastError: warnings[0] ?? null };
      await saveCourseUrlRewriteState(state);
      continue;
    }

    await markRewritingCourseUrlChangesReady(linksRewritten);
    await saveCourseUrlRewriteState({ page: 1, active: false, lastError: warnings[0] ?? null });
    rewriteFinished = true;
    break;
  }

  return { renamed, storiesRewritten, linksRewritten, rewriteFinished, warnings };
}

export async function applyCourseUrlChanges(): Promise<CourseUrlApplyResult> {
  const started = Date.now();
  const queued = await enqueueCourseUrlChanges();
  const elapsed = Date.now() - started;
  const drained = await drainCourseUrlChanges({ budgetMs: Math.max(5_000, DEFAULT_BUDGET_MS - elapsed) });
  const summary = await summarizeCourseUrlChanges();
  return {
    ...queued,
    ...drained,
    summary,
    warnings: drained.warnings,
  };
}

export async function publishCourseRedirects(): Promise<CourseRedirectPublishResult> {
  const ready = await listCourseUrlChangesByStatus('ready');
  const summary = await summarizeCourseUrlChanges();
  if (!ready.length) {
    return {
      published: 0,
      cloudflareItems: 0,
      summary,
      message: 'No course URL changes are waiting to be published.',
    };
  }

  try {
    const result = await publishPathsToCloudflare(ready.map(change => ({
      fromPath: change.fromPath,
      toPath: change.toPath,
    })));
    await markCourseUrlChangesPublished(ready.map(change => change.id));
    return {
      published: ready.length,
      cloudflareItems: result.itemsWritten,
      summary: await summarizeCourseUrlChanges(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : missingCloudflareRedirectConfigMessage();
    throw new Error(message);
  }
}
