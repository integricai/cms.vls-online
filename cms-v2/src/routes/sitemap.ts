import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  countSiteUrlsByGroup,
  listEnabledSiteUrls,
  listSiteUrls,
  listTrackingNames,
  setSiteUrlEnabled,
  setSiteUrlTrackingName,
  type SiteUrlRecord,
} from '../models/siteUrl';
import { normalizeTrackingName } from '../../shared/pageTracking';
import { listSiteCacheTargets, refreshCachedPage } from '../services/siteCache';
import type { SitemapGroup } from '../services/sitemapPaths';
import { normalizeSiteOrigin } from '../services/sitemapPaths';
import { isSitemapWebhookRequestAuthorized, webhookRawBody } from '../services/sitemapWebhookAuth';
import { handleStoryblokSitemapWebhook, syncSiteUrlsFromStoryblok } from '../services/sitemapSync';
import { buildSitemapIndexXml, buildUrlSetXml, SITEMAP_GROUP_FILES } from '../services/sitemapXml';

const router = Router();

const GROUPS: SitemapGroup[] = ['pages', 'courses', 'blog'];

function defaultSiteOrigin(): string {
  return normalizeSiteOrigin(process.env.PUBLIC_SITE_URL || process.env.SITEMAP_SITE_URL || 'https://vls-online.com');
}

function parseGroup(value: unknown): SitemapGroup | null {
  return typeof value === 'string' && GROUPS.includes(value as SitemapGroup)
    ? value as SitemapGroup
    : null;
}

function sendXml(res: Response, xml: string) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  return res.status(200).send(xml);
}

function verifyWebhook(req: Request & { rawBody?: Buffer }): boolean {
  return isSitemapWebhookRequestAuthorized(req.headers, webhookRawBody(req));
}

// ── Public feed (Next.js / staging verification) ─────────────────

router.get('/tracking-names', async (_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  try {
    const names = await listTrackingNames();
    return res.json({
      ok: true,
      data: {
        names: Object.entries(names).map(([path, name]) => ({ path, name })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/feed', async (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const group = parseGroup(req.query.group);
    const rows = await listEnabledSiteUrls(group ?? undefined);
    return res.json({
      ok: true,
      data: {
        group: group ?? 'all',
        siteOrigin: defaultSiteOrigin(),
        urls: rows.map((row: SiteUrlRecord) => ({
          path: row.path,
          sitemapGroup: row.sitemapGroup,
          title: row.title,
          lastmod: row.lastmod,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/xml/:file', async (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const file = String(req.params.file || '');
    const origin = typeof req.query.base === 'string' && req.query.base.trim()
      ? normalizeSiteOrigin(req.query.base)
      : defaultSiteOrigin();

    if (file === 'sitemap.xml' || file === 'index') {
      return sendXml(res, buildSitemapIndexXml(origin));
    }

    const groupEntry = (Object.entries(SITEMAP_GROUP_FILES) as Array<[SitemapGroup | 'index', string]>)
      .find(([, name]) => name === file || `${name}` === file);

    const group = groupEntry?.[0];
    if (!group || group === 'index') {
      return res.status(404).json({ ok: false, error: 'Unknown sitemap file' });
    }

    const rows = await listEnabledSiteUrls(group);
    return sendXml(res, buildUrlSetXml(origin, rows));
  } catch (err) {
    next(err);
  }
});

// Storyblok publish, unpublish, and delete.
// Storyblok signs the raw body (webhook-signature). Next.js forwards with Bearer.
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!verifyWebhook(req)) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    const result = await handleStoryblokSitemapWebhook(req.body ?? {});
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ── Admin ────────────────────────────────────────────────────────

router.use(authGuard, requireRole('admin', 'analyst'));

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const group = typeof req.query.group === 'string' ? req.query.group : 'all';
    const enabled = typeof req.query.enabled === 'string' ? req.query.enabled : 'all';
    const q = typeof req.query.q === 'string' ? req.query.q : '';

    const parsedGroup = group === 'all' ? 'all' : parseGroup(group);
    if (group !== 'all' && !parsedGroup) {
      return res.status(400).json({ ok: false, error: 'Invalid group' });
    }

    const enabledFilter =
      enabled === 'enabled' || enabled === 'disabled' ? enabled : 'all';

    const [urls, counts] = await Promise.all([
      listSiteUrls({
        group: parsedGroup === null ? 'all' : parsedGroup,
        enabled: enabledFilter,
        q,
      }),
      countSiteUrlsByGroup(),
    ]);

    return res.json({
      ok: true,
      data: {
        urls,
        counts,
        siteOrigin: defaultSiteOrigin(),
        preview: {
          index: `/api/sitemap/xml/sitemap.xml`,
          pages: `/api/sitemap/xml/sitemap-pages.xml`,
          courses: `/api/sitemap/xml/sitemap-courses.xml`,
          blog: `/api/sitemap/xml/sitemap-blog.xml`,
        },
        webhookPath: '/api/sitemap/webhook',
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/tracking-name', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid id' });
    }
    const trackingName = normalizeTrackingName(req.body?.trackingName);
    if (trackingName === null) {
      return res.status(400).json({ ok: false, error: 'Use a tracking name of up to 120 characters, without quotes.' });
    }
    const row = await setSiteUrlTrackingName(id, trackingName);
    if (!row) return res.status(404).json({ ok: false, error: 'URL not found' });
    let cacheWarning: string | null = null;
    let cacheRefreshed = false;
    try {
      cacheWarning = await refreshCachedPage(row.path);
      cacheRefreshed = cacheWarning === null && listSiteCacheTargets().some(target => target.configured);
    } catch (err) {
      cacheWarning = err instanceof Error ? err.message : 'The name was saved. The live page was not refreshed.';
    }
    return res.json({ ok: true, data: { ...row, cacheWarning, cacheRefreshed } });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/enabled', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid id' });
    }
    if (typeof req.body?.isEnabled !== 'boolean') {
      return res.status(400).json({ ok: false, error: 'isEnabled boolean is required' });
    }
    const row = await setSiteUrlEnabled(id, req.body.isEnabled);
    if (!row) return res.status(404).json({ ok: false, error: 'URL not found' });
    return res.json({ ok: true, data: row });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await syncSiteUrlsFromStoryblok();
    const counts = await countSiteUrlsByGroup();
    return res.json({ ok: true, data: { ...result, counts } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default router;
