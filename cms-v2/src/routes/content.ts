import { Router, Request, Response } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getContent, upsertContent, listContentKeys } from '../models/content';

const router = Router();

router.use(authGuard);

// GET /content — list all known content keys
router.get('/', async (_req: Request, res: Response) => {
  const keys = await listContentKeys();
  return res.json({ ok: true, data: keys });
});

// GET /content/:key — fetch a single content blob
router.get('/:key', async (req: Request, res: Response) => {
  const row = await getContent(req.params.key);
  if (!row) return res.status(404).json({ ok: false, error: 'Content not found' });
  return res.json({ ok: true, data: row });
});

// PUT /content/:key — upsert content (editor or admin)
router.put('/:key', requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  if (req.body == null || typeof req.body !== 'object') {
    return res.status(400).json({ ok: false, error: 'JSON body required' });
  }
  const row = await upsertContent(req.params.key, req.body, req.user!.userId);
  return res.json({ ok: true, data: row });
});

export default router;
