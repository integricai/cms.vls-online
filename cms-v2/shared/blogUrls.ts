export const VLS_SITE_ORIGIN = 'https://vls-online.com';

export interface BlogPostUrlFields {
  slug: string;
  canonicalUrl?: string;
  bodyHtml?: string;
  summary?: string;
  updatedDate?: string;
}

export function blogPublicPath(slug: string): string {
  const clean = String(slug || '').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `/blog/${clean}` : '/blog';
}

export function blogUrl(post: Pick<BlogPostUrlFields, 'slug'>): string {
  return blogPublicPath(post.slug);
}

export function absoluteBlogUrl(post: Pick<BlogPostUrlFields, 'slug'>): string {
  return `${VLS_SITE_ORIGIN}${blogUrl(post)}`;
}

/** Zenler serves posts at /blog/{slug} — strip a leading topic segment when present. */
export function compactBlogPathname(pathname: string): string {
  const path = String(pathname || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/\/+$/, '');

  const match = path.match(/^\/blog(?:\/(.*))?$/i);
  if (!match) return pathname;
  if (!match[1]) return '/blog';

  const segments = match[1].split('/').filter(Boolean);
  if (segments.length <= 1) return `/blog/${segments[0]}`;

  return `/blog/${segments.slice(1).join('/')}`;
}

export function rewriteBlogHrefValue(href: string): string {
  const value = String(href || '').trim();
  if (!value || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return href;
  }

  try {
    if (/^https?:\/\//i.test(value)) {
      const url = new URL(value);
      const host = url.hostname.replace(/^www\./i, '').toLowerCase();
      if (host !== 'vls-online.com' && host !== 'blog.vls-online.com') return href;
      const nextPath = compactBlogPathname(url.pathname);
      if (nextPath === url.pathname) return href;
      url.pathname = nextPath;
      return url.toString();
    }

    if (value.startsWith('/blog/') || value.startsWith('blog/')) {
      const normalized = value.startsWith('/') ? value : `/${value}`;
      const suffixMatch = normalized.match(/^(\/blog\/[^?#]*)(.*)$/i);
      if (!suffixMatch) return href;
      const nextPath = compactBlogPathname(suffixMatch[1]);
      if (nextPath === suffixMatch[1]) return href;
      return `${nextPath}${suffixMatch[2]}`;
    }
  } catch {
    return href;
  }

  return href;
}

const BLOG_HREF_ATTR = /(\shref\s*=\s*)(["'])((?:https?:\/\/(?:www\.)?vls-online\.com)?\/?blog\/[^"'<>]*?)(\2)/gi;
const BLOG_URL_IN_TEXT = /(https?:\/\/(?:www\.)?vls-online\.com)(\/blog\/[^\s"'<>]+)/gi;
const ROOT_BLOG_PATH = /(?<!\/)(\/blog\/[^\s"'<>]+)/gi;

export function rewriteTopicBlogLinks(html: string): string {
  let next = html || '';

  next = next.replace(BLOG_HREF_ATTR, (_match, prefix: string, quote: string, href: string) => {
    const rewritten = rewriteBlogHrefValue(href);
    return rewritten === href ? _match : `${prefix}${quote}${rewritten}${quote}`;
  });

  next = next.replace(BLOG_URL_IN_TEXT, (_match, origin: string, path: string) => {
    const rewritten = rewriteBlogHrefValue(`${origin}${path}`);
    return rewritten === `${origin}${path}` ? _match : rewritten;
  });

  next = next.replace(ROOT_BLOG_PATH, (match, path: string) => {
    const rewritten = rewriteBlogHrefValue(path);
    return rewritten === path ? match : rewritten;
  });

  return next;
}

export function normalizeBlogPostUrls<T extends BlogPostUrlFields>(post: T): T {
  const canonicalUrl = absoluteBlogUrl(post);
  const bodyHtml = post.bodyHtml ? rewriteTopicBlogLinks(post.bodyHtml) : post.bodyHtml;
  const summary = post.summary ? rewriteTopicBlogLinks(post.summary) : post.summary;

  if (post.canonicalUrl === canonicalUrl && bodyHtml === post.bodyHtml && summary === post.summary) {
    return post;
  }

  return {
    ...post,
    canonicalUrl,
    ...(bodyHtml !== undefined ? { bodyHtml } : {}),
    ...(summary !== undefined ? { summary } : {}),
    updatedDate: new Date().toISOString(),
  };
}
