import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import type { CourseGeoPriceInput } from '../../shared/types';
import {
  createGeoPrice,
  deactivateGeoPrice,
  getCourseById,
  getGeoPriceById,
  listActiveCoursesMissingDefaultPrice,
  listCoursePricingSummaries,
  listGeoPricesForCourse,
  setDefaultGeoPrice,
  updateGeoPrice,
} from '../models/courseGeoPrice';
import {
  buildPricingTemplateCsv,
  commitCoursePriceImport,
  parseCsvText,
  previewCoursePriceImport,
} from '../services/courseGeoPriceImport';
import {
  normalizeGeoPriceInput,
  validateGeoPriceInput,
} from '../services/courseGeoPriceValidation';
import { detectCountryFromRequest } from '../services/geoDetection';
import { PricingResolutionError, resolveCoursePrice } from '../services/pricingResolver';

const router = Router();

function parseDurationMonths(value: unknown): number | null {
  const months = Number(value);
  return Number.isInteger(months) && months >= 1 && months <= 6 ? months : null;
}

function parseCourseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseBodyInput(body: Record<string, unknown>, courseId: number): CourseGeoPriceInput {
  const pricingMode = body.pricingMode === 'session' ? 'session' : 'duration';
  return normalizeGeoPriceInput({
    courseId,
    name: String(body.name ?? body.priceName ?? ''),
    amount: Number(body.amount),
    compareAtAmount: body.compareAtAmount == null || body.compareAtAmount === ''
      ? null
      : Number(body.compareAtAmount),
    discountPercent: body.discountPercent == null || body.discountPercent === ''
      ? null
      : Number(body.discountPercent),
    isDefault: Boolean(body.isDefault),
    isActive: body.isActive !== false && body.isActive !== 'false',
    stripePriceId: body.stripePriceId == null || body.stripePriceId === ''
      ? null
      : String(body.stripePriceId),
    evenDeals: body.evenDeals == null || body.evenDeals === ''
      ? null
      : String(body.evenDeals),
    pricingMode,
    examSessionMonth: body.examSessionMonth == null || body.examSessionMonth === ''
      ? null
      : Number(body.examSessionMonth),
    examSessionYear: body.examSessionYear == null || body.examSessionYear === ''
      ? null
      : Number(body.examSessionYear),
    durationDays: body.durationDays == null || body.durationDays === ''
      ? null
      : Number(body.durationDays),
  });
}

// ── Public resolve (no auth) ──────────────────────────────────────

