import { Router, Request, Response, NextFunction } from 'express';
import type { CoursePaymentCard, PublicPaymentOption } from '../../shared/types';
import {
  getPaymentCardByZenlerCourseId,
  listActivePaymentCardsBySlug,
} from '../models/coursePaymentCard';

const router = Router();

function toPublicOption(card: CoursePaymentCard): PublicPaymentOption {
  return {
    id: `payopt_${card.id}`,
    zenlerCourseId: card.zenlerCourseId ?? '',
    courseTitle: card.courseName ?? card.title,
    courseSlug: card.courseSlug ?? null,
    paymentCardTitle: card.title,
    description: card.description,
    optionType: card.optionType,
    normalPrice: card.normalPrice,
    discountedPrice: card.discountPrice,
    isDiscountActive: card.isDiscountActive,
    finalDisplayPrice: card.finalDisplayPrice,
    currency: card.currency,
    buttonText: card.ctaButtonText,
  };
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const pageSlug = String(req.query.pageSlug ?? '').trim();
    if (!pageSlug) return res.status(400).json({ ok: false, error: 'pageSlug is required' });

    const paymentOptions = await listActivePaymentCardsBySlug(pageSlug);
    return res.json({ paymentOptions: paymentOptions.map(toPublicOption) });
  } catch (err) {
    next(err);
  }
});

router.get('/by-course/:zenlerCourseId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const paymentOptions = await getPaymentCardByZenlerCourseId(req.params.zenlerCourseId);
    return res.json({ paymentOptions: paymentOptions.map(toPublicOption) });
  } catch (err) {
    next(err);
  }
});

export default router;
