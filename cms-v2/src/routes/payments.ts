import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentCard } from '../models/coursePaymentCard';
import { getGeoPriceById } from '../models/courseGeoPrice';
import { getCourseById as getCmsCourseById } from '../models/course';
import { splitStudentName, upsertCustomer } from '../models/customer';
import {
  attachCheckoutSession,
  createPaymentOrder,
  getPaymentOrder,
  getPaymentOrderByCheckoutId,
  paymentOrderPayerEmail,
} from '../models/paymentOrder';
import {
  capturePendingProviderCheckout,
  fulfillPaidCheckout,
  fulfillRefund,
  reconcilePaidOrder,
} from '../services/payments/fulfillment';
import { getPaymentProvider, isPaymentProviderEnabled, listEnabledPaymentProviders } from '../services/payments/registry';
import {
  customerSourceForProvider,
  parsePaymentProviderId,
  type CreateCheckoutInput,
  type PaymentProviderId,
} from '../services/payments/types';
import { parseCheckoutAttribution, resolveCheckoutEnvironment } from '../services/attribution';
import {
  detectClientIpFromRequest,
  detectCountryFromRequest,
} from '../services/geoDetection';
import {
  applyParityDealsToResolved,
  PricingResolutionError,
  resolveCoursePrice,
} from '../services/pricingResolver';
import { isParityDealsTestAllowed, isParityDealsTestRequest } from '../services/parityDealsTest';
import { courseAccessUrlForEnrollment } from '../services/schoolAccess';
import { freeEnrolHandler } from './freeEnrol';
import {
  MultiCourseAccessError,
  assertBundleCheckoutHasSelection,
  parseAccessZenlerCourseIds,
  parseComboStorySlug,
  validateMultiCourseAccessSelection,
} from '../services/multiCourseAccess';
import { resolveConfiguredComboZenlerCourseIds } from '../services/multiCourseStoryblokAllowlist';

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

function parseRequestedProvider(body: Record<string, unknown>): PaymentProviderId {
  return parsePaymentProviderId(body.provider ?? body.paymentProvider);
}

function rejectDisabledProvider(providerId: PaymentProviderId, res: Response): boolean {
  if (isPaymentProviderEnabled(providerId)) return false;
  res.status(400).json({ ok: false, error: 'Direct PayPal checkout is disabled' });
  return true;
}

function parseCheckoutReturnOrigin(req: Request): string | undefined {
  const body = req.body && typeof req.body === 'object'
    ? req.body as Record<string, unknown>
    : {};
  const candidate = body.returnOrigin ?? body.origin ?? req.get('origin');
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
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
  provider: PaymentProviderId;
}) {
  if (!input.email) return null;
  return upsertCustomer({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
    countryCode: input.countryCode,
    source: customerSourceForProvider(input.provider),
  });
}

async function startProviderCheckout(
  providerId: PaymentProviderId,
  input: CreateCheckoutInput,
): Promise<{ checkoutUrl: string; checkoutId: string; provider: PaymentProviderId }> {
  const provider = getPaymentProvider(providerId);
  const session = await provider.createCheckout(input);
  await attachCheckoutSession(input.orderId, {
    provider: session.provider,
    checkoutId: session.checkoutId,
  });
  return session;
}

function webhookHeaders(req: Request): Record<string, string | undefined> {
  return {
    'stripe-signature': req.get('stripe-signature') ?? undefined,
    'paypal-auth-algo': req.get('paypal-auth-algo') ?? undefined,
    'paypal-cert-url': req.get('paypal-cert-url') ?? undefined,
    'paypal-transmission-id': req.get('paypal-transmission-id') ?? undefined,
    'paypal-transmission-sig': req.get('paypal-transmission-sig') ?? undefined,
    'paypal-transmission-time': req.get('paypal-transmission-time') ?? undefined,
  };
}

