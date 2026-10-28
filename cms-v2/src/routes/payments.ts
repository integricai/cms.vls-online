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
  saveOfferedPresentment,
  type PaymentOrder,
} from '../models/paymentOrder';
import {
  capturePendingProviderCheckout,
  closeAbandonedCheckout,
  fulfillPaidCheckout,
  fulfillRefund,
  isStudentConfirmationEmailError,
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
import { canPresentCheckoutCurrency, presentCheckoutAmount } from '../services/displayCurrency';
import { getUsdRates, rateForCurrency } from '../services/fxRates';
import { quoteMatchesCataloguePrice, verifyPriceQuote, type PriceQuotePayload } from '../services/priceQuote';
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
import { proxySecretMatches } from '../services/proxySecret';
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
import { ComboBundlePriceError, priceComboAccessSelection } from '../services/comboBundlePrice';
import {
  holdRetakeCodeForOrder,
  previewRetakeDiscount,
  releaseRetakeCodeForOrder,
  openDiscountPaymentLink,
  RetakeCodeError,
} from '../services/retakeDiscount';
import {
  checkoutSessionRateLimit,
  freeEnrolEmailRateLimit,
  freeEnrolIpRateLimit,
  rateLimit,
} from '../middleware/rateLimit';
import { findZenlerUserByEmail, zenlerCredentialsConfigured, type ZenlerApiUser } from '../services/zenlerApi';
import { resolveStripeStudentNameDefaults } from '../services/stripeCheckout';
import { retakeCodeForCheckout } from '../services/retakeDiscountMath';
import {
  lookupSchoolCourseAccess,
  resolveAccountStatusCourseIds,
} from '../services/schoolCourseAccessLookup';
import { zenlerStudentNames } from '../services/zenlerEnrollment';
import { schoolSsoUrl } from '../services/schoolSso';
import { resolveCheckoutSiteUrl } from '../services/checkoutSiteUrl';
import {
  normalizeStudentEmail,
  parseChosenPassword,
  saveStudentPassword,
} from '../services/studentPassword';
import { sendErrorAlert } from '../utils/errorAlert';

const router = Router();

const schoolAccountRateLimit = rateLimit({
  name: 'school-account',
  limit: 30,
  windowMs: 15 * 60 * 1000,
});

const schoolLoginRateLimit = rateLimit({
  name: 'school-login',
  limit: 10,
  windowMs: 15 * 60 * 1000,
});

const discountLinkRateLimit = rateLimit({
  name: 'discount-link',
  limit: 30,
  windowMs: 15 * 60 * 1000,
});

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

function parsePaperCoursePriceIds(body: Record<string, unknown>): Record<string, number> {
  const raw = body.paperPlans ?? body.coursePriceIds;
  if (!Array.isArray(raw)) return {};
  const ids: Record<string, number> = {};
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const zenlerCourseId = String(record.zenlerCourseId ?? record.zenler_course_id ?? '').trim();
    const coursePriceId = Number(record.coursePriceId ?? record.course_price_id);
    if (!/^\d+$/.test(zenlerCourseId) || !Number.isInteger(coursePriceId) || coursePriceId <= 0) continue;
    ids[zenlerCourseId] = coursePriceId;
  }
  return ids;
}

