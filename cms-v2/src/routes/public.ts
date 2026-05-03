import { Router, Request, Response, NextFunction } from 'express';
import { getContent } from '../models/content';

const router = Router();

router.get('/events', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const row = await getContent('vls-events');
    const data = row?.data && typeof row.data === 'object' ? row.data as { events?: unknown[] } : {};
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ events: Array.isArray(data.events) ? data.events : [] });
  } catch (err) {
    next(err);
  }
});

export default router;