async function handleProviderWebhook(providerId: PaymentProviderId, req: Request, res: Response): Promise<void> {
  let event;
  try {
    event = await getPaymentProvider(providerId).parseWebhook(req.body as Buffer, webhookHeaders(req));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid webhook';
    res.status(400).json({ ok: false, error: message });
    return;
  }

  try {
    if (event.type === 'checkout.completed') {
      // PayPal enrolment follows PAYMENT.CAPTURE.COMPLETED only. An approved order
      // has no capture id yet, and a failed capture must not enrol the student.
      if (event.provider === 'paypal' && !event.paymentId) {
        res.status(200).json({ ok: true });
        return;
      }
      await fulfillPaidCheckout(event);
      res.status(200).json({ ok: true });
      return;
    }

    if (event.type === 'refund.completed') {
      await fulfillRefund(event);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[${providerId}-webhook]`, err);
    res.status(500).json({ ok: false, error: 'Webhook handling failed' });
  }
}

router.post('/enrol-free', freeEnrolHandler);

router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    providers: listEnabledPaymentProviders(),
    defaultProvider: 'stripe',
  });
});

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

    const providerId = parseRequestedProvider(req.body ?? {});
    if (rejectDisabledProvider(providerId, res)) return;
    const geo = detectCountryFromRequest(req);
    const clientIp = detectClientIpFromRequest(req);
    const environment = resolveCheckoutEnvironment({
      explicit: req.body?.environment ?? req.body?.attribution?.environment,
      origin: req.get('origin'),
      referer: req.get('referer'),
    });
    const attribution = parseCheckoutAttribution(req.body ?? {}, {
      userAgent: req.get('user-agent'),
      clientIp,
      environment,
    });
    const customerInput = parseCheckoutCustomer(req.body ?? {}, geo.countryCode);
    const customer = await upsertCheckoutCustomer({
      email: customerInput.studentEmail,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: geo.countryCode,
      provider: providerId,
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
      studentPhone: customerInput.phone,
      countryCode: geo.countryCode,
      amount,
      currency: option.currency || 'GBP',
      discountPercent: computeDiscountPercent(option.normalPrice, amount),
      attribution,
      environment,
      provider: providerId,
    });

    const session = await startProviderCheckout(providerId, {
      orderId: order.id,
      paymentOptionId: option.id,
      courseId: option.courseId,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      paymentCardTitle: option.title,
      amount,
      currency: option.currency || 'GBP',
      studentEmail: customerInput.studentEmail,
      returnOrigin: parseCheckoutReturnOrigin(req),
      environment,
    });

    return res.json({
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      checkoutId: session.checkoutId,
    });
  } catch (err) {
    next(err);
  }
});

async function createGeoPriceCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const explicitPriceId = parsePositiveInt(req.body?.coursePriceId);
    let courseId = parsePositiveInt(req.body?.courseId);
    const providerId = parseRequestedProvider(req.body ?? {});
    if (rejectDisabledProvider(providerId, res)) return;

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

    const course = await getCmsCourseById(courseId);
    if (!course || !course.isActive) {
      return res.status(404).json({ ok: false, error: 'Course not found or inactive' });
    }

    const geo = detectCountryFromRequest(req);
    const clientIp = detectClientIpFromRequest(req);
    const parityTest = isParityDealsTestAllowed() && (
      isParityDealsTestRequest(req)
      || req.body?.parityDealsTest === true
      || String(req.body?.test ?? '').toLowerCase() === 'true'
    );
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
    const environment = resolveCheckoutEnvironment({
      explicit: req.body?.environment ?? req.body?.attribution?.environment,
      origin: req.get('origin'),
      referer: req.get('referer'),
    });
    const attribution = parseCheckoutAttribution(req.body ?? {}, {
      userAgent: req.get('user-agent'),
      clientIp,
      environment,
    });
    const customerInput = parseCheckoutCustomer(req.body ?? {}, quotedCountryCode);
    const customer = await upsertCheckoutCustomer({
      email: customerInput.studentEmail,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: quotedCountryCode,
      provider: providerId,
    });

    const discountPercent = computeDiscountPercent(resolved.price.amount, resolved.effectiveAmount);

    const requestedAccessIds = parseAccessZenlerCourseIds(req.body ?? {});
    const comboStorySlug = parseComboStorySlug(req.body ?? {});
    const configuredComboZenlerCourseIds = await resolveConfiguredComboZenlerCourseIds();
    let accessZenlerCourseIds: string[] | null = null;
    try {
      assertBundleCheckoutHasSelection({
        comboStorySlug,
        accessZenlerCourseIds: requestedAccessIds,
        zenlerCourseId: course.zenlerCourseId,
        configuredComboZenlerCourseIds,
      });
      if (requestedAccessIds.length > 0) {
        accessZenlerCourseIds = await validateMultiCourseAccessSelection({
          bundleCourseId: course.id,
          accessZenlerCourseIds: requestedAccessIds,
          comboStorySlug,
        });
      }
    } catch (err) {
      if (err instanceof MultiCourseAccessError) {
        return res.status(err.status).json({ ok: false, error: err.message });
      }
      throw err;
    }

    const order = await createPaymentOrder({
      paymentOptionId: null,
      courseId: course.id,
      coursePriceId: resolved.price.id,
      customerId: customer?.id ?? null,
      zenlerCourseId: course.zenlerCourseId,
      accessZenlerCourseIds,
      courseTitle: course.name,
      optionType: resolved.price.name,
      studentName: customerInput.studentName,
      studentEmail: customerInput.studentEmail,
      studentPhone: customerInput.phone,
      countryCode: quotedCountryCode,
      amount: resolved.effectiveAmount,
      currency: 'USD',
      durationDays: resolved.price.durationDays,
      discountPercent,
      attribution,
      environment,
      provider: providerId,
    });

    const session = await startProviderCheckout(providerId, {
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
      returnOrigin: parseCheckoutReturnOrigin(req),
      environment,
    });

    return res.json({
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      checkoutId: session.checkoutId,
      orderId: order.id,
      coursePriceId: resolved.price.id,
      amount: resolved.effectiveAmount,
      listAmount: resolved.price.amount,
      currency: 'USD',
      countryCode: quotedCountryCode,
      matchReason: resolved.matchReason,
    });
  } catch (err) {
    if (err instanceof MultiCourseAccessError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
}

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = String(req.query.session_id ?? req.query.token ?? req.query.checkout_id ?? '').trim();
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id is required' });

    let order = await getPaymentOrderByCheckoutId(sessionId);
    if (!order) return res.status(404).json({ ok: false, error: 'Payment order not found' });

    if (order.status === 'Pending') {
      try {
        order = await capturePendingProviderCheckout(order);
      } catch (err) {
        console.error('[payments] capture on status failed', err);
      }
    }

    if (order.status === 'Paid') {
      try {
        order = await reconcilePaidOrder(order);
      } catch (err) {
        console.error('[payments] status reconcile failed', err);
        order = (await getPaymentOrder(order.id)) ?? order;
      }
    }

    return res.json({
      status: order.status,
      provider: order.provider,
      courseTitle: order.courseTitle,
      optionType: order.optionType,
      amount: order.amount,
      currency: order.currency,
      countryCode: order.countryCode,
      coursePriceId: order.coursePriceId,
      studentEmail: paymentOrderPayerEmail(order),
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
  await handleProviderWebhook('stripe', req, res);
}

export async function paypalWebhookHandler(_req: Request, res: Response): Promise<void> {
  // Direct checkout disabled. This endpoint does not enrol or refund; legacy refunds go through sales.
  res.status(200).json({ ok: true });
}

export default router;
