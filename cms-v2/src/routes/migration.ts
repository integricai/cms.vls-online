import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import type { CourseMigrationRequest, StoryblokRegion } from '../../shared/migrationTypes';
import {
  CourseMigrationError,
  CoursePageScrapeError,
  migrateCoursePage,
  StoryblokApiError,
} from '../services/courseMigrationService';
import { verifyStoryblokAccess } from '../services/storyblokClient';

const router = Router();

router.use(authGuard, requireRole('admin'));

function isRegion(value: unknown): value is StoryblokRegion {
  return value === 'eu' || value === 'us';
}

function parseRequest(body: Record<string, unknown>): CourseMigrationRequest {
  return {
    pageUrl: typeof body.pageUrl === 'string' ? body.pageUrl : '',
    storyblokSpaceId: typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId : '',
    storyblokAccessToken: typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken : '',
    storyblokRegion: isRegion(body.storyblokRegion) ? body.storyblokRegion : 'eu',
    publish: Boolean(body.publish),
    dryRun: Boolean(body.dryRun),
  };
}

router.post('/course/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseRequest(req.body as Record<string, unknown>);
    const result = await migrateCoursePage({ ...input, dryRun: true });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/course', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = parseRequest(req.body as Record<string, unknown>);
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
  // Never forward Storyblok 401/403 — the CMS client treats any 401 as a session logout.
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
      error: err.status === 401
        ? 'Storyblok rejected the access token. Check the token and region, then try again.'
        : err.message,
      data: err.details,
    });
  }
  return next(err);
});

export default router;
