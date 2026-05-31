import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  listActiveCourses,
  listCourseDropdownOptions,
  listCourses,
  reorderCourses,
  replaceCourseDropdownOptions,
  updateCourseAdminMetadata,
} from '../models/course';
import {
  createPaymentCard,
  deletePaymentCard,
  listPaymentCards,
  updatePaymentCard,
} from '../models/coursePaymentCard';
import { syncCoursesFromZenler } from '../services/courseSyncService';

const router = Router();

router.use(authGuard);

// ── Debug: returns raw first-page Zenler response (admin only) ──────────────

router.get('/zenler-debug', requireRole('admin'), async (_req: Request, res: Response) => {
  const apiKey = process.env.ZENLER_API_KEY;
  const accountName = process.env.ZENLER_ACCOUNT_NAME;
  if (!apiKey || !accountName) return res.status(500).json({ ok: false, error: 'Zenler env vars missing' });
  const url = `https://${accountName.toLowerCase()}.newzenler.com/api/v1/courses?page=1`;
  try {
    const r = await fetch(url, {
      headers: { 'X-API-KEY': apiKey, 'X-Account-Name': accountName, 'Accept': 'application/json' },
    });
    const body = await r.json();
    return res.json({ ok: true, status: r.status, data: body });
  } catch (err) {
    return res.status(502).json({ ok: false, error: String(err) });
  }
});

// ── Course sync (admin only) ──────────────────────────────────────

router.post('/sync', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const result = await syncCoursesFromZenler();
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed';
    console.error('[course-sync]', err);
    return res.status(502).json({ ok: false, error: message });
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

router.put('/:id', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid course id' });
    }

    const course = await updateCourseAdminMetadata(id, {
      isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : undefined,
      sortOrder: Number.isInteger(req.body.sortOrder) ? req.body.sortOrder : undefined,
      qualification: req.body.qualification === undefined ? undefined : (req.body.qualification || null),
      courseLevel: req.body.courseLevel === undefined ? undefined : (req.body.courseLevel || null),
      courseOption: req.body.courseOption === undefined ? undefined : (req.body.courseOption || null),
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
