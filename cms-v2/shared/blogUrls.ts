export const VLS_SITE_ORIGIN = 'https://vls-online.com';

export interface BlogPostUrlFields {
  slug: string;
  canonicalUrl?: string;
  bodyHtml?: string;
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

const TOPIC_BLOG_HREF = /(<a\b[^>]*\shref=["'])(?:https?:\/\/(?:www\.)?vls-online\.com)?\/blog\/[a-z0-9-]+\/([a-z0-9-]+)([^"']*)(["'][^>]*>)/gi;

export function rewriteTopicBlogLinks(html: string): string {
  return (html || '').replace(TOPIC_BLOG_HREF, (_match, start: string, slug: string, rest: string, end: string) => {
    return `${start}/blog/${slug}${rest}${end}`;
  });
}

export function normalizeBlogPostUrls<T extends BlogPostUrlFields>(post: T): T {
  const canonicalUrl = absoluteBlogUrl(post);
  const bodyHtml = post.bodyHtml ? rewriteTopicBlogLinks(post.bodyHtml) : post.bodyHtml;
  if (post.canonicalUrl === canonicalUrl && bodyHtml === post.bodyHtml) return post;
  return {
    ...post,
    canonicalUrl,
    ...(bodyHtml !== undefined ? { bodyHtml } : {}),
    updatedDate: new Date().toISOString(),
  };
}
