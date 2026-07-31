export type SitemapGroup = 'pages' | 'courses' | 'blog';

/** Map Storyblok `full_slug` to the public Next.js path (English, no locale prefix). */
export function storyblokSlugToPath(fullSlug: string): string {
  const slug = fullSlug.replace(/^\/+|\/+$/g, '');
  if (slug === 'pages/home' || slug === 'pages' || slug === '') return '/';
  if (slug === 'blog') return '/blog';
  if (slug.startsWith('courses/')) return `/${slug}`;
  if (slug.startsWith('blog/')) return `/${slug}`;
  if (slug.startsWith('pages/blog/')) {
    return `/blog/${slug.slice('pages/blog/'.length)}`;
  }
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

  // Folder roots with no public page (except blog startpage)
  if (slug === 'pages' || slug === 'courses') return null;

  if (slug.startsWith('courses/')) return 'courses';
  if (slug === 'blog' || slug.startsWith('blog/')) return 'blog';
  if (slug.startsWith('pages/')) return 'pages';

  return null;
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
