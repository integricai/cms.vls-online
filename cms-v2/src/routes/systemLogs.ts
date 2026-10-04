import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { listSystemLogs, type SystemLogLevel } from '../models/systemLog';

const router = Router();
router.use(authGuard);
router.use(requireRole('admin'));

function parseLevel(value: unknown): SystemLogLevel | null {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === 'error' || text === 'warn' || text === 'info') return text;
  return null;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit ?? 50);
    const logs = await listSystemLogs({
      level: parseLevel(req.query.level),
      area: typeof req.query.area === 'string' ? req.query.area : null,
      q: typeof req.query.q === 'string' ? req.query.q : null,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return res.json({ ok: true, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
