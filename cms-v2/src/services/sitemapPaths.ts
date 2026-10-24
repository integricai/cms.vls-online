export type SitemapGroup = 'pages' | 'courses' | 'blog';

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
