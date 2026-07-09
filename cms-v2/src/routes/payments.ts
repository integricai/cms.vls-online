import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentCard } from '../models/coursePaymentCard';
import { getCourseById, getGeoPriceById } from '../models/courseGeoPrice';
import {
  attachStripeCheckoutSession,
  createPaymentOrder,
  getPaymentOrderByCheckoutSession,
  markOrderEmailsSent,
  markPaymentOrderPaid,
  updateZenlerEnrollment,
} from '../models/paymentOrder';
import {
  createStripeCheckoutSession,
  verifyStripeWebhook,
} from '../services/stripeCheckout';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
} from '../services/paymentEmails';
import { detectCountryFromRequest } from '../services/geoDetection';
import { PricingResolutionError, resolveCoursePrice } from '../services/pricingResolver';
import { enrollStudentInZenlerCourse } from '../services/zenlerEnrollment';

const router = Router();

function parsePaymentOptionId(value: unknown): number | null {
  const text = String(value ?? '').trim();
  const match = text.match(/^payopt_(\d+)$/);
  const id = Number(match ? match[1] : text);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parsePositiveInt(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Legacy payment-card checkout (course_payment_cards). */
router.post('/create-checkout-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // New geo-price checkout path
    const courseId = parsePositiveInt(req.body?.courseId);
    const coursePriceId = parsePositiveInt(req.body?.coursePriceId);
    if (courseId || coursePriceId) {
      return createGeoPriceCheckout(req, res);
    }

    const paymentOptionId = parsePaymentOptionId(req.body?.paymentOptionId);
    if (!paymentOptionId) return res.status(400).json({ ok: false, error: 'paymentOptionId is required' });

    const option = await getPaymentCard(paymentOptionId);
    if (!option || !option.isActive) {
      return res.status(404).json({ ok: false, error: 'Payment option not found or inactive' });
    }
    if (!option.zenlerCourseId) {
      return res.status(400).json({ ok: false, error: 'Payment option is not linked to a Zenler course' });
    }

    const amount = option.isDiscountActive && option.discountPrice != null
      ? option.discountPrice
      : option.normalPrice;
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Payment option price is invalid' });
    }

    const studentEmail = String(req.body?.studentEmail ?? '').trim() || null;
    const studentName = String(req.body?.studentName ?? '').trim() || null;
    const order = await createPaymentOrder({
      paymentOptionId: option.id,
      courseId: option.courseId,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      optionType: option.optionType,
      studentName,
      studentEmail,
      amount,
      currency: option.currency || 'GBP',
    });

    const session = await createStripeCheckoutSession({
      orderId: order.id,
      paymentOptionId: option.id,
      courseId: option.courseId,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      paymentCardTitle: option.title,
      amount,
      currency: option.currency || 'GBP',
      studentEmail,
    });
    await attachStripeCheckoutSession(order.id, session.id);

    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

async function createGeoPriceCheckout(req: Request, res: Response) {
  const courseId = parsePositiveInt(req.body?.courseId);
  if (!courseId) {
    return res.status(400).json({ ok: false, error: 'courseId is required' });
  }

  const course = await getCourseById(courseId);
  if (!course || !course.isActive) {
    return res.status(404).json({ ok: false, error: 'Course not found or inactive' });
  }

  const geo = detectCountryFromRequest(req, req.body?.countryCode);
  const currency = String(req.body?.currency ?? '').trim().toUpperCase() || null;
  const region = String(req.body?.region ?? '').trim() || null;
  const geoGroup = String(req.body?.geoGroup ?? '').trim() || null;
  const campaignCode = String(req.body?.campaignCode ?? '').trim() || null;
  const durationRaw = Number(req.body?.durationMonths);
  const durationMonths = Number.isInteger(durationRaw) && durationRaw >= 1 && durationRaw <= 6
    ? durationRaw
    : null;

  let resolved;
  try {
    const explicitPriceId = parsePositiveInt(req.body?.coursePriceId);
    if (explicitPriceId) {
      const price = await getGeoPriceById(explicitPriceId);
      if (!price || price.courseId !== courseId || !price.isActive) {
        return res.status(404).json({ ok: false, error: 'Course price not found or inactive' });
      }
      resolved = {
        price,
        matchReason: 'country' as const,
        detectedCountryCode: geo.countryCode,
        requestedCurrency: currency,
      };
    } else {
      resolved = await resolveCoursePrice({
        courseId,
        countryCode: geo.countryCode,
        currency,
        region,
        geoGroup,
        campaignCode,
        durationMonths,
      });
    }
  } catch (err) {
    if (err instanceof PricingResolutionError) {
      return res.status(404).json({ ok: false, error: err.message });
    }
    throw err;
  }

  const studentEmail = String(req.body?.studentEmail ?? '').trim() || null;
  const studentName = String(req.body?.studentName ?? '').trim() || null;

  const order = await createPaymentOrder({
    paymentOptionId: null,
    courseId: course.id,
    coursePriceId: resolved.price.id,
    zenlerCourseId: course.zenlerCourseId,
    courseTitle: course.name,
    optionType: resolved.price.name,
    studentName,
    studentEmail,
    countryCode: geo.countryCode,
    amount: resolved.price.amount,
    currency: resolved.price.currency,
  });

  const session = await createStripeCheckoutSession({
    orderId: order.id,
    courseId: course.id,
    coursePriceId: resolved.price.id,
    zenlerCourseId: course.zenlerCourseId,
    courseTitle: course.name,
    paymentCardTitle: `${course.name} — ${resolved.price.name}`,
    amount: resolved.price.amount,
    currency: resolved.price.currency,
    studentEmail,
    countryCode: geo.countryCode,
  });
  await attachStripeCheckoutSession(order.id, session.id);

  return res.json({
    checkoutUrl: session.url,
    orderId: order.id,
    coursePriceId: resolved.price.id,
    amount: resolved.price.amount,
    currency: resolved.price.currency,
    countryCode: geo.countryCode,
    matchReason: resolved.matchReason,
  });
}

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = String(req.query.session_id ?? '').trim();
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id is required' });

    const order = await getPaymentOrderByCheckoutSession(sessionId);
    if (!order) return res.status(404).json({ ok: false, error: 'Payment order not found' });

    return res.json({
      status: order.status,
      courseTitle: order.courseTitle,
      optionType: order.optionType,
      amount: order.amount,
      currency: order.currency,
      countryCode: order.countryCode,
      coursePriceId: order.coursePriceId,
      studentEmail: order.studentEmail ?? order.stripeCustomerEmail,
      zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
    });
  } catch (err) {
    next(err);
  }
});

