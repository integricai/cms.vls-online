import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  createManualCourse,
  getCourseByZenlerCourseId,
  listActiveCourses,
  listBannerCourses,
  listCourseDropdownOptions,
  listCourses,
  reorderCourses,
  replaceCourseDropdownOptions,
  updateCourseAdminMetadata,
} from '../models/course';
import { buildCoursePageUrlCsv, importCoursePageUrlsFromCsv, normalizeCoursePageUrl } from '../services/coursePageUrlImport';
import type { CoursePageUrlImportResult } from '../../shared/types';
import {
  createPaymentCard,
  deletePaymentCard,
  listPaymentCards,
  updatePaymentCard,
} from '../models/coursePaymentCard';
import { listCoursePrices, upsertCoursePrices, upsertScrapedCoursePrices } from '../models/coursePrice';
import { syncCourseSalesPageUrlsFromStoryblok } from '../services/courseSalesPageUrlSync';
import { scrapeActiveCoursePrices } from '../services/coursePriceScraper';
import { applyCourseUrlChanges, publishCourseRedirects } from '../services/courseUrlApply';
import { getCourseUrlRewriteState, listRecentCourseUrlFailures, summarizeCourseUrlChanges } from '../models/courseUrlChange';

const router = Router();

router.use(authGuard);

router.post('/sync-storyblok-urls', requireRole('admin', 'editor'), async (_req: Request, res: Response) => {
  try {
    const result = await syncCourseSalesPageUrlsFromStoryblok();
    if (!result.ok) {
      return res.status(502).json({ ok: false, error: result.error ?? 'Storyblok URL sync failed' });
    }
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storyblok URL sync failed';
    console.error('[storyblok-url-sync]', err);
    return res.status(502).json({ ok: false, error: message });
  }
});

router.post('/scrape-prices', requireRole('admin', 'editor'), async (_req: Request, res: Response) => {
  try {
    const scraped = await scrapeActiveCoursePrices();
    const prices = await upsertScrapedCoursePrices(scraped);
    return res.json({ ok: true, data: { scraped, prices } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Price scrape failed';
    console.error('[course-price-scrape]', err);
    return res.status(502).json({ ok: false, error: message });
  }
});

router.get('/prices', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const prices = await listCoursePrices();
    return res.json({ ok: true, data: prices });
  } catch (err) {
    next(err);
  }
});

router.put('/prices', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incoming = Array.isArray(req.body.prices) ? req.body.prices : [];
    const prices = incoming
      .map((price: {
        courseId?: unknown;
        isEnabled?: unknown;
        regularPrice?: unknown;
        regularPrice2?: unknown;
        currency?: unknown;
        discountPercent?: unknown;
        discountPercent2?: unknown;
        sourceUrl?: unknown;
        rawPriceText?: unknown;
      }) => ({
        courseId: Number(price.courseId),
        isEnabled: typeof price.isEnabled === 'boolean' ? price.isEnabled : undefined,
        regularPrice: Number(price.regularPrice),
        regularPrice2: Number(price.regularPrice2),
        currency: String(price.currency || 'USD'),
        discountPercent: Number(price.discountPercent),
        discountPercent2: Number(price.discountPercent2),
        sourceUrl: typeof price.sourceUrl === 'string' ? price.sourceUrl : null,
        rawPriceText: typeof price.rawPriceText === 'string' ? price.rawPriceText : null,
      }))
      .filter((price: { courseId: number }) => Number.isInteger(price.courseId));

    const saved = await upsertCoursePrices(prices);
    return res.json({ ok: true, data: saved });
  } catch (err) {
    next(err);
  }
});

// ── Courses (read) ────────────────────────────────────────────────

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await listCourses();
    return res.json({ ok: true, data: courses });
  } catch (err) {
    next(err);
  }
});

router.get('/active', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await listActiveCourses();
    return res.json({ ok: true, data: courses });
  } catch (err) {
    next(err);
  }
});

router.get('/banner', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await listBannerCourses();
    return res.json({ ok: true, data: courses });
  } catch (err) {
    next(err);
  }
});

router.get('/dropdown-options', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const options = await listCourseDropdownOptions();
    return res.json({ ok: true, data: options });
  } catch (err) {
    next(err);
  }
});

