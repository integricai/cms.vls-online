import { storyblokSlugToPath } from './sitemapPaths';

const SITE_HOSTS = new Set([
  'vls-online.com',
  'www.vls-online.com',
  'staging.vls-online.com',
  'preview.vls-online.com',
  'prod.vls-online.com',
  'localhost',
  'vls.newzenler.com',
]);

const COURSE_STORY_PATH = /^\/courses\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

const STRING_LINK_KEYS = new Set([
  'url',
  'href',
  'cached_url',
  'cta_link',
  'primary_cta_link',
  'secondary_cta_link',
  'link',
  'note_link',
  'best_value_link',
  'course_link',
]);

export type CoursePathReplacement = {
  fromPath: string;
  toPath: string;
};

export type CourseUrlCourseRef = {
  id: number;
  name: string;
  zenlerCourseId: string;
  coursePageUrl: string | null;
};

export type CourseUrlStoryRef = {
  id: number;
  fullSlug: string;
  isFolder?: boolean;
  zenlerCourseId: string;
  component: string;
};

export type PlannedCourseUrlChange = {
  courseId: number;
  courseName: string;
  zenlerCourseId: string;
  fromPath: string;
  toPath: string;
  storyId: number;
};

export type CourseUrlPlan = {
  changes: PlannedCourseUrlChange[];
  unchanged: number;
  errors: string[];
};

export function courseSlugFromPath(path: string): string | null {
  const match = path.match(/^\/courses\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  return match?.[1] ?? null;
}

/** Canonical public path for a course story, without query, hash, or trailing slash. */
export function normalizePublicCoursePath(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      pathname = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  } else {
    const noHash = trimmed.split('#')[0] ?? trimmed;
    pathname = (noHash.split('?')[0] ?? noHash);
    if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  }

  const normalized = pathname.replace(/\/+$/, '') || '/';
  return COURSE_STORY_PATH.test(normalized) ? normalized : null;
}

export function storyPath(fullSlug: string): string {
  const path = storyblokSlugToPath(fullSlug).replace(/\/+$/, '') || '/';
  return path;
}

function isMultilink(value: Record<string, unknown>): boolean {
  return value.linktype != null
    || value.fieldtype === 'multilink'
    || ('cached_url' in value && ('url' in value || 'id' in value));
}

export function replaceCourseHref(
  raw: string,
  replacements: CoursePathReplacement[],
): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('mailto:') || trimmed.startsWith('tel:')) {
    return null;
  }

  let pathname = '';
  let search = '';
  let hash = '';

  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (!SITE_HOSTS.has(url.hostname.toLowerCase())) return null;
    pathname = url.pathname;
    search = url.search;
    hash = url.hash;
  } else {
    const hashIndex = trimmed.indexOf('#');
    const beforeHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
    hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : '';
    const queryIndex = beforeHash.indexOf('?');
    const pathPart = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
    search = queryIndex >= 0 ? beforeHash.slice(queryIndex) : '';
    pathname = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  }

  const normalized = pathname.replace(/\/+$/, '') || '/';
  const hit = replacements.find(item => item.fromPath === normalized);
  if (!hit) return null;
  const next = `${hit.toPath}${search}${hash}`;
  return next === trimmed ? null : next;
}

function rewriteLinkFields(link: Record<string, unknown>, replacements: CoursePathReplacement[]): boolean {
  let changed = false;
  for (const key of ['url', 'cached_url', 'href']) {
    if (typeof link[key] !== 'string') continue;
    const next = replaceCourseHref(link[key] as string, replacements);
    if (!next) continue;
    link[key] = next;
    changed = true;
  }
  return changed;
}

export function rewriteCourseLinksInContent(
  content: Record<string, unknown>,
  replacements: CoursePathReplacement[],
): { content: Record<string, unknown>; rewritten: number } {
  const next = structuredClone(content);
  let rewritten = 0;
  if (!replacements.length) return { content: next, rewritten };

  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const record = node as Record<string, unknown>;
    const multilink = isMultilink(record);
    if (multilink && rewriteLinkFields(record, replacements)) rewritten += 1;

    for (const [key, value] of Object.entries(record)) {
      if (typeof value === 'string' && !multilink && STRING_LINK_KEYS.has(key)) {
        const replaced = replaceCourseHref(value, replacements);
        if (replaced) {
          record[key] = replaced;
          rewritten += 1;
        }
        continue;
      }
      if (value && typeof value === 'object') walk(value);
    }
  };

  walk(next);
  return { content: next, rewritten };
}

function pickStory(stories: CourseUrlStoryRef[]): CourseUrlStoryRef | 'many' | null {
  const rows = stories.filter(story => !story.isFolder && story.zenlerCourseId);
  if (!rows.length) return null;
  const pages = rows.filter(story => story.component === 'course_page');
  const pool = pages.length ? pages : rows;
  if (pool.length > 1) return 'many';
  return pool[0];
}

export function planCourseUrlChanges(
  courses: CourseUrlCourseRef[],
  stories: CourseUrlStoryRef[],
): CourseUrlPlan {
  const byZenlerId = new Map<string, CourseUrlStoryRef[]>();
  for (const story of stories) {
    const id = story.zenlerCourseId.trim();
    if (!id || story.isFolder) continue;
    const group = byZenlerId.get(id) ?? [];
    group.push(story);
    byZenlerId.set(id, group);
  }

  const changes: PlannedCourseUrlChange[] = [];
  const errors: string[] = [];
  let unchanged = 0;

  for (const course of courses) {
    if (!course.coursePageUrl?.trim()) continue;
    const toPath = normalizePublicCoursePath(course.coursePageUrl);
    if (!toPath) {
      errors.push(`${course.name}: Course page URL must be a path like /courses/fa1.`);
      continue;
    }

    const picked = pickStory(byZenlerId.get(course.zenlerCourseId) ?? []);
    if (!picked) {
      errors.push(`${course.name}: No Storyblok course page is linked to this course.`);
      continue;
    }
    if (picked === 'many') {
      errors.push(`${course.name}: More than one Storyblok course page uses this course id.`);
      continue;
    }

    const fromPath = normalizePublicCoursePath(storyPath(picked.fullSlug));
    if (!fromPath) {
      errors.push(`${course.name}: Storyblok slug ${picked.fullSlug} is not a /courses/{slug} path.`);
      continue;
    }
    if (fromPath === toPath) {
      unchanged += 1;
      continue;
    }

    changes.push({
      courseId: course.id,
      courseName: course.name,
      zenlerCourseId: course.zenlerCourseId,
      fromPath,
      toPath,
      storyId: picked.id,
    });
  }

  return { changes, unchanged, errors };
}

export function courseRedirectUrls(
  fromPath: string,
  toPath: string,
  origins: string[],
): Array<{ sourceUrl: string; targetUrl: string }> {
  return origins.map(origin => {
    const base = origin.replace(/\/+$/, '');
    return {
      sourceUrl: `${base}${fromPath}`,
      targetUrl: `${base}${toPath}`,
    };
  });
}
