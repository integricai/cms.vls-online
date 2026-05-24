import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { listActiveCourses, listCourses } from '../models/course';
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
        normalPrice,
        discountPrice,
        currency,
        ctaButtonText,
        isActive,
      } = req.body as {
        courseId?: number;
        title?: string;
        description?: string;
        normalPrice?: number;
        discountPrice?: number | null;
        currency?: string;
        ctaButtonText?: string;
        isActive?: boolean;
      };

      if (!courseId || !title || normalPrice == null) {
        return res
          .status(400)
          .json({ ok: false, error: 'courseId, title and normalPrice are required' });
      }

      const card = await createPaymentCard({
        courseId,
        title,
        description: description ?? '',
        normalPrice,
        discountPrice: discountPrice ?? null,
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
        normalPrice:   req.body.normalPrice,
        discountPrice: req.body.discountPrice,
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
