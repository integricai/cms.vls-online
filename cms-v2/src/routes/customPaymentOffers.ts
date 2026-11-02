import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getCourseById } from '../models/courseGeoPrice';
import { upsertCustomer } from '../models/customer';
import {
  attachCheckoutSession,
  createPaymentOrder,
} from '../models/paymentOrder';
import {
  createCustomPaymentOffer,
  listCustomPaymentOffers,
  markCustomPaymentOfferEmailSent,
} from '../models/customPaymentOffer';
import { createActivityLog } from '../models/activityLog';
import { getPaymentProvider } from '../services/payments/registry';
import { sendCustomPaymentOfferEmail } from '../services/paymentEmails';

const router = Router();
router.use(authGuard, requireRole('admin', 'assistant'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Checkout success and cancel always return the student to the live site. */
const CUSTOM_PAYMENT_SITE_ORIGIN = 'https://vls-online.com';
const DESCRIPTION_MAX_LENGTH = 200;

function hasCourseSelection(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === 'string' && value.trim() === '') return false;
  return true;
}

function parsePaymentDescription(value: unknown): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

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
    const courseSelected = hasCourseSelection(req.body?.courseId);
    const courseId = parsePositiveInt(req.body?.courseId);
    const description = parsePaymentDescription(req.body?.description);
    const amount = parsePositiveAmount(req.body?.amount);
    const durationDays = parsePositiveInt(req.body?.durationDays);
    const discountReason = String(req.body?.discountReason ?? '').trim();

    if (!firstName) return res.status(400).json({ ok: false, error: 'First name is required' });
    if (!lastName) return res.status(400).json({ ok: false, error: 'Last name is required' });
    if (!email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ ok: false, error: 'A valid email address is required' });
    }
    if (courseSelected && !courseId) {
      return res.status(400).json({ ok: false, error: 'Selected course is not valid' });
    }
    if (amount == null) return res.status(400).json({ ok: false, error: 'Price must be greater than zero' });
    if (!discountReason) {
      return res.status(400).json({ ok: false, error: 'Reason for discount is required' });
    }

    const course = courseId ? await getCourseById(courseId) : null;
    if (courseId) {
      if (!course || !course.isActive) {
        return res.status(400).json({ ok: false, error: 'Selected course was not found or is inactive' });
      }
      if (!course.zenlerCourseId) {
        return res.status(400).json({ ok: false, error: 'Selected course is missing a Zenler course id' });
      }
      if (!durationDays) {
        return res.status(400).json({ ok: false, error: 'Duration (days) must be a positive whole number' });
      }
    } else if (!description) {
      return res.status(400).json({ ok: false, error: 'Add a description when no course is selected' });
    } else if (description.length > DESCRIPTION_MAX_LENGTH) {
      return res.status(400).json({ ok: false, error: `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer` });
    }

    const paymentTitle = course ? course.name : description;
    const optionType = course ? 'Custom / Resit offer' : 'Custom payment';
    const accessDays = course ? durationDays : null;

    const studentName = `${firstName} ${lastName}`.trim();
    const customer = await upsertCustomer({
      email,
      firstName,
      lastName,
      source: 'manual',
    });

    const order = await createPaymentOrder({
      paymentOptionId: null,
      courseId: course?.id ?? null,
      coursePriceId: null,
      customerId: customer.id,
      zenlerCourseId: course?.zenlerCourseId ?? '',
      courseTitle: paymentTitle,
      optionType,
      studentName,
      studentEmail: email,
      amount,
      currency: 'USD',
      durationDays: accessDays,
      discountPercent: null,
      environment: 'production',
    });

    const session = await getPaymentProvider('stripe').createCheckout({
      orderId: order.id,
      courseId: course?.id ?? null,
      coursePriceId: null,
      zenlerCourseId: course?.zenlerCourseId ?? '',
      courseTitle: paymentTitle,
      paymentCardTitle: course ? `${course.name} — Custom / Resit offer` : paymentTitle,
      amount,
      currency: 'USD',
      studentEmail: email,
      returnOrigin: CUSTOM_PAYMENT_SITE_ORIGIN,
      environment: 'production',
    });

    await attachCheckoutSession(order.id, {
      provider: session.provider,
      checkoutId: session.checkoutId,
    });

    const offer = await createCustomPaymentOffer({
      paymentOrderId: order.id,
      courseId: course?.id ?? null,
      createdByUserId: req.user?.userId ?? null,
      studentFirstName: firstName,
      studentLastName: lastName,
      studentEmail: email,
      amount,
      currency: 'USD',
      durationDays: accessDays,
      discountReason,
      stripeCheckoutSessionId: session.checkoutId,
      checkoutUrl: session.checkoutUrl,
    });

    let emailSent = false;
    try {
      await sendCustomPaymentOfferEmail({
        firstName,
        email,
        courseTitle: paymentTitle,
        amount,
        currency: 'USD',
        durationDays: accessDays,
        checkoutUrl: session.checkoutUrl,
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
      summary: `Created custom payment offer for ${email} — ${paymentTitle} ($${amount.toFixed(2)})`,
      changedPaths: ['custom_payment_offers'],
      afterJson: {
        offerId: offer.id,
        orderId: order.id,
        courseId: course?.id ?? null,
        description: course ? null : description,
        amount,
        durationDays: accessDays,
        emailSent,
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    return res.json({
      ok: true,
      data: {
        ...offer,
        courseTitle: paymentTitle,
        checkoutUrl: session.checkoutUrl,
        emailSent,
        orderStatus: order.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
