import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { upsertCourse, getCourseByZenlerCourseId } from '../models/course';
import { createPaymentCard, updatePaymentCard } from '../models/coursePaymentCard';
import { fetchZenlerCourses } from '../services/zenlerCourseService';
import { createActivityLog } from '../models/activityLog';

const router = Router();
router.use(authGuard, requireRole('admin'));

function price(value: unknown): number {
  return typeof value === 'number' ? value : Number(value);
}

function validatePaymentOption(body: Record<string, unknown>): string | null {
  if (!String(body.zenlerCourseId ?? '').trim()) return 'zenlerCourseId is required';
  if (!String(body.paymentCardTitle ?? '').trim()) return 'paymentCardTitle is required';

  const normalPrice = price(body.normalPrice);
  const discountedPrice = body.discountedPrice == null || body.discountedPrice === ''
    ? null
    : price(body.discountedPrice);
  const isDiscountActive = body.isDiscountActive === true;

  if (!Number.isFinite(normalPrice) || normalPrice <= 0) return 'normalPrice must be greater than zero';
  if (isDiscountActive && (!Number.isFinite(discountedPrice) || Number(discountedPrice) <= 0)) {
    return 'discountedPrice must be greater than zero when discount is active';
  }
  if (discountedPrice != null && Number(discountedPrice) > normalPrice) {
    return 'discountedPrice should not be greater than normalPrice';
  }
  return null;
}

router.get('/zenler/courses', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await fetchZenlerCourses();
    for (const course of courses) {
      await upsertCourse(course);
    }

    return res.json({
      ok: true,
      data: {
        courses: courses.map(course => ({
          zenlerCourseId: course.zenlerCourseId,
          title: course.name,
          slug: course.slug,
          status: course.status,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/payment-options', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>;
    const error = validatePaymentOption(body);
    if (error) return res.status(400).json({ ok: false, error });

    const zenlerCourseId = String(body.zenlerCourseId).trim();
    const course = await getCourseByZenlerCourseId(zenlerCourseId);
    if (!course) {
      return res.status(400).json({ ok: false, error: 'Selected Zenler course has not been synced locally' });
    }

    const payload = {
      courseId: course.id,
      title: String(body.paymentCardTitle).trim(),
      description: String(body.description ?? '').trim(),
      optionType: String(body.optionType ?? '').trim() || null,
      normalPrice: price(body.normalPrice),
      discountPrice: body.discountedPrice == null || body.discountedPrice === ''
        ? null
        : price(body.discountedPrice),
      isDiscountActive: body.isDiscountActive === true,
      currency: String(body.currency ?? 'GBP').trim().toUpperCase() || 'GBP',
      ctaButtonText: String(body.buttonText ?? 'Pay Now').trim() || 'Pay Now',
      isActive: body.isActive !== false,
    };

    const id = body.id != null ? Number(body.id) : null;
    const paymentOption = id && Number.isInteger(id)
      ? await updatePaymentCard(id, payload)
      : await createPaymentCard(payload);

    if (!paymentOption) return res.status(404).json({ ok: false, error: 'Payment option not found' });
    await createActivityLog({
      userId: req.user!.userId,
      userEmail: req.user!.email,
      username: req.user!.username,
      userRole: req.user!.role,
      action: id ? 'update payment option' : 'create payment option',
      componentKey: 'payment-options',
      componentName: paymentOption.title,
      summary: `${id ? 'Updated' : 'Created'} payment option "${paymentOption.title}" for ${course.name}`,
      changedPaths: ['zenlerCourseId', 'paymentCardTitle', 'normalPrice', 'discountedPrice', 'isDiscountActive', 'isActive'],
      beforeJson: null,
      afterJson: paymentOption,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') ?? null,
    });
    return res.status(id ? 200 : 201).json({ ok: true, data: paymentOption });
  } catch (err) {
    next(err);
  }
});

export default router;