function parseExamSession(body: Record<string, unknown>): { month: number; year: number } | null {
  const month = Number(body.sessionMonth);
  const year = Number(body.sessionYear);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;
  return { month, year };
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

function checkoutEnvironmentForRequest(req: Request): ReturnType<typeof resolveCheckoutEnvironment> {
  const body = req.body && typeof req.body === 'object'
    ? req.body as Record<string, unknown>
    : {};
  const attribution = body.attribution && typeof body.attribution === 'object'
    ? body.attribution as Record<string, unknown>
    : {};
  return resolveCheckoutEnvironment({
    explicit: body.environment ?? attribution.environment,
    origin: parseCheckoutReturnOrigin(req),
    referer: req.get('referer'),
    trustedStagingHost: proxySecretMatches(req.get('x-vls-proxy-secret')),
  });
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
  const firstName = parseOptionalText(body.firstName) ?? splitStudentName(parseOptionalText(body.studentName)).firstName;
  const lastName = parseOptionalText(body.lastName) ?? splitStudentName(parseOptionalText(body.studentName)).lastName;
  const studentName = parseOptionalText(body.studentName) ?? ([firstName, lastName].filter(Boolean).join(' ') || null);
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

type PreparedSchoolAccount = {
  email: string | null;
  password: string | null;
  schoolUser: ZenlerApiUser | null;
  /** True when this request already searched the school account, including a failed search. */
  schoolLookupDone: boolean;
};

/**
 * The new checkout form asks for a password only when the email is new.
 * Older checkouts omit collectSchoolPassword and keep the temporary-password path.
 */
async function prepareSchoolPassword(
  body: Record<string, unknown>,
  fallbackEmail: string | null,
): Promise<PreparedSchoolAccount | { error: string }> {
  const collecting = body.collectSchoolPassword === true;
  const email = normalizeStudentEmail(body.studentEmail) ?? (collecting ? null : fallbackEmail);
  const parsed = parseChosenPassword(body.studentPassword);
  if (parsed.invalid) return { error: 'Password must be 8 to 72 characters.' };
  if (!collecting && !parsed.password) {
    return { email: fallbackEmail, password: null, schoolUser: null, schoolLookupDone: false };
  }
  if (!email) return { error: 'Enter the email address for your school account.' };

  let registered: boolean | null = null;
  let schoolUser: ZenlerApiUser | null = null;
  let schoolLookupDone = false;
  if (zenlerCredentialsConfigured()) {
    schoolLookupDone = true;
    try {
      schoolUser = await findZenlerUserByEmail(email);
      registered = Boolean(schoolUser);
    } catch (err) {
      console.error('[checkout] school account lookup failed', err instanceof Error ? err.message : err);
      registered = null;
    }
  }
  if (registered === true) return { email, password: null, schoolUser, schoolLookupDone };
  if (!parsed.password) return { error: 'Choose a password for your new school account.' };
  return { email, password: parsed.password, schoolUser, schoolLookupDone };
}

/**
 * Fills the Stripe name boxes when the form did not send both names.
 * Uses the school account already loaded for this checkout. A discount code
 * fills only a box that is still empty. A failed lookup does not stop checkout.
 */
async function stripeNameDefaults(input: {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  schoolUser: ZenlerApiUser | null;
  schoolLookupDone: boolean;
  codeFirstName?: string | null;
  codeLastName?: string | null;
}): Promise<{ studentFirstName?: string; studentLastName?: string }> {
  const formFirstName = String(input.firstName ?? '').trim();
  const formLastName = String(input.lastName ?? '').trim();
  if (formFirstName && formLastName) return {};

  let schoolUser = input.schoolUser;
  if (!input.schoolLookupDone && input.email && zenlerCredentialsConfigured()) {
    try {
      schoolUser = await findZenlerUserByEmail(input.email);
    } catch (err) {
      console.error('[checkout] could not prefill Stripe names from Zenler', err instanceof Error ? err.message : err);
      schoolUser = null;
    }
  }

  return resolveStripeStudentNameDefaults({
    formFirstName: input.firstName,
    formLastName: input.lastName,
    schoolFirstName: schoolUser?.first_name,
    schoolLastName: schoolUser?.last_name,
    codeFirstName: input.codeFirstName,
    codeLastName: input.codeLastName,
  });
}

function schoolLoginErrorUrl(req: Request): string {
  const referer = req.get('referer');
  if (referer) {
    try {
      const url = new URL(referer);
      const site = resolveCheckoutSiteUrl(url.origin);
      if (site === `${url.protocol}//${url.host}` && url.pathname.includes('payment-success')) {
        return url.toString();
      }
    } catch {
      // Fall through to the site home for payment success.
    }
  }
  return `${resolveCheckoutSiteUrl(req.get('origin'))}/payment-success`;
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

    if (event.type === 'checkout.closed') {
      await closeAbandonedCheckout(event);
      res.status(200).json({ ok: true });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`[${providerId}-webhook]`, err);
    await sendErrorAlert({
      area: `${providerId} webhook handling failed`,
      explanation: `A verified ${providerId} webhook was accepted but fulfillment failed. Stripe/PayPal will retry; check Settings > Logs for the payload details.`,
      error: err,
      req,
      extra: { provider: providerId },
    }).catch(alertErr => console.error('[alert] failed to send webhook alert', alertErr));
    res.status(500).json({ ok: false, error: 'Webhook handling failed' });
  }
}

router.post('/enrol-free', freeEnrolIpRateLimit, freeEnrolEmailRateLimit, freeEnrolHandler);

router.get('/providers', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    providers: listEnabledPaymentProviders(),
    defaultProvider: 'stripe',
  });
});