router.put('/dropdown-options', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as {
      qualification?: string[];
      level?: string[];
      course_option?: string[];
    };
    const normalizeValues = (values: unknown): string[] => Array.isArray(values)
      ? Array.from(new Set(values.map(value => String(value).trim()).filter(Boolean)))
      : [];

    const options = await replaceCourseDropdownOptions({
      qualification: normalizeValues(body.qualification),
      level: normalizeValues(body.level),
      course_option: normalizeValues(body.course_option),
    });
    return res.json({ ok: true, data: options });
  } catch (err) {
    next(err);
  }
});

router.get('/export', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = buildCoursePageUrlCsv(await listCourses());
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="cms-courses.csv"');
    return res.send(csv);
  } catch (err) {
    next(err);
  }
});

router.post('/import-page-urls', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const csv = typeof req.body?.csv === 'string' ? req.body.csv : '';
    if (!csv.trim()) {
      return res.status(400).json({ ok: false, error: 'Provide csv text' });
    }
    const result: CoursePageUrlImportResult = await importCoursePageUrlsFromCsv(csv);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/url-changes', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [summary, failures, rewrite] = await Promise.all([
      summarizeCourseUrlChanges(),
      listRecentCourseUrlFailures(),
      getCourseUrlRewriteState(),
    ]);
    return res.json({ ok: true, data: { summary, failures, lastError: rewrite.lastError } });
  } catch (err) {
    next(err);
  }
});

router.post('/url-changes/apply', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await applyCourseUrlChanges();
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Course URL update failed';
    console.error('[course-url/apply]', err);
    return res.status(502).json({ ok: false, error: message });
  }
});

router.post('/url-changes/publish-redirects', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await publishCourseRedirects();
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Redirect publish failed';
    console.error('[course-url/publish-redirects]', err);
    return res.status(502).json({ ok: false, error: message });
  }
});

router.put('/reorder/order', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = Array.isArray(req.body.ids)
      ? req.body.ids.map((id: unknown) => Number(id)).filter((id: number) => Number.isInteger(id))
      : [];
    if (!ids.length) return res.status(400).json({ ok: false, error: 'ids are required' });

    await reorderCourses(ids);
    const courses = await listCourses();
    return res.json({ ok: true, data: courses });
  } catch (err) {
    next(err);
  }
});

function requiredText(value: unknown): string {
  return String(value ?? '').trim();
}

function isUniqueViolation(err: unknown): boolean {
  const error = err as { code?: string; cause?: { code?: string } };
  return error.code === '23505' || error.cause?.code === '23505';
}

router.post('/', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = requiredText(req.body.name);
    const zenlerCourseId = requiredText(req.body.zenlerCourseId);
    const coursePageUrl = normalizeCoursePageUrl(req.body.coursePageUrl);
    const qualification = requiredText(req.body.qualification);
    const courseOption = requiredText(req.body.courseOption);
    const rawLevels: unknown[] = Array.isArray(req.body.courseLevels) ? req.body.courseLevels : [];
    const courseLevels: string[] = Array.from(new Set(
      rawLevels.map(level => String(level).trim()).filter(level => level.length > 0),
    ));

    const missing: string[] = [];
    if (!name) missing.push('course name');
    if (!zenlerCourseId) missing.push('Zenler ID');
    if (!coursePageUrl) missing.push('Storyblok URL');
    if (!qualification) missing.push('qualification');
    if (courseLevels.length === 0) missing.push('level');
    if (!courseOption) missing.push('course option');
    if (missing.length > 0) {
      return res.status(400).json({ ok: false, error: `Required: ${missing.join(', ')}` });
    }
    if (!coursePageUrl) {
      return res.status(400).json({ ok: false, error: 'Required: Storyblok URL' });
    }

    const existing = await getCourseByZenlerCourseId(zenlerCourseId);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'A course with this Zenler ID already exists' });
    }

    const course = await createManualCourse({
      name,
      zenlerCourseId,
      coursePageUrl,
      qualification,
      courseLevels,
      courseOption,
      isActive: req.body.isActive !== false,
      enableInBanner: req.body.enableInBanner === true,
      enableInNavigation: req.body.enableInNavigation === true,
    });
    return res.status(201).json({ ok: true, data: course });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ ok: false, error: 'A course with this Zenler ID already exists' });
    }
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid course id' });
    }

    const course = await updateCourseAdminMetadata(id, {
      isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : undefined,
      enableInBanner: typeof req.body.enableInBanner === 'boolean' ? req.body.enableInBanner : undefined,
      enableInNavigation: typeof req.body.enableInNavigation === 'boolean' ? req.body.enableInNavigation : undefined,
      sortOrder: Number.isInteger(req.body.sortOrder) ? req.body.sortOrder : undefined,
      qualification: req.body.qualification === undefined ? undefined : (req.body.qualification || null),
      courseLevel: req.body.courseLevel === undefined ? undefined : (req.body.courseLevel || null),
      courseLevels: req.body.courseLevels === undefined
        ? undefined
        : (Array.isArray(req.body.courseLevels)
          ? req.body.courseLevels.map((level: unknown) => String(level).trim()).filter(Boolean)
          : []),
      courseOption: req.body.courseOption === undefined ? undefined : (req.body.courseOption || null),
      coursePageUrl: req.body.coursePageUrl === undefined
        ? undefined
        : normalizeCoursePageUrl(req.body.coursePageUrl),
    });

    if (!course) return res.status(404).json({ ok: false, error: 'Course not found' });
    return res.json({ ok: true, data: course });
  } catch (err) {
    next(err);
  }
});

