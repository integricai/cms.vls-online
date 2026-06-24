import { normalizeBlogPostUrls } from '../../shared/blogUrls';
import { getContent, upsertContent } from './content';

export const BLOG_CONTENT_KEY = 'vls-blog-posts';

export type BlogStatus = 'draft' | 'published';

export interface BlogImage {
  sourceUrl: string;
  localPath: string;
  alt: string;
  contentType: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  topic: string;
  tags: string[];
  summary: string;
  bodyHtml: string;
  featuredImagePath: string;
  images: BlogImage[];
  originalSourceUrl: string;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
  author: string;
  publishDate: string;
  createdDate: string;
  updatedDate: string;
  status: BlogStatus;
}

export interface BlogContent {
  posts: BlogPost[];
}

function normalizeContent(value: unknown): BlogContent {
  if (!value || typeof value !== 'object') return { posts: [] };
  const posts = (value as { posts?: unknown }).posts;
  return { posts: Array.isArray(posts) ? posts as BlogPost[] : [] };
}

export async function listBlogPosts(): Promise<BlogPost[]> {
  const row = await getContent(BLOG_CONTENT_KEY);
  const posts = normalizeContent(row?.data).posts;
  const normalized = posts.map(normalizeBlogPostUrls);
  const changed = normalized.some((post, index) => post !== posts[index]);
  if (changed) {
    await upsertContent(BLOG_CONTENT_KEY, { posts: normalized }, row?.updated_by ?? undefined);
  }
  return normalized;
}

export async function saveBlogPosts(posts: BlogPost[], updatedBy?: number): Promise<BlogContent> {
  const data = { posts };
  await upsertContent(BLOG_CONTENT_KEY, data, updatedBy);
  return data;
}
