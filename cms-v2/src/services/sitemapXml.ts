import type { SiteUrlRecord } from '../models/siteUrl';
import type { SitemapGroup } from './sitemapPaths';
import { absoluteUrl, normalizeSiteOrigin } from './sitemapPaths';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildUrlSetXml(origin: string, urls: SiteUrlRecord[]): string {
  const body = urls.map(row => {
    const loc = absoluteUrl(origin, row.path);
    const lastmod = row.lastmod ? `\n    <lastmod>${escapeXml(row.lastmod.slice(0, 10))}</lastmod>` : '';
    return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

export function buildSitemapIndexXml(
  origin: string,
  groups: SitemapGroup[] = ['pages', 'courses', 'blog'],
): string {
  const base = normalizeSiteOrigin(origin);
  const files: Record<SitemapGroup, string> = {
    pages: 'sitemap-pages.xml',
    courses: 'sitemap-courses.xml',
    blog: 'sitemap-blog.xml',
  };

  const body = groups.map(group => (
    `  <sitemap>\n    <loc>${escapeXml(`${base}/${files[group]}`)}</loc>\n  </sitemap>`
  )).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</sitemapindex>
`;
}

export const SITEMAP_GROUP_FILES: Record<SitemapGroup | 'index', string> = {
  index: 'sitemap.xml',
  pages: 'sitemap-pages.xml',
  courses: 'sitemap-courses.xml',
  blog: 'sitemap-blog.xml',
};
