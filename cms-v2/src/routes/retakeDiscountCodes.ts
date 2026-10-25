import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { RetakeCodeError, issueRetakeDiscountCode, listIssuedRetakeCodes, resendRetakeDiscountCode } from '../services/retakeDiscount';

const router = Router();
router.use(authGuard, requireRole('admin'));

function positiveInt(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const codes = await listIssuedRetakeCodes();
    return res.json({ ok: true, data: codes });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const courseId = positiveInt(body.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'Choose a course.' });
    const issued = await issueRetakeDiscountCode({
      firstName: String(body.firstName ?? ''),
      lastName: String(body.lastName ?? ''),
      email: String(body.email ?? ''),
      ccEmail: body.ccEmail,
      courseId,
      discountType: body.discountType,
      discountValue: body.discountValue,
      createdBy: req.user?.userId ?? null,
    });
    return res.status(201).json({ ok: true, data: issued });
  } catch (err) {
    if (err instanceof RetakeCodeError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.post('/:id/resend', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Discount code not found.' });
    const issued = await resendRetakeDiscountCode(id);
    return res.json({ ok: true, data: issued });
  } catch (err) {
    if (err instanceof RetakeCodeError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

export default router;
