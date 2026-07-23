import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentCard } from '../models/coursePaymentCard';
import { getCourseById, getGeoPriceById } from '../models/courseGeoPrice';
import { splitStudentName, upsertCustomer, updateCustomerZenlerUserId } from '../models/customer';
import {
  attachStripeCheckoutSession,
  createPaymentOrder,
  getPaymentOrderByCheckoutSession,
  markOrderEmailsSent,
  markPaymentOrderPaid,
  updateZenlerEnrollment,
} from '../models/paymentOrder';
import { createSale, getSaleByPaymentOrderId } from '../models/sale';
import {
  createStripeCheckoutSession,
  verifyStripeWebhook,
} from '../services/stripeCheckout';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
} from '../services/paymentEmails';
import { detectCountryFromRequest } from '../services/geoDetection';
import {
  resolveQuotedPricingRegion,
  shouldApplyRegionalPricingAtCheckout,
  verifyRegionalPaymentMethod,
} from '../services/paymentRegionalVerification';
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

function parseOptionalText(value: unknown): string | null {
  const text = String(value ?? '').trim();
  return text || null;
}

function computeDiscountPercent(listAmount: number, effectiveAmount: number): number | null {
  if (!Number.isFinite(listAmount) || listAmount <= 0) return null;
  if (!Number.isFinite(effectiveAmount) || effectiveAmount >= listAmount) return null;
  return Math.round((1 - effectiveAmount / listAmount) * 10000) / 100;
}

function parseCheckoutCustomer(body: Record<string, unknown>, countryCode: string | null) {
  const studentEmail = parseOptionalText(body.studentEmail);
  const studentName = parseOptionalText(body.studentName);
  const firstName = parseOptionalText(body.firstName) ?? splitStudentName(studentName).firstName;
  const lastName = parseOptionalText(body.lastName) ?? splitStudentName(studentName).lastName;
  const phone = parseOptionalText(body.phone);

  return {
    studentEmail,
    studentName,
    firstName,
    lastName,
    phone,
    countryCode,
  };
}

async function upsertCheckoutCustomer(input: {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  countryCode: string | null;
}) {
  if (!input.email) return null;
  return upsertCustomer({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    countryCode: input.countryCode,
  });
}

async function recordSaleForPaidOrder(order: Awaited<ReturnType<typeof markPaymentOrderPaid>>['order']) {
  if (
    !order.customerId
    || !order.courseId
    || !order.durationDays
    || !order.paidAt
  ) {
    return null;
  }

  const existing = await getSaleByPaymentOrderId(order.id);
  if (existing) return existing;

  return createSale({
    customerId: order.customerId,
    courseId: order.courseId,
    coursePriceId: order.coursePriceId,
    paymentOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    discountPercent: order.discountPercent,
    durationDays: order.durationDays,
    soldAt: order.paidAt,
  });
}

/** Legacy payment-card checkout (course_payment_cards). */
router.post('/create-checkout-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const courseId = parsePositiveInt(req.body?.courseId);
    const coursePriceId = parsePositiveInt(req.body?.coursePriceId);
    if (courseId || coursePriceId) {
      await createGeoPriceCheckout(req, res, next);
      return;
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

    const geo = detectCountryFromRequest(req, req.body?.countryCode);
    const customerInput = parseCheckoutCustomer(req.body ?? {}, geo.countryCode);
    const customer = await upsertCheckoutCustomer({
      email: customerInput.studentEmail,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: geo.countryCode,
    });

    const order = await createPaymentOrder({
      paymentOptionId: option.id,
      courseId: option.courseId,
      customerId: customer?.id ?? null,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      optionType: option.optionType,
      studentName: customerInput.studentName,
      studentEmail: customerInput.studentEmail,
      countryCode: geo.countryCode,
      amount,
      currency: option.currency || 'GBP',
      discountPercent: computeDiscountPercent(option.normalPrice, amount),
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
      studentEmail: customerInput.studentEmail,
    });
    await attachStripeCheckoutSession(order.id, session.id);

    return res.json({ checkoutUrl: session.url });
  } catch (err) {
    next(err);
  }
});

