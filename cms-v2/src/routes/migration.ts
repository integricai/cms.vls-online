import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import type {
  MigrationTemplate,
  StoryblokRegion,
} from '../../shared/migrationTypes';
import {
  CourseMigrationError,
  CoursePageScrapeError,
  generatePageStructure,
  migratePageContent,
  previewScrapePage,
  registerExternalBlogMigrationPage,
} from '../services/courseMigrationService';
import { confirmComponentCreation, generateComponentDraft } from '../services/componentGenerationService';
import { isStoryblokApiError, verifyStoryblokAccess } from '../services/storyblokClient';
import { scanAndStoreMigrationPages } from '../services/pageScanner';
import { listMigrationTemplateBlueprints, MigrationTemplateError } from '../services/migrationTemplateRegistry';
import {
  getMigrationPageById,
  listMigrationPages,
  updateMigrationPage,
  upsertPageContentMigrationPage,
} from '../models/migrationPage';
import { listPageContentFiles, summarizePageContentFile } from '../services/pageContentFileLoader';
import { isMigrationTemplate } from '../services/migrationUrlUtils';
import { MIGRATION_TEMPLATE_LABELS } from '../../shared/migrationTemplateLabels';

const router = Router();

router.use(authGuard, requireRole('admin'));

function isRegion(value: unknown): value is StoryblokRegion {
  return value === 'eu' || value === 'us';
}

router.get('/templates', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = listMigrationTemplateBlueprints().map(blueprint => ({
      template: blueprint.template,
      label: MIGRATION_TEMPLATE_LABELS[blueprint.template],
      fileName: blueprint.fileName,
      sectionCount: blueprint.sections.length,
      sections: blueprint.sections.map(section => ({
        key: section.key,
        label: section.label,
        component: section.component,
      })),
    }));
    return res.json({ ok: true, data: templates });
  } catch (err) {
    next(err);
  }
});

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

router.post('/pages/from-external-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sourceUrl = typeof (req.body as Record<string, unknown>)?.sourceUrl === 'string'
      ? ((req.body as Record<string, unknown>).sourceUrl as string).trim()
      : '';
    if (!sourceUrl) {
      return res.status(400).json({ ok: false, error: 'sourceUrl is required' });
    }
    const page = await registerExternalBlogMigrationPage(sourceUrl);
    return res.json({ ok: true, data: page });
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

function parsePageId(rawId: string): number {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) {
    throw new CourseMigrationError('Invalid page ID', 400);
  }
  return id;
}

function parseStoryblokCredentials(body: Record<string, unknown>) {
  return {
    storyblokSpaceId: typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId : '',
    storyblokAccessToken: typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken : '',
    storyblokRegion: isRegion(body.storyblokRegion) ? body.storyblokRegion : 'eu',
  };
}

router.get('/page-content-files', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const files = listPageContentFiles();
    return res.json({ ok: true, data: files });
  } catch (err) {
    next(err);
  }
});

router.post('/page-content/ensure-page', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filename = typeof (req.body as Record<string, unknown>)?.filename === 'string'
      ? (req.body as Record<string, unknown>).filename as string
      : '';
    if (!filename.trim()) {
      return res.status(400).json({ ok: false, error: 'filename is required' });
    }

    const summary = summarizePageContentFile(filename.trim());
    const page = await upsertPageContentMigrationPage({
      filename: summary.filename,
      canonicalUrl: summary.canonicalUrl,
      title: summary.title,
      slug: summary.slug,
    });
    return res.json({ ok: true, data: page });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/:id/scrape', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePageId(req.params.id);
    const body = req.body as Record<string, unknown>;
    const source = body.source === 'file' ? 'file' : body.source === 'live' ? 'live' : undefined;
    const filename = typeof body.filename === 'string' ? body.filename : undefined;
    const result = await previewScrapePage(id, { source, filename });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/:id/structure', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePageId(req.params.id);
    const credentials = parseStoryblokCredentials(req.body as Record<string, unknown>);
    if (!credentials.storyblokSpaceId.trim() || !credentials.storyblokAccessToken.trim()) {
      return res.status(400).json({ ok: false, error: 'Storyblok space ID and access token are required' });
    }
    const result = await generatePageStructure(id, credentials);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/:id/content', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePageId(req.params.id);
    const body = req.body as Record<string, unknown>;
    const credentials = parseStoryblokCredentials(body);
    if (!credentials.storyblokSpaceId.trim() || !credentials.storyblokAccessToken.trim()) {
      return res.status(400).json({ ok: false, error: 'Storyblok space ID and access token are required' });
    }
    const result = await migratePageContent(id, { ...credentials, publish: Boolean(body.publish) });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/:id/generate-component', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePageId(req.params.id);
    const credentials = parseStoryblokCredentials(req.body as Record<string, unknown>);
    if (!credentials.storyblokSpaceId.trim() || !credentials.storyblokAccessToken.trim()) {
      return res.status(400).json({ ok: false, error: 'Storyblok space ID and access token are required' });
    }
    const result = await generateComponentDraft(id, credentials);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/pages/:id/confirm-component', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = parsePageId(req.params.id);
    const body = req.body as Record<string, unknown>;
    const credentials = parseStoryblokCredentials(body);
    if (!credentials.storyblokSpaceId.trim() || !credentials.storyblokAccessToken.trim()) {
      return res.status(400).json({ ok: false, error: 'Storyblok space ID and access token are required' });
    }
    const componentName = typeof body.componentName === 'string' ? body.componentName : '';
    const storyblokSchema = body.storyblokSchema as { components?: unknown } | undefined;
    if (!componentName || !storyblokSchema || !Array.isArray(storyblokSchema.components)) {
      return res.status(400).json({ ok: false, error: 'componentName and storyblokSchema.components are required' });
    }
    const result = await confirmComponentCreation(id, {
      ...credentials,
      componentName,
      storyblokSchema: storyblokSchema as { components: Array<Record<string, unknown>> },
    });
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
  if (err instanceof CourseMigrationError || err instanceof CoursePageScrapeError || err instanceof MigrationTemplateError) {
    return res.status(err.status).json({ ok: false, error: err.message });
  }
  if (isStoryblokApiError(err)) {
    return res.status(storyblokErrorStatus(err.status)).json({
      ok: false,
      error: err.message,
      data: err.details,
    });
  }
  console.error('[migration]', err);
  if (err instanceof Error && err.message.trim()) {
    return res.status(500).json({ ok: false, error: err.message });
  }
  return next(err);
});

export default router;
