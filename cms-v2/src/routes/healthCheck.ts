import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getUrlHealthState, listUrlHealthRows, makeAllDue, summarize } from '../models/urlHealthCheck';
import { runUrlHealthCheck } from '../services/urlHealthCheck';
import type { UrlHealthOverview } from '../../shared/urlHealth';

const router = Router();
router.use(authGuard);
router.use(requireRole('admin'));

const iso = (value: Date | null) => (value ? new Date(value).toISOString() : null);

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [rows, state] = await Promise.all([listUrlHealthRows(), getUrlHealthState()]);
    const data: UrlHealthOverview = {
      summary: summarize(rows),
      rows,
      sitemapSyncedAt: iso(state.sitemapSyncedAt),
      lastRunAt: iso(state.lastRunAt),
      lastError: state.lastError,
    };
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

/** "Check all now": reread the sitemap, make every URL due, run one batch. The cron does the rest. */
router.post('/run', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await makeAllDue();
    const result = await runUrlHealthCheck({ forceSitemap: true });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