async function createGeoPriceCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const explicitPriceId = parsePositiveInt(req.body?.coursePriceId);
    let courseId = parsePositiveInt(req.body?.courseId);

    if (!courseId && explicitPriceId) {
      const priceRow = await getGeoPriceById(explicitPriceId);
      if (!priceRow || !priceRow.isActive) {
        return res.status(404).json({ ok: false, error: 'Course price not found or inactive' });
      }
      courseId = priceRow.courseId;
    }

    if (!courseId) {
      return res.status(400).json({ ok: false, error: 'courseId or coursePriceId is required' });
    }

    const course = await getCourseById(courseId);
    if (!course || !course.isActive) {
      return res.status(404).json({ ok: false, error: 'Course not found or inactive' });
    }

    const geo = detectCountryFromRequest(req, req.body?.countryCode);
    const campaignCode = String(req.body?.campaignCode ?? '').trim() || null;
    const durationRaw = Number(req.body?.durationMonths);
    const durationMonths = Number.isInteger(durationRaw) && durationRaw >= 1 && durationRaw <= 6
      ? durationRaw
      : null;

    let resolved;
    try {
      if (explicitPriceId) {
        const price = await getGeoPriceById(explicitPriceId);
        if (!price || price.courseId !== courseId || !price.isActive) {
          return res.status(404).json({ ok: false, error: 'Course price not found or inactive' });
        }
        resolved = {
          price,
          matchReason: 'explicit' as const,
          effectiveAmount: price.effectiveAmount,
          detectedCountryCode: geo.countryCode,
        };
      } else {
        resolved = await resolveCoursePrice({
          courseId,
          durationMonths,
          campaignCode,
          detectedCountryCode: geo.countryCode,
        });
      }
    } catch (err) {
      if (err instanceof PricingResolutionError) {
        return res.status(404).json({ ok: false, error: err.message });
      }
      throw err;
    }

    if (!resolved.price.durationDays || resolved.price.durationDays <= 0) {
      return res.status(400).json({ ok: false, error: 'Selected price plan has no duration_days configured' });
    }

    const customerInput = parseCheckoutCustomer(req.body ?? {}, geo.countryCode);
    const customer = await upsertCheckoutCustomer({
      email: customerInput.studentEmail,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: geo.countryCode,
    });

    const discountPercent = computeDiscountPercent(resolved.price.amount, resolved.effectiveAmount)
      ?? resolved.price.discountPercent;

    const regionalPricingApplied = shouldApplyRegionalPricingAtCheckout({
      countryCode: geo.countryCode,
      regionalPricingApplied: req.body?.regionalPricingApplied === true,
      listAmount: resolved.price.amount,
      effectiveAmount: resolved.effectiveAmount,
    });

    const order = await createPaymentOrder({
      paymentOptionId: null,
      courseId: course.id,
      coursePriceId: resolved.price.id,
      customerId: customer?.id ?? null,
      zenlerCourseId: course.zenlerCourseId,
      courseTitle: course.name,
      optionType: resolved.price.name,
      studentName: customerInput.studentName,
      studentEmail: customerInput.studentEmail,
      countryCode: geo.countryCode,
      quotedPricingRegion: resolveQuotedPricingRegion(geo.countryCode),
      regionalPricingApplied,
      amount: resolved.effectiveAmount,
      currency: 'USD',
      durationDays: resolved.price.durationDays,
      discountPercent,
    });

    const session = await createStripeCheckoutSession({
      orderId: order.id,
      courseId: course.id,
      coursePriceId: resolved.price.id,
      zenlerCourseId: course.zenlerCourseId,
      courseTitle: course.name,
      paymentCardTitle: `${course.name} — ${resolved.price.name}`,
      amount: resolved.effectiveAmount,
      currency: 'USD',
      studentEmail: customerInput.studentEmail,
      countryCode: geo.countryCode,
    });
    await attachStripeCheckoutSession(order.id, session.id);

    if (!session.url) {
      return res.status(502).json({ ok: false, error: 'Stripe did not return a checkout URL' });
    }

    return res.json({
      checkoutUrl: session.url,
      orderId: order.id,
      coursePriceId: resolved.price.id,
      amount: resolved.effectiveAmount,
      listAmount: resolved.price.amount,
      currency: 'USD',
      countryCode: geo.countryCode,
      matchReason: resolved.matchReason,
    });
  } catch (err) {
    next(err);
  }
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
      paymentMethodCountry: order.paymentMethodCountry,
      refundedAt: order.refundedAt?.toISOString() ?? null,
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
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : order.stripePaymentIntentId;

      const regionalCheck = await verifyRegionalPaymentMethod(order, paymentIntentId);
      if (!regionalCheck.allowed) {
        res.status(200).json({ ok: true, regionalMismatchRefunded: true });
        return;
      }

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
        if (order.customerId && enrollment.zenlerUserId) {
          await updateCustomerZenlerUserId(order.customerId, enrollment.zenlerUserId);
        }
      }

      await recordSaleForPaidOrder(order);

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
