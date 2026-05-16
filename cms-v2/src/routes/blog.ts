import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { listBlogPosts, saveBlogPosts, type BlogPost, type BlogStatus } from '../models/blog';
import { deleteBlogAssets } from '../models/blogAsset';
import { BlogImportError, importBlogPost, slugify } from '../services/blogImport';

const router = Router();

router.use(authGuard);

function isStatus(value: unknown): value is BlogStatus {
  return value === 'draft' || value === 'published';
}

function topicSlug(topic: string): string {
  return slugify(topic || 'blog');
}

function withUrl(post: BlogPost): BlogPost & { url: string } {
  return { ...post, url: `/blog/${topicSlug(post.topic)}/${post.slug}` };
}

router.get('/posts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await listBlogPosts();
    return res.json({ ok: true, data: posts.map(withUrl) });
  } catch (err) {
    next(err);
  }
});

router.post('/import', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      sourceUrl?: unknown;
      topicOverride?: unknown;
      slugOverride?: unknown;
      status?: unknown;
      force?: unknown;
      updatePostId?: unknown;
    };
    if (typeof body.sourceUrl !== 'string' || !body.sourceUrl.trim()) {
      return res.status(400).json({ ok: false, error: 'Source URL is required' });
    }

    const posts = await listBlogPosts();
    const requestedSlug = typeof body.slugOverride === 'string' && body.slugOverride.trim()
      ? slugify(body.slugOverride)
      : '';
    const existingBySource = posts.find(post => post.originalSourceUrl === body.sourceUrl);
    const existingByRequestedSlug = requestedSlug
      ? posts.find(post => post.slug === requestedSlug)
      : undefined;
    const updatePostId = typeof body.updatePostId === 'string' ? body.updatePostId : '';
    const duplicate = existingBySource || existingByRequestedSlug;

    if (duplicate && !body.force && duplicate.id !== updatePostId) {
      return res.status(409).json({
        ok: false,
        error: existingBySource ? 'This source URL has already been imported' : 'This slug already exists',
        data: withUrl(duplicate),
      });
    }

    const result = await importBlogPost({
      sourceUrl: body.sourceUrl,
      topicOverride: typeof body.topicOverride === 'string' ? body.topicOverride : undefined,
      slugOverride: typeof body.slugOverride === 'string' ? body.slugOverride : undefined,
      status: isStatus(body.status) ? body.status : 'published',
      existingPosts: posts,
      replacePostId: updatePostId || duplicate?.id,
    });

    const conflict = posts.find(post => post.slug === result.post.slug && post.id !== result.post.id);
    if (conflict && !body.force) {
      return res.status(409).json({
        ok: false,
        error: 'This slug already exists',
        data: withUrl(conflict),
      });
    }

    const nextPosts = posts.some(post => post.id === result.post.id)
      ? posts.map(post => post.id === result.post.id ? result.post : post)
      : [result.post, ...posts];
    await saveBlogPosts(nextPosts, req.user!.userId);
    return res.json({ ok: true, data: { post: withUrl(result.post), warnings: result.warnings } });
  } catch (err) {
    if (err instanceof BlogImportError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.patch('/posts/:id', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await listBlogPosts();
    const index = posts.findIndex(post => post.id === req.params.id);
    if (index === -1) return res.status(404).json({ ok: false, error: 'Blog post not found' });

    const body = req.body as Partial<BlogPost>;
    const nextPost: BlogPost = {
      ...posts[index],
      topic: typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : posts[index].topic,
      tags: Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : posts[index].tags,
      status: isStatus(body.status) ? body.status : posts[index].status,
      updatedDate: new Date().toISOString(),
    };

    const nextPosts = posts.map(post => post.id === nextPost.id ? nextPost : post);
    await saveBlogPosts(nextPosts, req.user!.userId);
    return res.json({ ok: true, data: withUrl(nextPost) });
  } catch (err) {
    next(err);
  }
});

router.delete('/posts/:id', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await listBlogPosts();
    const post = posts.find(item => item.id === req.params.id);
    if (!post) return res.status(404).json({ ok: false, error: 'Blog post not found' });

    const assetIds = (post.images || [])
      .map(image => image.localPath.match(/\/blog-assets\/([^/]+)/)?.[1])
      .filter((id): id is string => Boolean(id))
      .map(id => decodeURIComponent(id));

    const nextPosts = posts.filter(item => item.id !== req.params.id);
    await saveBlogPosts(nextPosts, req.user!.userId);
    await deleteBlogAssets([...new Set(assetIds)]);
    return res.json({ ok: true, data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
});

export default router;
