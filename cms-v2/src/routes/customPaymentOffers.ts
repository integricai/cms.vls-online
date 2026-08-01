import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getCourseById } from '../models/courseGeoPrice';
import { upsertCustomer } from '../models/customer';
import {
  attachStripeCheckoutSession,
  createPaymentOrder,
} from '../models/paymentOrder';
import {
  createCustomPaymentOffer,
  listCustomPaymentOffers,
  markCustomPaymentOfferEmailSent,
} from '../models/customPaymentOffer';
import { createActivityLog } from '../models/activityLog';
import { createStripeCheckoutSession } from '../services/stripeCheckout';
import { sendCustomPaymentOfferEmail } from '../services/paymentEmails';

const router = Router();
router.use(authGuard, requireRole('admin'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsePositiveAmount(value: unknown): number | null {
  const amount = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function parsePositiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').trim());
  if (!Number.isInteger(n) || n <= 0) return null;
  return n;
}

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parsePositiveInt(req.query.limit) ?? 50;
    const offers = await listCustomPaymentOffers(limit);
    return res.json({ ok: true, data: offers });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const firstName = String(req.body?.firstName ?? '').trim();
    const lastName = String(req.body?.lastName ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const courseId = parsePositiveInt(req.body?.courseId);
    const amount = parsePositiveAmount(req.body?.amount);
    const durationDays = parsePositiveInt(req.body?.durationDays);
    const discountReason = String(req.body?.discountReason ?? '').trim();

    if (!firstName) return res.status(400).json({ ok: false, error: 'First name is required' });
    if (!lastName) return res.status(400).json({ ok: false, error: 'Last name is required' });
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'A valid email address is required' });
    }
    if (!courseId) return res.status(400).json({ ok: false, error: 'Course is required' });
    if (amount == null) return res.status(400).json({ ok: false, error: 'Price must be greater than zero' });
    if (!durationDays) {
      return res.status(400).json({ ok: false, error: 'Duration (days) must be a positive whole number' });
    }
    if (!discountReason) {
      return res.status(400).json({ ok: false, error: 'Reason for discount is required' });
    }

    const course = await getCourseById(courseId);
    if (!course || !course.isActive) {
      return res.status(400).json({ ok: false, error: 'Selected course was not found or is inactive' });
    }
    if (!course.zenlerCourseId) {
      return res.status(400).json({ ok: false, error: 'Selected course is missing a Zenler course id' });
    }

    const studentName = `${firstName} ${lastName}`.trim();
    const customer = await upsertCustomer({
      email,
      firstName,
      lastName,
    });

    const order = await createPaymentOrder({
      paymentOptionId: null,
      courseId: course.id,
      coursePriceId: null,
      customerId: customer.id,
      zenlerCourseId: course.zenlerCourseId,
      courseTitle: course.name,
      optionType: 'Custom / Resit offer',
      studentName,
      studentEmail: email,
      amount,
      currency: 'USD',
      durationDays,
      discountPercent: null,
    });

    const session = await createStripeCheckoutSession({
      orderId: order.id,
      courseId: course.id,
      coursePriceId: null,
      zenlerCourseId: course.zenlerCourseId,
      courseTitle: course.name,
      paymentCardTitle: `${course.name} — Custom / Resit offer`,
      amount,
      currency: 'USD',
      studentEmail: email,
    });

    if (!session.url) {
      return res.status(502).json({ ok: false, error: 'Stripe did not return a checkout URL' });
    }

    await attachStripeCheckoutSession(order.id, session.id);

    const offer = await createCustomPaymentOffer({
      paymentOrderId: order.id,
      courseId: course.id,
      createdByUserId: req.user?.userId ?? null,
      studentFirstName: firstName,
      studentLastName: lastName,
      studentEmail: email,
      amount,
      currency: 'USD',
      durationDays,
      discountReason,
      stripeCheckoutSessionId: session.id,
      checkoutUrl: session.url,
    });

    let emailSent = false;
    try {
      await sendCustomPaymentOfferEmail({
        firstName,
        email,
        courseTitle: course.name,
        amount,
        currency: 'USD',
        durationDays,
        checkoutUrl: session.url,
      });
      await markCustomPaymentOfferEmailSent(offer.id);
      emailSent = true;
    } catch (emailErr) {
      console.error('[custom-payment-offer] email failed', emailErr);
    }

    await createActivityLog({
      userId: req.user?.userId ?? null,
      userEmail: req.user?.email ?? null,
      username: req.user?.username ?? null,
      userRole: req.user?.role ?? null,
      action: 'create',
      componentKey: 'custom-payment-offer',
      componentName: 'Custom Payment Offer',
      summary: `Created custom payment offer for ${email} — ${course.name} ($${amount.toFixed(2)})`,
      changedPaths: ['custom_payment_offers'],
      afterJson: {
        offerId: offer.id,
        orderId: order.id,
        courseId: course.id,
        amount,
        durationDays,
        emailSent,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      ok: true,
      data: {
        ...offer,
        courseTitle: course.name,
        checkoutUrl: session.url,
        emailSent,
        orderStatus: order.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