// ── Payment cards ─────────────────────────────────────────────────

router.get('/payment-cards', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = await listPaymentCards();
    return res.json({ ok: true, data: cards });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/payment-cards',
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        courseId,
        title,
        description,
        optionType,
        normalPrice,
        discountPrice,
        isDiscountActive,
        currency,
        ctaButtonText,
        isActive,
      } = req.body as {
        courseId?: number;
        title?: string;
        description?: string;
        optionType?: string | null;
        normalPrice?: number;
        discountPrice?: number | null;
        isDiscountActive?: boolean;
        currency?: string;
        ctaButtonText?: string;
        isActive?: boolean;
      };

      if (!courseId || !title || normalPrice == null) {
        return res
          .status(400)
          .json({ ok: false, error: 'courseId, title and normalPrice are required' });
      }
      if (normalPrice <= 0) {
        return res.status(400).json({ ok: false, error: 'normalPrice must be greater than zero' });
      }
      if (isDiscountActive && (!discountPrice || discountPrice <= 0)) {
        return res.status(400).json({ ok: false, error: 'discountPrice must be greater than zero when active' });
      }
      if (discountPrice != null && discountPrice > normalPrice) {
        return res.status(400).json({ ok: false, error: 'discountPrice should not be greater than normalPrice' });
      }

      const card = await createPaymentCard({
        courseId,
        title,
        description: description ?? '',
        optionType: optionType ?? null,
        normalPrice,
        discountPrice: discountPrice ?? null,
        isDiscountActive: isDiscountActive ?? false,
        currency: currency ?? 'GBP',
        ctaButtonText: ctaButtonText ?? 'Enrol Now',
        isActive: isActive ?? true,
      });

      return res.status(201).json({ ok: true, data: card });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  '/payment-cards/:id',
  requireRole('admin', 'editor'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid id' });
      }

      const card = await updatePaymentCard(id, {
        courseId:      req.body.courseId,
        title:         req.body.title,
        description:   req.body.description,
        optionType:    req.body.optionType,
        normalPrice:   req.body.normalPrice,
        discountPrice: req.body.discountPrice,
        isDiscountActive: req.body.isDiscountActive,
        currency:      req.body.currency,
        ctaButtonText: req.body.ctaButtonText,
        isActive:      req.body.isActive,
      });

      if (!card) return res.status(404).json({ ok: false, error: 'Payment card not found' });
      return res.json({ ok: true, data: card });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  '/payment-cards/:id',
  requireRole('admin'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) {
        return res.status(400).json({ ok: false, error: 'Invalid id' });
      }
      const deleted = await deletePaymentCard(id);
      if (!deleted) return res.status(404).json({ ok: false, error: 'Payment card not found' });
      return res.json({ ok: true, data: { id } });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
