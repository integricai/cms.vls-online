import { Router, Request, Response } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getContent, upsertContent, listContentKeys } from '../models/content';
import { createActivityLog } from '../models/activityLog';
import { diffContent } from '../utils/contentDiff';

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
  const before = await getContent(req.params.key);
  const row = await upsertContent(req.params.key, req.body, req.user!.userId);
  const diff = diffContent(before?.data ?? null, req.body);
  await createActivityLog({
    userId: req.user!.userId,
    userEmail: req.user!.email,
    username: req.user!.username,
    userRole: req.user!.role,
    action: 'save',
    componentKey: req.params.key,
    componentName: diff.componentName,
    summary: diff.summary,
    changedPaths: diff.changedPaths,
    beforeJson: before?.data ?? null,
    afterJson: req.body,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') ?? null,
  });
  return res.json({ ok: true, data: row });
});

export default router;
