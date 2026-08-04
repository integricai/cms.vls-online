import type { MigrationTemplate } from './migrationTypes';

export function isCoursePageTemplate(template: MigrationTemplate): boolean {
  return template === 'course' || template === 'course_dual_price' || template === 'revision_course';
}

export function isLevelPageTemplate(template: MigrationTemplate): boolean {
  return template === 'qualification_level_page';
}

export function isBlogPageTemplate(template: MigrationTemplate): boolean {
  return template === 'blog';
}

/** File-based pages whose Storyblok body is discovered from page-content HTML. */
export function isPageContentTemplate(template: MigrationTemplate): boolean {
  return template === 'page_content';
}

/** Storyblok stories for these templates are created under the `courses/` folder. */
export function usesCoursesFolder(template: MigrationTemplate): boolean {
  return isCoursePageTemplate(template) || template === 'study_notes';
}

/** Storyblok stories for blog posts are created under the `blog/` folder. */
export function usesBlogFolder(template: MigrationTemplate): boolean {
  return isBlogPageTemplate(template);
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

  if (usesBlogFolder(template)) {
    const blogIndex = segments.indexOf('blog');
    // Prefer /blog/{seo-slug}. AutoSEO /shared/{hash} is only a temporary fallback until scrape
    // replaces destinationSlug with a title-based SEO slug.
    const slug = blogIndex >= 0
      ? segments.slice(blogIndex + 1).join('-')
      : segments[segments.length - 1];
    return slugifySegment(slug || 'post');
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
 * Non-course / non-blog stories are never given a `parentId` when created (there is no "pages"
 * folder resolution, only courses/blog folders), so they always land at the Storyblok root —
 * the full slug used to look up an existing story must match that, or `findStoryBySlug` never
 * finds it and every re-run tries to create a duplicate, which Storyblok rejects as "slug already taken".
 */
export function storyFullSlug(
  template: MigrationTemplate,
  destinationSlug: string,
  options?: { useCoursesFolder?: boolean; useBlogFolder?: boolean },
): string {
  const slug = destinationSlug.trim().replace(/^\/+|\/+$/g, '').replace(/^pages\//, '');
  const inCoursesFolder = options?.useCoursesFolder ?? usesCoursesFolder(template);
  const inBlogFolder = options?.useBlogFolder ?? usesBlogFolder(template);
  if (inBlogFolder) {
    return slug ? `blog/${slug.replace(/^blog\//, '')}` : 'blog';
  }
  if (inCoursesFolder) {
    return slug ? `courses/${slug.replace(/^courses\//, '')}` : 'courses';
  }
  if (template === 'home' || !slug || slug === 'home') {
    return 'home';
  }
  return slug;
}
