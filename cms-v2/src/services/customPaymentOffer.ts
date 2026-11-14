import { getCourseById } from '../models/courseGeoPrice';
import {
  attachCustomPaymentCheckout,
  getCustomPaymentOfferById,
  getCustomPaymentOfferByTokenHash,
  markCustomPaymentOfferEmailSent,
  replaceCustomPaymentPayLink,
  type CustomPaymentOffer,
} from '../models/customPaymentOffer';
import {
  attachCheckoutSession,
  closePendingPaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  paymentOrderCheckoutId,
  type PaymentOrder,
} from '../models/paymentOrder';
import { discountPayUrl, generateDiscountToken, hashDiscountToken } from './discountPayLink';
import { sendCustomPaymentOfferEmail } from './paymentEmails';
import { getPaymentProvider } from './payments/registry';
import { expireOpenStripeCheckoutSession, readStripeCheckoutSession } from './stripeCheckout';

const CUSTOM_PAYMENT_SITE_ORIGIN = 'https://vls-online.com';

export class CustomPaymentOfferError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = 'CustomPaymentOfferError';
    this.status = status;
  }
}

export type ResentCustomPaymentOffer = CustomPaymentOffer & {
  emailSent: boolean;
  emailError: string | null;
};

export type OpenCustomPaymentLinkResult = {
  status: 'invalid' | 'used' | 'valid' | 'error';
  message: string;
  checkoutUrl: string | null;
};

const ALREADY_PAID = 'This payment has already been received.';
const REFUNDED = 'This payment has been refunded.';
const INVALID = "This link isn't valid.";
const TRY_AGAIN = 'Please try this link again.';

function closedLink(status: 'invalid' | 'used', message: string): OpenCustomPaymentLinkResult {
  return { status, message, checkoutUrl: null };
}

async function abandonUnpaidCheckout(
  orderId: number,
  sessionId: string,
  environment: 'production' | 'staging' | null,
): Promise<void> {
  try {
    await expireOpenStripeCheckoutSession(sessionId, environment);
  } catch (err) {
    console.error('[custom-payment-offer] could not expire the unused checkout', orderId, err);
  }
  await closePendingPaymentOrder({ orderId, status: 'Cancelled' });
}

async function courseForOffer(offer: CustomPaymentOffer) {
  const course = offer.courseId ? await getCourseById(offer.courseId) : null;
  if (offer.courseId && !course) {
    throw new CustomPaymentOfferError('The course on this offer is no longer available.');
  }
  if (course && !course.zenlerCourseId) {
    throw new CustomPaymentOfferError('The course on this offer is missing a Zenler course id.');
  }
  const accessDays = course ? offer.durationDays : null;
  if (course && !accessDays) {
    throw new CustomPaymentOfferError('This course offer is missing an access duration.');
  }
  return { course, accessDays };
}

/** Close an unpaid Stripe page. A completed payment is reported and left in place. */
async function retireUnpaidCheckout(order: PaymentOrder): Promise<'open' | 'paid'> {
  if (order.status !== 'Pending') return 'open';
  const sessionId = paymentOrderCheckoutId(order);
  if (sessionId && order.provider === 'stripe') {
    const outcome = await expireOpenStripeCheckoutSession(sessionId, order.checkoutEnvironment);
    if (outcome === 'complete') return 'paid';
  }
  await closePendingPaymentOrder({ orderId: order.id, status: 'Cancelled' });
  return 'open';
}

async function openStripeSession(input: {
  previous: PaymentOrder;
  offer: CustomPaymentOffer;
}): Promise<{ orderId: number; checkoutId: string; checkoutUrl: string }> {
  const { course, accessDays } = await courseForOffer(input.offer);
  const paymentTitle = course ? course.name : input.previous.courseTitle;
  const studentName = `${input.offer.studentFirstName} ${input.offer.studentLastName}`.trim();
  const environment = input.previous.checkoutEnvironment === 'production' ? 'production' : 'staging';
  const order = await createPaymentOrder({
    paymentOptionId: null,
    courseId: course?.id ?? null,
    coursePriceId: null,
    customerId: input.previous.customerId,
    zenlerCourseId: course?.zenlerCourseId ?? '',
    courseTitle: paymentTitle,
    optionType: course ? 'Custom / Resit offer' : 'Custom payment',
    studentName,
    studentEmail: input.offer.studentEmail,
    countryCode: input.previous.countryCode,
    amount: input.offer.amount,
    currency: input.offer.currency || 'USD',
    durationDays: accessDays,
    discountPercent: null,
    environment,
  });

  let session: { checkoutId: string; checkoutUrl: string };
  try {
    const created = await getPaymentProvider('stripe').createCheckout({
      orderId: order.id,
      courseId: course?.id ?? null,
      coursePriceId: null,
      zenlerCourseId: course?.zenlerCourseId ?? '',
      courseTitle: paymentTitle,
      paymentCardTitle: course ? `${course.name} — Custom / Resit offer` : paymentTitle,
      amount: input.offer.amount,
      currency: input.offer.currency || 'USD',
      studentEmail: input.offer.studentEmail,
      returnOrigin: CUSTOM_PAYMENT_SITE_ORIGIN,
      environment,
    });
    if (!created.checkoutUrl) throw new Error('Stripe did not return a checkout URL');
    session = { checkoutId: created.checkoutId, checkoutUrl: created.checkoutUrl };
    await attachCheckoutSession(order.id, { provider: 'stripe', checkoutId: session.checkoutId });
  } catch (err) {
    await closePendingPaymentOrder({ orderId: order.id, status: 'Cancelled' }).catch((closeErr: unknown) => {
      console.error('[custom-payment-offer] could not cancel the unused order', order.id, closeErr);
    });
    throw err;
  }

  if (input.previous.status === 'Pending') {
    try {
      const outcome = await retireUnpaidCheckout(input.previous);
      if (outcome === 'paid') {
        await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
        throw new CustomPaymentOfferError(ALREADY_PAID, 409);
      }
    } catch (err) {
      if (err instanceof CustomPaymentOfferError) throw err;
      await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
      throw err;
    }
  }

  const attached = await attachCustomPaymentCheckout(input.offer.id, {
    previousPaymentOrderId: input.previous.id,
    paymentOrderId: order.id,
    stripeCheckoutSessionId: session.checkoutId,
  });
  if (!attached) {
    await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
    throw new CustomPaymentOfferError(TRY_AGAIN, 409);
  }
  return { orderId: order.id, checkoutId: session.checkoutId, checkoutUrl: session.checkoutUrl };
}

