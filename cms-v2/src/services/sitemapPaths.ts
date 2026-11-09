export type SitemapGroup = 'pages' | 'courses' | 'blog';

/**
 * Storyblok stories that are internal or unfinished. They stay out of every sitemap.
 * Each folder name covers the folder itself and every nested story.
 */
export const SITEMAP_EXCLUDED_FOLDERS = ['component-library', 'drafts'] as const;

const SITEMAP_EXCLUDED_SLUGS = new Set([
  'test',
  'site-config',
  'announcement-bar',
  'draft-page',
]);

/** Public paths for {@link SITEMAP_EXCLUDED_SLUGS}. Used to turn off rows already stored. */
export const SITEMAP_EXCLUDED_PATHS = [
  '/test',
  '/site-config',
  '/announcement-bar',
  '/draft-page',
] as const;

export function isExcludedFromSitemap(fullSlug: string): boolean {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '');
  const publicSlug = slug.startsWith('pages/') ? slug.slice('pages/'.length) : slug;
  if (!publicSlug) return false;
  if (SITEMAP_EXCLUDED_FOLDERS.some((folder) => publicSlug === folder || publicSlug.startsWith(`${folder}/`))) {
    return true;
  }
  return SITEMAP_EXCLUDED_SLUGS.has(publicSlug);
}

/** Map Storyblok `full_slug` to the public Next.js path (English, no locale prefix). */
export function storyblokSlugToPath(fullSlug: string): string {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '');
  if (!slug || slug === 'home' || slug === 'pages' || slug === 'pages/home') return '/';
  if (slug.startsWith('pages/')) {
    const rest = slug.slice('pages/'.length);
    return rest ? `/${rest}` : '/';
  }
  return `/${slug}`;
}

/** Which sitemap file a Storyblok slug belongs to, or null if it is not a public page. */
export function resolveSitemapGroup(fullSlug: string): SitemapGroup | null {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '');
  if (!slug || slug === 'global' || slug.startsWith('global/')) return null;
  if (isExcludedFromSitemap(slug)) return null;

  if (slug === 'courses' || slug.startsWith('courses/')) return 'courses';
  if (
    slug === 'blog'
    || slug.startsWith('blog/')
    || slug === 'pages/blog'
    || slug.startsWith('pages/blog/')
  ) {
    return 'blog';
  }

  // Space-root stories (home, about-us, accadates, …) and anything under pages/.
  return 'pages';
}

export function extractNoIndex(content?: Record<string, unknown> | null): boolean {
  if (!content) return false;
  const seo = content.seo;
  const blok = Array.isArray(seo) ? seo[0] : seo;
  if (!blok || typeof blok !== 'object') return false;
  return Boolean((blok as { no_index?: boolean }).no_index);
}

export function normalizeSiteOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

export function absoluteUrl(origin: string, path: string): string {
  const base = normalizeSiteOrigin(origin);
  if (path === '/') return `${base}/`;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}
