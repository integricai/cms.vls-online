import { Router, Request, Response, NextFunction } from 'express';
import { authGuard } from '../middleware/authGuard';
import { listActivityLogs } from '../models/activityLog';

const router = Router();
router.use(authGuard);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit ?? 25);
    const userId = req.query.userId != null ? Number(req.query.userId) : null;
    const isAdmin = req.user?.role === 'admin';
    const logs = await listActivityLogs({
      currentUserId: req.user!.userId,
      isAdmin,
      userId: Number.isInteger(userId) ? userId : null,
      limit: Number.isFinite(limit) ? limit : 25,
    });
    return res.json({ ok: true, data: logs });
  } catch (err) {
    next(err);
  }
});

export default router;