const ALREADY_ENROLLED_MESSAGE = 'This email already has this course. Sign in to the school to open My Courses.';

function grantCourseIds(primaryZenlerCourseId: string | null | undefined, accessIds: string[] | null): string[] {
  if (accessIds?.length) return accessIds;
  const primary = String(primaryZenlerCourseId ?? '').trim();
  return /^\d+$/.test(primary) ? [primary] : [];
}

/** True when the response has been sent and checkout must stop. */
async function rejectOwnedCheckout(
  res: Response,
  email: string | null,
  courseIds: string[],
): Promise<boolean> {
  if (!email || courseIds.length === 0) return false;
  try {
    const access = await lookupSchoolCourseAccess(email, courseIds);
    if (!access.ownsAll) return false;
  } catch (err) {
    console.error('[checkout] school course lookup failed', err instanceof Error ? err.message : err);
    return false;
  }
  res.status(409).json({ ok: false, error: ALREADY_ENROLLED_MESSAGE });
  return true;
}

router.post('/account-status', schoolAccountRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  const email = normalizeStudentEmail(req.body?.studentEmail);
  if (!email) return res.status(400).json({ ok: false, error: 'Enter a valid email address.' });
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const courseIds = await resolveAccountStatusCourseIds(body);
    const access = await lookupSchoolCourseAccess(email, courseIds);
    return res.json({ ok: true, ...access });
  } catch (err) {
    if (err instanceof MultiCourseAccessError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.post('/school-login', schoolLoginRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = checkoutSessionId(req.body?.session_id ?? req.body?.sessionId ?? req.body?.checkout_id);
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id is required' });
    const order = await getPaymentOrderByCheckoutId(sessionId);
    if (!order) return res.status(404).json({ ok: false, error: 'Payment order not found' });
    const enrolled = String(order.zenlerEnrollmentStatus ?? '').toLowerCase().startsWith('enrolled');
    if (order.status !== 'Paid' || !enrolled) {
      return res.status(409).json({ ok: false, error: 'Course access is still being set up.' });
    }
    const email = normalizeStudentEmail(order.studentEmail ?? order.providerCustomerEmail ?? order.stripeCustomerEmail);
    if (!email) return res.status(400).json({ ok: false, error: 'This payment has no school email.' });
    const names = zenlerStudentNames(order.studentName, email);
    const url = schoolSsoUrl({
      firstName: names.firstName,
      lastName: names.lastName,
      email,
      errorUrl: schoolLoginErrorUrl(req),
    });
    return res.json({ ok: true, url });
  } catch (err) {
    next(err);
  }
});