/**
 * The emailed link. Each click opens a new Stripe session.
 * A paid or refunded offer does not open another one.
 */
export async function openCustomPaymentOfferLink(token: string): Promise<OpenCustomPaymentLinkResult> {
  const raw = token.trim();
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(raw)) return closedLink('invalid', INVALID);

  const offer = await getCustomPaymentOfferByTokenHash(hashDiscountToken(raw));
  if (!offer) return closedLink('invalid', INVALID);

  const previous = await getPaymentOrder(offer.paymentOrderId);
  if (!previous) return closedLink('invalid', INVALID);
  if (previous.status === 'Paid') return closedLink('used', ALREADY_PAID);
  if (previous.status === 'Refunded') return closedLink('used', REFUNDED);

  if (previous.status === 'Pending') {
    const sessionId = paymentOrderCheckoutId(previous);
    if (sessionId && previous.provider === 'stripe') {
      try {
        const session = await readStripeCheckoutSession(sessionId, previous.checkoutEnvironment);
        if (session.status === 'complete') return closedLink('used', ALREADY_PAID);
      } catch (err) {
        console.error('[custom-payment-offer] could not read the earlier checkout', previous.id, err);
      }
    }
  }

  try {
    const opened = await openStripeSession({ previous, offer });
    return { status: 'valid', message: '', checkoutUrl: opened.checkoutUrl };
  } catch (err) {
    if (err instanceof CustomPaymentOfferError && (err.message === ALREADY_PAID || err.message === REFUNDED)) {
      return closedLink('used', err.message);
    }
    if (err instanceof CustomPaymentOfferError) {
      return { status: 'error', message: err.message, checkoutUrl: null };
    }
    console.error('[custom-payment-offer] could not open the checkout', err);
    return { status: 'error', message: TRY_AGAIN, checkoutUrl: null };
  }
}

async function saveFreshPayLink(offer: CustomPaymentOffer): Promise<string> {
  let payToken = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    payToken = generateDiscountToken();
    try {
      const replaced = await replaceCustomPaymentPayLink(offer.id, {
        previousTokenHash: offer.tokenHash ?? null,
        tokenHash: hashDiscountToken(payToken),
        checkoutUrl: discountPayUrl(payToken),
      });
      if (!replaced) throw new CustomPaymentOfferError('This payment changed while it was being resent. Refresh and try again.', 409);
      return discountPayUrl(payToken);
    } catch (err) {
      if (err instanceof CustomPaymentOfferError) throw err;
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate|unique/i.test(message) || attempt === 4) throw err;
    }
  }
  throw new CustomPaymentOfferError('Could not create a payment link.');
}

/**
 * Email a new pay link. The previous link stops working.
 * Stripe opens when the student clicks, not when the email is sent.
 */
export async function resendCustomPaymentOffer(id: number): Promise<ResentCustomPaymentOffer> {
  const offer = await getCustomPaymentOfferById(id);
  if (!offer) throw new CustomPaymentOfferError('Payment offer not found.', 404);

  const previous = await getPaymentOrder(offer.paymentOrderId);
  if (!previous) throw new CustomPaymentOfferError('Payment order not found.', 404);
  if (previous.status === 'Paid') throw new CustomPaymentOfferError(ALREADY_PAID, 409);
  if (previous.status === 'Refunded') throw new CustomPaymentOfferError(REFUNDED, 409);

  if (previous.status === 'Pending') {
    const outcome = await retireUnpaidCheckout(previous);
    if (outcome === 'paid') throw new CustomPaymentOfferError(ALREADY_PAID, 409);
  }

  const { course, accessDays } = await courseForOffer(offer);
  const paymentTitle = course ? course.name : previous.courseTitle;
  const payUrl = await saveFreshPayLink(offer);

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendCustomPaymentOfferEmail({
      firstName: offer.studentFirstName,
      email: offer.studentEmail,
      courseTitle: paymentTitle,
      amount: offer.amount,
      currency: offer.currency || 'USD',
      durationDays: accessDays,
      checkoutUrl: payUrl,
    });
    await markCustomPaymentOfferEmailSent(offer.id);
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : 'The new link was saved, but the email could not be sent.';
    console.error('[custom-payment-offer] resend email failed', emailError);
  }

  const fresh = await getCustomPaymentOfferById(offer.id);
  return {
    ...(fresh ?? offer),
    checkoutUrl: payUrl,
    courseTitle: paymentTitle,
    durationDays: accessDays,
    emailSent,
    emailError,
  };
}

export async function issueCustomPaymentPayLink(): Promise<{ tokenHash: string; checkoutUrl: string }> {
  const token = generateDiscountToken();
  return { tokenHash: hashDiscountToken(token), checkoutUrl: discountPayUrl(token) };
}