router.get('/resolve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = parseCourseId(req.query.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'courseId is required' });

    const geo = detectCountryFromRequest(req, String(req.query.countryCode ?? ''));
    const campaignCode = String(req.query.campaignCode ?? '').trim() || null;
    const durationMonths = parseDurationMonths(req.query.durationMonths);

    const resolved = await resolveCoursePrice({
      courseId,
      durationMonths,
      campaignCode,
      detectedCountryCode: geo.countryCode,
    });

    return res.json({
      ok: true,
      data: {
        ...resolved,
        geoSource: geo.source,
      },
    });
  } catch (err) {
    if (err instanceof PricingResolutionError) {
      return res.status(404).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.get('/geo', (req: Request, res: Response) => {
  const geo = detectCountryFromRequest(req, String(req.query.countryCode ?? ''));
  return res.json({ ok: true, data: geo });
});

// ── Admin routes ──────────────────────────────────────────────────

router.get('/admin/courses', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim() || undefined;
    const data = await listCoursePricingSummaries(search);
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/validation', authGuard, requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    const missing = await listActiveCoursesMissingDefaultPrice();
    return res.json({
      ok: true,
      data: {
        valid: missing.length === 0,
        missingDefaultPrice: missing,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get('/admin/template', authGuard, requireRole('admin', 'editor'), (_req, res) => {
  const csv = buildPricingTemplateCsv();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="course-pricing-template.csv"');
  return res.send(csv);
});

router.get('/admin/courses/:courseId/prices', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const courseId = parseCourseId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'Invalid course id' });

    const course = await getCourseById(courseId);
    if (!course) return res.status(404).json({ ok: false, error: 'Course not found' });

    const prices = await listGeoPricesForCourse(courseId);
    return res.json({ ok: true, data: { course, prices } });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/courses/:courseId/prices', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const courseId = parseCourseId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'Invalid course id' });

    const course = await getCourseById(courseId);
    if (!course) return res.status(404).json({ ok: false, error: 'Course not found' });

    const input = parseBodyInput(req.body ?? {}, courseId);
    const issues = validateGeoPriceInput(input);
    if (issues.length > 0) {
      return res.status(400).json({ ok: false, error: issues[0]!.message, data: { issues } });
    }

    const price = await createGeoPrice(input);
    const storyblokSync = await maybeSyncStoryblokForCourse(courseId, req.body ?? {});
    return res.status(201).json({ ok: true, data: price, storyblokSync });
  } catch (err) {
    next(err);
  }
});

router.put('/admin/prices/:priceId', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const priceId = parseCourseId(req.params.priceId);
    if (!priceId) return res.status(400).json({ ok: false, error: 'Invalid price id' });

    const existing = await getGeoPriceById(priceId);
    if (!existing) return res.status(404).json({ ok: false, error: 'Price not found' });

    const input = parseBodyInput({ ...req.body, courseId: existing.courseId }, existing.courseId);
    const issues = validateGeoPriceInput(input);
    if (issues.length > 0) {
      return res.status(400).json({ ok: false, error: issues[0]!.message, data: { issues } });
    }

    const price = await updateGeoPrice(priceId, input);
    const storyblokSync = await maybeSyncStoryblokForCourse(existing.courseId, req.body ?? {});
    return res.json({ ok: true, data: price, storyblokSync });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/prices/:priceId/deactivate', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const priceId = parseCourseId(req.params.priceId);
    if (!priceId) return res.status(400).json({ ok: false, error: 'Invalid price id' });
    const price = await deactivateGeoPrice(priceId);
    if (!price) return res.status(404).json({ ok: false, error: 'Price not found' });
    const storyblokSync = await maybeSyncStoryblokForCourse(price.courseId, req.body ?? {});
    return res.json({ ok: true, data: price, storyblokSync });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/courses/:courseId/prices/:priceId/set-default', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const courseId = parseCourseId(req.params.courseId);
    const priceId = parseCourseId(req.params.priceId);
    if (!courseId || !priceId) return res.status(400).json({ ok: false, error: 'Invalid ids' });

    const price = await setDefaultGeoPrice(courseId, priceId);
    if (!price) return res.status(404).json({ ok: false, error: 'Price not found for course' });
    const storyblokSync = await maybeSyncStoryblokForCourse(courseId, req.body ?? {});
    return res.json({ ok: true, data: price, storyblokSync });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/import/preview', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    let rows: Array<Record<string, unknown>> = [];

    if (typeof req.body?.csv === 'string') {
      rows = parseCsvText(req.body.csv);
    } else if (Array.isArray(req.body?.rows)) {
      rows = req.body.rows;
    } else {
      return res.status(400).json({ ok: false, error: 'Provide csv text or rows array' });
    }

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'No data rows found in upload' });
    }

    const preview = await previewCoursePriceImport(rows);
    return res.json({ ok: true, data: preview });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/import/commit', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    let preview = req.body?.preview;
    if (!preview) {
      let rows: Array<Record<string, unknown>> = [];
      if (typeof req.body?.csv === 'string') rows = parseCsvText(req.body.csv);
      else if (Array.isArray(req.body?.rows)) rows = req.body.rows;
      else return res.status(400).json({ ok: false, error: 'Provide preview, csv, or rows' });
      preview = await previewCoursePriceImport(rows);
    }

    const importValidRowsOnly = Boolean(req.body?.importValidRowsOnly);
    if (preview.errors?.length > 0 && !importValidRowsOnly) {
      return res.status(400).json({
        ok: false,
        error: 'Validation errors found. Fix them or choose “Import valid rows only”.',
        data: preview,
      });
    }

    const result = await commitCoursePriceImport(preview, { importValidRowsOnly });
    return res.json({ ok: true, data: { preview, result } });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/import/error-report', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const errors = Array.isArray(req.body?.errors) ? req.body.errors : [];
    const lines = [
      'row_number,field,message',
      ...errors.map((err: { rowNumber?: number; field?: string; message?: string }) => {
        const row = String(err.rowNumber ?? '');
        const field = String(err.field ?? '').replace(/"/g, '""');
        const message = String(err.message ?? '').replace(/"/g, '""');
        return `${row},"${field}","${message}"`;
      }),
    ];
    const csv = `${lines.join('\n')}\n`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="course-pricing-import-errors.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

function parseStoryblokSyncOptions(body: Record<string, unknown>) {
  return {
    storyblokSpaceId: typeof body.storyblokSpaceId === 'string' ? body.storyblokSpaceId : undefined,
    storyblokAccessToken: typeof body.storyblokAccessToken === 'string' ? body.storyblokAccessToken : undefined,
    storyblokRegion: body.storyblokRegion === 'us' ? 'us' as const : 'eu' as const,
    publish: Boolean(body.publish),
    dryRun: Boolean(body.dryRun),
  };
}

async function maybeSyncStoryblokForCourse(
  courseId: number,
  body: Record<string, unknown>,
): Promise<unknown | null> {
  if (body.syncStoryblok !== true && body.syncStoryblok !== 'true') return null;

  const { resolveStoryblokConfig, syncCoursePricingToStoryblok } = await import('../services/storyblokCoursePricingSync');
  const options = parseStoryblokSyncOptions(body);
  const config = resolveStoryblokConfig(options);
  if (!config) {
    throw new Error('Storyblok credentials are required when syncStoryblok is true');
  }

  return syncCoursePricingToStoryblok(courseId, config, {
    publish: options.publish,
    dryRun: options.dryRun,
  });
}

router.post('/admin/courses/:courseId/storyblok-sync', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const courseId = parseCourseId(req.params.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'Invalid course id' });

    const course = await getCourseById(courseId);
    if (!course) return res.status(404).json({ ok: false, error: 'Course not found' });

    const { resolveStoryblokConfig, syncCoursePricingToStoryblok } = await import('../services/storyblokCoursePricingSync');
    const options = parseStoryblokSyncOptions(req.body ?? {});
    const config = resolveStoryblokConfig(options);
    if (!config) {
      return res.status(400).json({
        ok: false,
        error: 'Storyblok credentials are required (storyblokAccessToken or STORYBLOK_PERSONAL_TOKEN env)',
      });
    }

    const result = await syncCoursePricingToStoryblok(courseId, config, {
      publish: options.publish,
      dryRun: options.dryRun,
    });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/admin/storyblok-sync', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const { resolveStoryblokConfig, syncAllCoursePricingToStoryblok } = await import('../services/storyblokCoursePricingSync');
    const options = parseStoryblokSyncOptions(req.body ?? {});
    const config = resolveStoryblokConfig(options);
    if (!config) {
      return res.status(400).json({
        ok: false,
        error: 'Storyblok credentials are required (storyblokAccessToken or STORYBLOK_PERSONAL_TOKEN env)',
      });
    }

    const results = await syncAllCoursePricingToStoryblok(config, {
      publish: options.publish,
      dryRun: options.dryRun,
    });
    return res.json({ ok: true, data: results });
  } catch (err) {
    next(err);
  }
});

export default router;