/** Legacy payment-card checkout (course_payment_cards). */
router.post('/checkout-quote', schoolAccountRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const priced = await priceCheckoutSelection(req);
    if (!priced.ok) return res.status(priced.status).json({ ok: false, error: priced.error });

    const email = normalizeStudentEmail(req.body?.studentEmail) ?? '';
    const retakeCode = retakeCodeForCheckout(checkoutEnvironmentForRequest(req), req.body?.retakeCode);
    let chargeAmount = priced.chargeAmount;
    let retakeApplied = false;
    if (retakeCode) {
      if (priced.accessZenlerCourseIds?.length || priced.comboStorySlug) {
        return res.status(400).json({ ok: false, error: 'A discount code can only be used for a single course.' });
      }
      const quote = await previewRetakeDiscount({
        code: retakeCode,
        email,
        courseId: priced.course.id,
        listAmount: priced.listAmount,
      });
      chargeAmount = quote.chargeAmount;
      retakeApplied = true;
    }

    return res.json({
      ok: true,
      courseTitle: priced.course.name,
      planName: priced.optionType,
      listAmount: priced.listAmount,
      chargeAmount,
      currency: priced.chargeCurrency,
      retakeApplied,
    });
  } catch (err) {
    if (err instanceof RetakeCodeError || err instanceof MultiCourseAccessError || err instanceof ComboBundlePriceError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.post('/create-checkout-session', checkoutSessionRateLimit, async (req: Request, res: Response, next: NextFunction) => {
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

    const cardAmount = option.isDiscountActive && option.discountPrice != null
      ? option.discountPrice
      : option.normalPrice;
    if (!Number.isFinite(cardAmount) || cardAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'Payment option price is invalid' });
    }
    const cardCurrency = (option.currency || 'GBP').toUpperCase();
    let amount = cardAmount;
    let localPresentment: { amount: number; currency: string } | null = null;
    if (cardCurrency !== 'USD') {
      const rate = rateForCurrency(await getUsdRates(), cardCurrency);
      if (rate == null) {
        return res.status(503).json({ ok: false, error: 'Pricing is unavailable' });
      }
      localPresentment = { amount: cardAmount, currency: cardCurrency };
      amount = Math.round((cardAmount / rate) * 100) / 100;
    }

    const providerId = parseRequestedProvider(req.body ?? {});
    if (rejectDisabledProvider(providerId, res)) return;
    const geo = detectCountryFromRequest(req);
    const clientIp = detectClientIpFromRequest(req);
    const environment = checkoutEnvironmentForRequest(req);
    const attribution = parseCheckoutAttribution(req.body ?? {}, {
      userAgent: req.get('user-agent'),
      clientIp,
      environment,
    });
    const customerInput = parseCheckoutCustomer(req.body ?? {}, geo.countryCode);
    const schoolPassword = await prepareSchoolPassword(req.body ?? {}, customerInput.studentEmail);
    if ('error' in schoolPassword) {
      return res.status(400).json({ ok: false, error: 'invalid_request', message: schoolPassword.error });
    }
    const customer = await upsertCheckoutCustomer({
      email: schoolPassword.email,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: geo.countryCode,
      provider: providerId,
    });

    if (await rejectOwnedCheckout(res, schoolPassword.email, grantCourseIds(option.zenlerCourseId, null))) return;

    const order = await createPaymentOrder({
      paymentOptionId: option.id,
      courseId: option.courseId,
      customerId: customer?.id ?? null,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      optionType: option.optionType,
      studentName: customerInput.studentName,
      studentEmail: schoolPassword.email,
      studentPhone: customerInput.phone,
      countryCode: geo.countryCode,
      amount,
      currency: 'USD',
      discountPercent: computeDiscountPercent(option.normalPrice, cardAmount),
      attribution,
      environment,
      provider: providerId,
    });
    if (schoolPassword.password) await saveStudentPassword(order.id, schoolPassword.password);
    if (localPresentment && providerId === 'stripe') {
      await saveOfferedPresentment(order.id, localPresentment.amount, localPresentment.currency);
    }

    const stripeNames = await stripeNameDefaults({
      email: schoolPassword.email,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      schoolUser: schoolPassword.schoolUser,
      schoolLookupDone: schoolPassword.schoolLookupDone,
    });
    const session = await startProviderCheckout(providerId, {
      orderId: order.id,
      paymentOptionId: option.id,
      courseId: option.courseId,
      zenlerCourseId: option.zenlerCourseId,
      courseTitle: option.courseName ?? option.title,
      paymentCardTitle: option.title,
      amount,
      currency: 'USD',
      studentEmail: schoolPassword.email,
      localPresentment: providerId === 'stripe' ? localPresentment : null,
      ...stripeNames,
      returnOrigin: parseCheckoutReturnOrigin(req),
      cancelPath: typeof req.body?.cancelPath === 'string' ? req.body.cancelPath : null,
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

type CheckoutPricing = {
  ok: true;
  course: NonNullable<Awaited<ReturnType<typeof getCmsCourseById>>>;
  resolved: {
    price: { id: number; amount: number; name: string; durationDays: number | null };
    matchReason: string;
    effectiveAmount: number;
    detectedCountryCode: string | null;
  };
  chargeAmount: number;
  listAmount: number;
  chargeCurrency: string;
  discountPercent: number | null;
  optionType: string;
  accessZenlerCourseIds: string[] | null;
  comboStorySlug: string | null;
  quotedCountryCode: string | null;
  clientIp: string | null;
  /** Local amount already shown on the course page. Null when checkout stays in one currency. */
  localPresentment: { amount: number; currency: string } | null;
};

const PRICING_UNAVAILABLE = 'Pricing is temporarily unavailable. Please refresh the page and try again.';

function presentmentFromQuote(
  quote: PriceQuotePayload,
): { amount: number; currency: string } | null {
  const currency = quote.displayCurrency.toUpperCase();
  if (currency === 'USD' || !canPresentCheckoutCurrency(currency)) return null;
  return { amount: quote.displayAmount, currency };
}

async function presentmentFromFx(
  amountUsd: number,
  countryCode: string | null,
): Promise<{ amount: number; currency: string } | null> {
  const presented = presentCheckoutAmount({
    amount: amountUsd,
    currency: 'USD',
    countryCode,
    rates: await getUsdRates(),
  });
  return presented.currency === 'USD' ? null : presented;
}

async function priceCheckoutSelection(
  req: Request,
): Promise<CheckoutPricing | { ok: false; status: number; error: string }> {
  const explicitPriceId = parsePositiveInt(req.body?.coursePriceId);
  let courseId = parsePositiveInt(req.body?.courseId);

  if (!courseId && explicitPriceId) {
    const priceRow = await getGeoPriceById(explicitPriceId);
    if (!priceRow || !priceRow.isActive) {
      return { ok: false, status: 404, error: 'Course price not found or inactive' };
    }
    courseId = priceRow.courseId;
  }
  if (!courseId) return { ok: false, status: 400, error: 'courseId or coursePriceId is required' };

  const course = await getCmsCourseById(courseId);
  if (!course || !course.isActive) return { ok: false, status: 404, error: 'Course not found or inactive' };

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
  let usedPageQuote = false;
  let localPresentment: { amount: number; currency: string } | null = null;
  try {
    if (explicitPriceId) {
      const price = await getGeoPriceById(explicitPriceId);
      if (!price || price.courseId !== courseId || !price.isActive) {
        return { ok: false, status: 404, error: 'Course price not found or inactive' };
      }
      const pageQuote = verifyPriceQuote(req.body?.priceQuote);
      if (pageQuote && quoteMatchesCataloguePrice(pageQuote, price.id, price.amount)) {
        usedPageQuote = true;
        localPresentment = presentmentFromQuote(pageQuote);
        resolved = {
          price,
          matchReason: 'explicit' as const,
          effectiveAmount: pageQuote.amountUsd,
          detectedCountryCode: geo.countryCode,
          geoPricingApplied: pageQuote.amountUsd < price.amount - 0.009,
          geoRegionCode: geo.countryCode,
          geoDiscountPercent: computeDiscountPercent(price.amount, pageQuote.amountUsd),
          lookupFailed: false,
        };
      } else {
        resolved = await applyParityDealsToResolved({
          price,
          matchReason: 'explicit' as const,
          effectiveAmount: price.amount,
          detectedCountryCode: geo.countryCode,
          geoPricingApplied: false,
          geoRegionCode: null,
          geoDiscountPercent: null,
        }, {
          ipAddress: clientIp,
          ignoreVpnBlock: parityTest,
        });
      }
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
    if (err instanceof PricingResolutionError) return { ok: false, status: 404, error: err.message };
    throw err;
  }

  if (!usedPageQuote && resolved.lookupFailed) {
    return { ok: false, status: 503, error: PRICING_UNAVAILABLE };
  }
  if (!usedPageQuote) {
    localPresentment = await presentmentFromFx(
      resolved.effectiveAmount,
      resolved.detectedCountryCode ?? geo.countryCode,
    );
  }

  if (!resolved.price.durationDays || resolved.price.durationDays <= 0) {
    return { ok: false, status: 400, error: 'Selected price plan has no duration_days configured' };
  }

  const quotedCountryCode = resolved.detectedCountryCode ?? geo.countryCode;
  let chargeAmount = resolved.effectiveAmount;
  let listAmount = resolved.price.amount;
  let chargeCurrency = 'USD';
  let discountPercent = computeDiscountPercent(listAmount, chargeAmount);
  let optionType = resolved.price.name;
  const requestedAccessIds = parseAccessZenlerCourseIds(req.body ?? {});
  const comboStorySlug = parseComboStorySlug(req.body ?? {});
  const configuredComboZenlerCourseIds = await resolveConfiguredComboZenlerCourseIds();
  let accessZenlerCourseIds: string[] | null = null;
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
    const comboQuote = await priceComboAccessSelection({
      zenlerCourseIds: accessZenlerCourseIds,
      session: parseExamSession(req.body ?? {}),
      coursePriceIds: parsePaperCoursePriceIds(req.body ?? {}),
      comboStorySlug,
      countryCode: quotedCountryCode,
      ipAddress: clientIp,
      ignoreVpnBlock: parityTest,
    });
    chargeAmount = comboQuote.chargeAmountUsd;
    listAmount = comboQuote.listAmountUsd;
    chargeCurrency = 'USD';
    discountPercent = comboQuote.discountPercent;
    if (comboQuote.sessionTitle) optionType = comboQuote.sessionTitle;
    localPresentment = comboQuote.presentmentAmount != null && comboQuote.presentmentCurrency
      ? { amount: comboQuote.presentmentAmount, currency: comboQuote.presentmentCurrency }
      : null;
  }

  return {
    ok: true,
    course,
    resolved,
    chargeAmount,
    listAmount,
    chargeCurrency,
    discountPercent,
    optionType,
    accessZenlerCourseIds,
    comboStorySlug,
    quotedCountryCode,
    clientIp,
    localPresentment,
  };
}

async function createGeoPriceCheckout(req: Request, res: Response, next: NextFunction) {
  try {
    const providerId = parseRequestedProvider(req.body ?? {});
    if (rejectDisabledProvider(providerId, res)) return;

    let priced;
    try {
      priced = await priceCheckoutSelection(req);
    } catch (err) {
      if (err instanceof MultiCourseAccessError || err instanceof ComboBundlePriceError) {
        return res.status(err.status).json({ ok: false, error: err.message });
      }
      throw err;
    }
    if (!priced.ok) return res.status(priced.status).json({ ok: false, error: priced.error });

    const course = priced.course;
    const resolved = priced.resolved;
    const quotedCountryCode = priced.quotedCountryCode;
    const clientIp = priced.clientIp;
    let chargeAmount = priced.chargeAmount;
    let listAmount = priced.listAmount;
    let chargeCurrency = priced.chargeCurrency;
    let discountPercent = priced.discountPercent;
    let optionType = priced.optionType;
    const accessZenlerCourseIds = priced.accessZenlerCourseIds;
    const comboStorySlug = priced.comboStorySlug;
    let localPresentment = priced.localPresentment;
    const environment = checkoutEnvironmentForRequest(req);
    const attribution = parseCheckoutAttribution(req.body ?? {}, {
      userAgent: req.get('user-agent'),
      clientIp,
      environment,
    });
    const customerInput = parseCheckoutCustomer(req.body ?? {}, quotedCountryCode);
    const schoolPassword = await prepareSchoolPassword(req.body ?? {}, customerInput.studentEmail);
    if ('error' in schoolPassword) {
      return res.status(400).json({ ok: false, error: 'invalid_request', message: schoolPassword.error });
    }
    const customer = await upsertCheckoutCustomer({
      email: schoolPassword.email,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      phone: customerInput.phone,
      countryCode: quotedCountryCode,
      provider: providerId,
    });

    if (await rejectOwnedCheckout(
      res,
      schoolPassword.email,
      grantCourseIds(course.zenlerCourseId, accessZenlerCourseIds),
    )) return;

    const retakeCode = retakeCodeForCheckout(environment, req.body?.retakeCode);
    let retakeQuote: Awaited<ReturnType<typeof previewRetakeDiscount>> | null = null;
    if (retakeCode) {
      if (accessZenlerCourseIds?.length || comboStorySlug) {
        return res.status(400).json({ ok: false, error: 'A discount code can only be used for a single course.' });
      }
      try {
        retakeQuote = await previewRetakeDiscount({
          code: retakeCode,
          email: schoolPassword.email ?? '',
          courseId: course.id,
          listAmount,
        });
      } catch (err) {
        if (err instanceof RetakeCodeError) {
          return res.status(err.status).json({ ok: false, error: err.message });
        }
        throw err;
      }
      chargeAmount = retakeQuote.chargeAmount;
      discountPercent = computeDiscountPercent(listAmount, chargeAmount);
      localPresentment = chargeCurrency === 'USD'
        ? await presentmentFromFx(chargeAmount, quotedCountryCode)
        : null;
    }

    const order = await createPaymentOrder({
      paymentOptionId: null,
      courseId: course.id,
      coursePriceId: resolved.price.id,
      customerId: customer?.id ?? null,
      zenlerCourseId: course.zenlerCourseId,
      accessZenlerCourseIds,
      courseTitle: course.name,
      optionType,
      studentName: customerInput.studentName,
      studentEmail: schoolPassword.email,
      studentPhone: customerInput.phone,
      countryCode: quotedCountryCode,
      amount: chargeAmount,
      currency: chargeCurrency,
      durationDays: resolved.price.durationDays,
      discountPercent,
      attribution,
      environment,
      provider: providerId,
    });
    if (localPresentment && providerId === 'stripe') {
      await saveOfferedPresentment(order.id, localPresentment.amount, localPresentment.currency);
    }
    if (schoolPassword.password) await saveStudentPassword(order.id, schoolPassword.password);
    if (retakeQuote) {
      try {
        await holdRetakeCodeForOrder(retakeQuote.codeId, order.id);
      } catch (err) {
        if (err instanceof RetakeCodeError) {
          return res.status(err.status).json({ ok: false, error: err.message });
        }
        throw err;
      }
    }

    const stripeNames = await stripeNameDefaults({
      email: schoolPassword.email,
      firstName: customerInput.firstName,
      lastName: customerInput.lastName,
      schoolUser: schoolPassword.schoolUser,
      schoolLookupDone: schoolPassword.schoolLookupDone,
      codeFirstName: retakeQuote?.firstName,
      codeLastName: retakeQuote?.lastName,
    });
    let session;
    try {
      session = await startProviderCheckout(providerId, {
        orderId: order.id,
        courseId: course.id,
        coursePriceId: resolved.price.id,
        zenlerCourseId: course.zenlerCourseId,
        courseTitle: course.name,
        paymentCardTitle: `${course.name} — ${optionType}`,
        amount: chargeAmount,
        currency: chargeCurrency,
        studentEmail: schoolPassword.email,
        skipStudentNameFields: Boolean(customerInput.firstName && customerInput.lastName),
        ...stripeNames,
        countryCode: quotedCountryCode,
        returnOrigin: parseCheckoutReturnOrigin(req),
        cancelPath: typeof req.body?.cancelPath === 'string' ? req.body.cancelPath : null,
        environment,
        localPresentment: providerId === 'stripe' ? localPresentment : null,
      });
    } catch (err) {
      if (retakeQuote) {
        await releaseRetakeCodeForOrder(order.id).catch((releaseErr: unknown) => {
          console.error('[checkout] could not release the retake code', order.id, releaseErr);
        });
      }
      throw err;
    }

    return res.json({
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      checkoutId: session.checkoutId,
      orderId: order.id,
      coursePriceId: resolved.price.id,
      amount: chargeAmount,
      listAmount,
      currency: chargeCurrency,
      countryCode: quotedCountryCode,
      matchReason: resolved.matchReason,
    });
  } catch (err) {
    if (err instanceof MultiCourseAccessError || err instanceof ComboBundlePriceError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
}

function checkoutSessionId(value: unknown): string {
  return String(value ?? '').trim();
}

/** Status the return page may show. The payer email stays in the order record and the logs. */
function publicPaymentStatus(order: PaymentOrder, confirmationEmailFailed = false) {
  const confirmationEmailSent = order.confirmationEmailSentAt != null;
  return {
    status: order.status,
    provider: order.provider,
    courseTitle: order.courseTitle,
    optionType: order.optionType,
    amount: order.amount,
    currency: order.currency,
    countryCode: order.countryCode,
    coursePriceId: order.coursePriceId,
    zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
    isNewZenlerUser: order.zenlerUserCreated,
    courseAccessUrl: courseAccessUrlForEnrollment({
      zenlerEnrollmentStatus: order.zenlerEnrollmentStatus,
      isNewZenlerUser: order.zenlerUserCreated,
    }),
    confirmationEmailSent,
    confirmationEmailFailed: !confirmationEmailSent && confirmationEmailFailed,
    refundedAt: order.refundedAt?.toISOString() ?? null,
  };
}

async function paymentStatusForSession(
  sessionId: string,
  confirm: boolean,
): Promise<{ order: PaymentOrder; confirmationEmailFailed: boolean } | null> {
  let order = await getPaymentOrderByCheckoutId(sessionId);
  if (!order) return null;

  if (!confirm) return { order, confirmationEmailFailed: false };

  if (order.status === 'Pending') {
    try {
      order = await capturePendingProviderCheckout(order);
    } catch (err) {
      console.error('[payments] capture on status failed', err);
    }
  }

  let confirmationEmailFailed = false;
  if (order.status === 'Paid') {
    try {
      order = await reconcilePaidOrder(order);
    } catch (err) {
      console.error('[payments] status reconcile failed', err);
      confirmationEmailFailed = isStudentConfirmationEmailError(err);
      order = (await getPaymentOrder(order.id)) ?? order;
    }
  }

  return { order, confirmationEmailFailed };
}

router.post('/discount-link/open', discountLinkRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await openDiscountPaymentLink({
      token: String((req.body as { token?: unknown } | undefined)?.token ?? ''),
      returnOrigin: parseCheckoutReturnOrigin(req),
      environment: checkoutEnvironmentForRequest(req),
    });
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof RetakeCodeError) {
      return res.status(err.status).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessionId = checkoutSessionId(req.query.session_id ?? req.query.token ?? req.query.checkout_id);
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id is required' });

    const result = await paymentStatusForSession(sessionId, false);
    if (!result) return res.status(404).json({ ok: false, error: 'Payment order not found' });
    return res.json(publicPaymentStatus(result.order, result.confirmationEmailFailed));
  } catch (err) {
    next(err);
  }
});

router.post('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    const sessionId = checkoutSessionId(body.session_id ?? body.sessionId ?? body.token ?? body.checkout_id);
    if (!sessionId) return res.status(400).json({ ok: false, error: 'session_id is required' });

    const result = await paymentStatusForSession(sessionId, true);
    if (!result) return res.status(404).json({ ok: false, error: 'Payment order not found' });
    return res.json(publicPaymentStatus(result.order, result.confirmationEmailFailed));
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
