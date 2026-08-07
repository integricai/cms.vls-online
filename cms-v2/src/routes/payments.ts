import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentCard } from '../models/coursePaymentCard';
import { getCourseById, getGeoPriceById } from '../models/courseGeoPrice';
import { splitStudentName, upsertCustomer } from '../models/customer';
import {
  attachStripeCheckoutSession,
  createPaymentOrder,
  getPaymentOrder,
  getPaymentOrderByCheckoutSession,
  getPaymentOrderByPaymentIntent,
  markOrderEmailsSent,
  markPaymentOrderPaid,
  markPaymentOrderRefunded,
} from '../models/paymentOrder';
import {
  createStripeCheckoutSession,
  verifyStripeWebhook,
} from '../services/stripeCheckout';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
  sendStudentRefundConfirmation,
} from '../services/paymentEmails';
import { ensureSaleRecordedForPaidOrder } from '../services/saleRecording';
import {
  detectClientIpFromRequest,
  detectCountryFromRequest,
} from '../services/geoDetection';
import {
  applyParityDealsToResolved,
  PricingResolutionError,
  resolveCoursePrice,
} from '../services/pricingResolver';
import { isParityDealsTestRequest } from '../services/parityDealsTest';
import {
  ensureZenlerEnrollmentForPaidOrder,
  revokeZenlerAccessForRefundedOrder,
  runZenlerEnrollmentForPaidOrder,
} from '../services/zenlerEnrollmentEnsure';
import { courseAccessUrlForEnrollment } from '../services/schoolAccess';

function extractStripeId(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === 'string' && id.trim()) return id.trim();
  }
  return null;
}

async function handleCheckoutSessionCompleted(session: Record<string, any>): Promise<void> {
  const orderId = Number(session.client_reference_id ?? session.metadata?.orderId);
  if (!Number.isInteger(orderId)) return;

  const existing = await getPaymentOrder(orderId);
  if (!existing) return;
  if (existing.status === 'Paid') {
    await ensureSaleRecordedForPaidOrder(existing);
    return;
  }
  if (existing.status === 'Cancelled' || existing.status === 'Refunded') return;

  const paymentIntentId = extractStripeId(session.payment_intent) ?? existing.stripePaymentIntentId;

  let { order, wasAlreadyPaid } = await markPaymentOrderPaid({
    orderId,
    stripeCheckoutSessionId: typeof session.id === 'string' ? session.id : null,
    stripePaymentIntentId: paymentIntentId,
    stripeCustomerEmail: session.customer_details?.email ?? session.customer_email ?? null,
    amountTotal: typeof session.amount_total === 'number' ? session.amount_total : null,
    currency: typeof session.currency === 'string' ? session.currency : null,
  });

  // Keep customers current on every paid enrollment (post go-live path).
  const payerEmail = (
    order.studentEmail
    ?? order.stripeCustomerEmail
    ?? session.customer_details?.email
    ?? session.customer_email
    ?? null
  );
  if (payerEmail) {
    const stripeName = typeof session.customer_details?.name === 'string'
      ? session.customer_details.name
      : order.studentName;
    const { firstName, lastName } = splitStudentName(stripeName);
    await upsertCustomer({
      email: String(payerEmail).trim().toLowerCase(),
      firstName,
      lastName,
      countryCode: order.countryCode,
      source: 'stripe',
    });
  }

  if (!wasAlreadyPaid) {
    const email = order.studentEmail ?? order.stripeCustomerEmail;
    let enrollmentEmailContext = null;
    if (email && order.zenlerCourseId) {
      const enrollmentResult = await runZenlerEnrollmentForPaidOrder(order);
      order = enrollmentResult.order;
      enrollmentEmailContext = enrollmentResult.emailContext;
    }

    const studentSent = await sendStudentPaymentConfirmation(order, enrollmentEmailContext);
    const adminSent = await sendAdminPaymentNotification(order);
    await markOrderEmailsSent(order.id, { student: studentSent, admin: adminSent });
  }

  await ensureSaleRecordedForPaidOrder(order);
}

