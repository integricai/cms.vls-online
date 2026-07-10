import type { MigrationTemplate } from './migrationTypes';

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

  if (template === 'course') {
    const coursesIndex = segments.indexOf('courses');
    const slug = coursesIndex >= 0 ? segments[coursesIndex + 1] : segments[segments.length - 1];
    return slugifySegment(slug || 'course');
  }

  if (segments.length === 0) return 'home';
  return slugifySegment(segments.join('-'));
}

export function storyFullSlug(template: MigrationTemplate, destinationSlug: string): string {
  const slug = destinationSlug.trim().replace(/^\/+|\/+$/g, '').replace(/^pages\//, '');
  if (template === 'course') {
    return slug ? `courses/${slug.replace(/^courses\//, '')}` : 'courses';
  }
  if (template === 'home' || !slug || slug === 'home') {
    return 'pages/';
  }
  return `pages/${slug}`;
}
