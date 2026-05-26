import { Router, Request, Response, NextFunction } from 'express';
import { getContent } from '../models/content';
import type { BlogPost } from '../models/blog';

const router = Router();

// Allow cross-origin fetches from any domain (Zenler, course pages, etc.)
function allowPublicCors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.removeHeader('Access-Control-Allow-Credentials');
}

router.options('/events', (_req, res) => {
  allowPublicCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

router.get('/events', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getContent('vls-events');
    const data = row?.data && typeof row.data === 'object' ? row.data as { events?: unknown[] } : {};
    allowPublicCors(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ events: Array.isArray(data.events) ? data.events : [] });
  } catch (err) {
    next(err);
  }
});

router.options('/footer', (_req, res) => {
  allowPublicCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

router.get('/footer', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getContent('vls-footer');
    const data = row?.data && typeof row.data === 'object' ? row.data : null;
    allowPublicCors(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ footer: data });
  } catch (err) {
    next(err);
  }
});

router.options('/blog', (_req, res) => {
  allowPublicCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

router.get('/blog', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getContent('vls-blog-posts');
    const data = row?.data && typeof row.data === 'object' ? row.data as { posts?: BlogPost[] } : {};
    const posts = Array.isArray(data.posts) ? data.posts.filter(post => post.status === 'published') : [];
    allowPublicCors(res);
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ posts });
  } catch (err) {
    next(err);
  }
});

export default router;