async function handleStripeRefundEvent(payload: {
  paymentIntentId: string | null;
  refundId: string | null;
}): Promise<void> {
  if (!payload.paymentIntentId) return;

  const order = await getPaymentOrderByPaymentIntent(payload.paymentIntentId);
  if (!order) return;

  if (order.status === 'Refunded') {
    // Admin refund may have marked the order first — still ensure Zenler access is revoked.
    await revokeZenlerAccessForRefundedOrder(order);
    return;
  }
  if (order.status !== 'Paid') return;

  const { order: refunded, wasAlreadyRefunded } = await markPaymentOrderRefunded({
    orderId: order.id,
    stripeRefundId: payload.refundId,
    stripePaymentIntentId: payload.paymentIntentId,
  });

  await revokeZenlerAccessForRefundedOrder(refunded);

  // Dashboard / external refunds only — Sales admin path emails when it marks Refunded first.
  if (!wasAlreadyRefunded) {
    try {
      await sendStudentRefundConfirmation(refunded);
    } catch (emailErr) {
      console.error('[payments] refund confirmation email failed', emailErr);
    }
  }
}

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
    source: 'stripe',
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
    const clientIp = detectClientIpFromRequest(req);
    const parityTest = isParityDealsTestRequest(req)
      || req.body?.parityDealsTest === true
      || String(req.body?.test ?? '').toLowerCase() === 'true';
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
        // List amount only — CMS campaign % ignored; Evendeals applied below.
        const base = {
          price,
          matchReason: 'explicit' as const,
          effectiveAmount: price.amount,
          detectedCountryCode: geo.countryCode,
          geoPricingApplied: false,
          geoRegionCode: null,
          geoDiscountPercent: null,
        };
        resolved = await applyParityDealsToResolved(base, {
          ipAddress: clientIp,
          ignoreVpnBlock: parityTest,
        });
      } else {
        resolved = await resolveCoursePrice({
          courseId,
          durationMonths,
          campaignCode,
          detectedCountryCode: geo.countryCode,
          ipAddress: clientIp,
          ignoreVpnBlock: parityTest,
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

    const quotedCountryCode = resolved.detectedCountryCode ?? geo.countryCode;
    const customerInput = parseCheckoutCustomer(req.body ?? {}, quotedCountryCode);
    const customer = await upsertCheckoutCustomer({
      email: customerInput.studentEmail,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: quotedCountryCode,
    });

    // Record only the Evendeals (or other applied) cut vs list — ignore CMS campaign %.
    const discountPercent = computeDiscountPercent(resolved.price.amount, resolved.effectiveAmount);

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
      countryCode: quotedCountryCode,
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
      countryCode: quotedCountryCode,
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
      countryCode: quotedCountryCode,
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

    let order = await getPaymentOrderByCheckoutSession(sessionId);
    if (!order) return res.status(404).json({ ok: false, error: 'Payment order not found' });

    if (order.status === 'Paid') {
      await ensureSaleRecordedForPaidOrder(order);
      order = await ensureZenlerEnrollmentForPaidOrder(order);
    }

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
      isNewZenlerUser: order.zenlerUserCreated,
      courseAccessUrl: courseAccessUrlForEnrollment({
        zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
        isNewZenlerUser: order.zenlerUserCreated,
      }),
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

  try {
    const object = event.data?.object ?? {};

    if (event.type === 'checkout.session.completed') {
      await handleCheckoutSessionCompleted(object);
      res.status(200).json({ ok: true });
      return;
    }

    if (event.type === 'charge.refunded') {
      const refunds = Array.isArray(object.refunds?.data) ? object.refunds.data : [];
      const latestRefund = refunds[0] ?? null;
      await handleStripeRefundEvent({
        paymentIntentId: extractStripeId(object.payment_intent),
        refundId: extractStripeId(latestRefund?.id ?? latestRefund),
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (event.type === 'refund.created' || event.type === 'refund.updated') {
      const status = typeof object.status === 'string' ? object.status : '';
      if (status === 'succeeded') {
        await handleStripeRefundEvent({
          paymentIntentId: extractStripeId(object.payment_intent),
          refundId: extractStripeId(object.id ?? object),
        });
      }
      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[stripe-webhook]', err);
    res.status(500).json({ ok: false, error: 'Webhook handling failed' });
  }
}

export default router;
