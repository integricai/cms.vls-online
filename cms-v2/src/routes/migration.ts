import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import type {
  CourseMigrationRequest,
  MigrationTemplate,
  PageMigrationRequest,
  StoryblokRegion,
} from '../../shared/migrationTypes';
import {
  CourseMigrationError,
  CoursePageScrapeError,
  migrateCoursePage,
  migratePage,
  StoryblokApiError,
} from '../services/courseMigrationService';
import { verifyStoryblokAccess } from '../services/storyblokClient';
import { scanAndStoreMigrationPages } from '../services/pageScanner';
import {
  getMigrationPageById,
  listMigrationPages,
  updateMigrationPage,
} from '../models/migrationPage';
import { isMigrationTemplate, suggestDestinationSlug } from '../services/migrationUrlUtils';

const router = Router();

router.use(authGuard, requireRole('admin'));

function isRegion(value: unknown): value is StoryblokRegion {
  return value === 'eu' || value === 'us';
}

function parseCourseRequest(body: Record<string, unknown>): CourseMigrationRequest {
  return {
    pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
    storyblokSpaceId: typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId : '',
    storyblokAccessToken: typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken : '',
    storyblokRegion: isRegion(body.storyblokRegion) ? body.storyblokRegion : 'eu',
    publish: Boolean(body.publish),
    dryRun: Boolean(body.dryRun),
    template: isMigrationTemplate(body.template) ? body.template : undefined,
    destinationSlug: typeof body.destinationSlug === 'string' ? body.destinationSlug : undefined,
  };
}

function parsePageRequest(body: Record<string, unknown>): PageMigrationRequest {
  const pageUrl = typeof body.pageUrl === 'string' ? body.pageUrl : '';
  const template = isMigrationTemplate(body.template) ? body.template : 'course';
  const destinationSlug = typeof body.destinationSlug === 'string' && body.destinationSlug.trim()
    ? body.destinationSlug.trim()
    : suggestDestinationSlug(pageUrl, template);

  return {
    pageUrl,
    template,
    destinationSlug,
    storyblokSpaceId: typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId : '',
    storyblokAccessToken: typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken : '',
    storyblokRegion: isRegion(body.storyblokRegion) ? body.storyblokRegion : 'eu',
    publish: Boolean(body.publish),
    dryRun: Boolean(body.dryRun),
  };
}

router.get('/pages', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const pages = await listMigrationPages();
    return res.json({ ok: true, data: pages });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fetchTitles = Boolean((req.body as Record<string, unknown>)?.fetchTitles);
    const result = await scanAndStoreMigrationPages({ fetchTitles });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.patch('/pages/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid page ID' });
    }

    const body = req.body as Record<string, unknown>;
    const patch: Partial<{ template: MigrationTemplate; destinationSlug: string; title: string | null }> = {};

    if (isMigrationTemplate(body.template)) patch.template = body.template;
    if (typeof body.destinationSlug === 'string') patch.destinationSlug = body.destinationSlug.trim();
    if (typeof body.title === 'string') patch.title = body.title.trim() || null;

    const updated = await updateMigrationPage(id, patch);
    if (!updated) {
      return res.status(404).json({ ok: false, error: 'Migration page not found' });
    }

    return res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/page/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parsePageRequest(req.body as Record<string, unknown>);
    const result = await migratePage({ ...input, dryRun: true });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/page', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parsePageRequest(req.body as Record<string, unknown>);
    const result = await migratePage(input);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/course/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseCourseRequest(req.body as Record<string, unknown>);
    const result = await migrateCoursePage({ ...input, dryRun: true });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/course', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseCourseRequest(req.body as Record<string, unknown>);
    const result = await migrateCoursePage(input);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/storyblok/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const spaceId = typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId.trim() : '';
    const accessToken = typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken.trim() : '';
    const region = isRegion(body.storyblokRegion) ? body.storyblokRegion : 'eu';

    if (!spaceId || !accessToken) {
      return res.status(400).json({ ok: false, error: 'Storyblok space ID and access token are required' });
    }

    const result = await verifyStoryblokAccess({ spaceId, accessToken, region });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

function storyblokErrorStatus(status: number): number {
  if (status === 401 || status === 403) return 400;
  if (status >= 500) return 502;
  return 400;
}

router.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof CourseMigrationError || err instanceof CoursePageScrapeError) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  if (err instanceof StoryblokApiError) {
    return res.status(storyblokErrorStatus(err.status)).json({
      ok: false,
      error: err.message,
      data: err.details,
    });
  }
  return next(err);
});

export default router;