export async function stripeWebhookHandler(req: Request, res: Response): Promise<void> {
  let event: any;
  try {
    event = verifyStripeWebhook(req.body as Buffer, req.get('stripe-signature'));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook';
    res.status(400).json({ ok: false, error: message });
    return;
  }

  if (event.type !== 'checkout.session.completed') {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const session = event.data?.object ?? {};
    const orderId = Number(session.client_reference_id ?? session.metadata?.orderId);
    if (!Number.isInteger(orderId)) {
      res.status(200).json({ ok: true });
      return;
    }

    const { order, wasAlreadyPaid } = await markPaymentOrderPaid({
      orderId,
      stripeCheckoutSessionId: session.id ?? null,
      stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      stripeCustomerEmail: session.customer_details?.email ?? session.customer_email ?? null,
      amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
      currency: typeof session.currency === 'string' ? session.currency : null,
    });

    if (!wasAlreadyPaid) {
      const email = order.studentEmail ?? order.stripeCustomerEmail;
      if (email && order.zenlerCourseId) {
        const enrollment = await enrollStudentInZenlerCourse({
          email,
          name: order.studentName,
          zenlerCourseId: order.zenlerCourseId,
        });
        await updateZenlerEnrollment(order.id, {
          zenlerUserId: enrollment.zenlerUserId,
          zenlerEnrollmentStatus: enrollment.status,
        });
      }

      const studentSent = await sendStudentPaymentConfirmation(order);
      const adminSent = await sendAdminPaymentNotification(order);
      await markOrderEmailsSent(order.id, { student: studentSent, admin: adminSent });
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[stripe-webhook]', err);
    res.status(500).json({ ok: false, error: 'Webhook handling failed' });
  }
}

export default router;
