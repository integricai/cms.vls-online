import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  listSiteCacheTargets,
  purgeSiteCache,
  SiteCacheError,
  type SiteCacheEnvironment,
} from '../services/siteCache';

const router = Router();
router.use(authGuard);
router.use(requireRole('admin'));

const ENVIRONMENTS = new Set<SiteCacheEnvironment>(['staging', 'production']);

function parseEnvironments(value: unknown): SiteCacheEnvironment[] | null {
  if (value === 'both') return ['staging', 'production'];
  if (typeof value === 'string' && ENVIRONMENTS.has(value as SiteCacheEnvironment)) {
    return [value as SiteCacheEnvironment];
  }
  return null;
}

router.get('/', (_req, res) => {
  return res.json({ ok: true, data: { environments: listSiteCacheTargets() } });
});

router.post('/purge', async (req, res, next) => {
  try {
    const environments = parseEnvironments(req.body?.environment);
    const purgeAll = Boolean(req.body?.purgeAll);
    const page = typeof req.body?.page === 'string' ? req.body.page : '';

    if (!environments) {
      return res.status(400).json({
        ok: false,
        error: 'environment must be staging, production, or both',
      });
    }
    if (!purgeAll && !page.trim()) {
      return res.status(400).json({ ok: false, error: 'Enter a page path or URL to purge' });
    }

    const results = [];
    for (const environment of environments) {
      results.push(await purgeSiteCache({ environment, purgeAll, page }));
    }
    return res.json({ ok: true, data: { results } });
  } catch (err) {
    if (err instanceof SiteCacheError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

export default router;
