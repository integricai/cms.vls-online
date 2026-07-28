import type { MigrationTemplate } from './migrationTypes';

export function isCoursePageTemplate(template: MigrationTemplate): boolean {
  return template === 'course' || template === 'course_dual_price' || template === 'revision_course';
}

export function isLevelPageTemplate(template: MigrationTemplate): boolean {
  return template === 'qualification_level_page';
}

/** Storyblok stories for these templates are created under the `courses/` folder. */
export function usesCoursesFolder(template: MigrationTemplate): boolean {
  return isCoursePageTemplate(template) || template === 'study_notes';
}

export function slugifySegment(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** SEO-friendly Storyblok story slug from the origin URL and template. */
export function suggestDestinationSlug(originUrl: string, template: MigrationTemplate): string {
  let parsed: URL;
  try {
    parsed = new URL(originUrl.trim());
  } catch {
    return 'page';
  }

  const segments = parsed.pathname.split('/').filter(Boolean);

  if (template === 'home') {
    return segments.length === 0 || segments[0] === 'home' ? 'home' : slugifySegment(segments.join('-'));
  }

  if (usesCoursesFolder(template)) {
    const coursesIndex = segments.indexOf('courses');
    const slug = coursesIndex >= 0 ? segments[coursesIndex + 1] : segments[segments.length - 1];
    return slugifySegment(slug || (template === 'study_notes' ? 'notes' : 'course'));
  }

  if (segments.length === 0) return 'home';
  return slugifySegment(segments.join('-'));
}

/**
 * Non-course stories are never given a `parentId` when created (there is no "pages" folder
 * resolution, only `findCoursesFolder`), so they always land at the Storyblok root — the full
 * slug used to look up an existing story must match that, or `findStoryBySlug` never finds it
 * and every re-run tries to create a duplicate, which Storyblok rejects as "slug already taken".
 */
export function storyFullSlug(
  template: MigrationTemplate,
  destinationSlug: string,
  options?: { useCoursesFolder?: boolean },
): string {
  const slug = destinationSlug.trim().replace(/^\/+|\/+$/g, '').replace(/^pages\//, '');
  const inCoursesFolder = options?.useCoursesFolder ?? usesCoursesFolder(template);
  if (inCoursesFolder) {
    return slug ? `courses/${slug.replace(/^courses\//, '')}` : 'courses';
  }
  if (template === 'home' || !slug || slug === 'home') {
    return 'home';
  }
  return slug;
}
