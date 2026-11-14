import { getCourseById } from '../models/courseGeoPrice';
import {
  getCustomPaymentOfferById,
  markCustomPaymentOfferEmailSent,
  replaceCustomPaymentCheckout,
  type CustomPaymentOffer,
} from '../models/customPaymentOffer';
import {
  attachCheckoutSession,
  closePendingPaymentOrder,
  createPaymentOrder,
  getPaymentOrder,
  paymentOrderCheckoutId,
} from '../models/paymentOrder';
import { sendCustomPaymentOfferEmail } from './paymentEmails';
import { getPaymentProvider } from './payments/registry';
import { expireOpenStripeCheckoutSession } from './stripeCheckout';

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

async function abandonUnpaidCheckout(orderId: number, sessionId: string, environment: 'production' | 'staging' | null): Promise<void> {
  try {
    await expireOpenStripeCheckoutSession(sessionId, environment);
  } catch (err) {
    console.error('[custom-payment-offer] could not expire the unused checkout', orderId, err);
  }
  await closePendingPaymentOrder({ orderId, status: 'Cancelled' });
}

/**
 * Send a new checkout for the same offer.
 * A course on the offer is enrolled after payment. A description-only offer is not.
 * The previous unpaid link stops working.
 */
export async function resendCustomPaymentOffer(id: number): Promise<ResentCustomPaymentOffer> {
  const offer = await getCustomPaymentOfferById(id);
  if (!offer) throw new CustomPaymentOfferError('Payment offer not found.', 404);

  const previous = await getPaymentOrder(offer.paymentOrderId);
  if (!previous) throw new CustomPaymentOfferError('Payment order not found.', 404);
  if (previous.status === 'Paid') {
    throw new CustomPaymentOfferError('This payment has already been received.', 409);
  }
  if (previous.status === 'Refunded') {
    throw new CustomPaymentOfferError('This payment has been refunded.', 409);
  }

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

  const paymentTitle = course ? course.name : previous.courseTitle;
  const studentName = `${offer.studentFirstName} ${offer.studentLastName}`.trim();
  const environment = previous.checkoutEnvironment === 'production' ? 'production' : 'staging';

  const order = await createPaymentOrder({
    paymentOptionId: null,
    courseId: course?.id ?? null,
    coursePriceId: null,
    customerId: previous.customerId,
    zenlerCourseId: course?.zenlerCourseId ?? '',
    courseTitle: paymentTitle,
    optionType: course ? 'Custom / Resit offer' : 'Custom payment',
    studentName,
    studentEmail: offer.studentEmail,
    countryCode: previous.countryCode,
    amount: offer.amount,
    currency: offer.currency || 'USD',
    durationDays: accessDays,
    discountPercent: null,
    environment,
  });

  let session: { provider: 'stripe'; checkoutId: string; checkoutUrl: string };
  try {
    const created = await getPaymentProvider('stripe').createCheckout({
      orderId: order.id,
      courseId: course?.id ?? null,
      coursePriceId: null,
      zenlerCourseId: course?.zenlerCourseId ?? '',
      courseTitle: paymentTitle,
      paymentCardTitle: course ? `${course.name} — Custom / Resit offer` : paymentTitle,
      amount: offer.amount,
      currency: offer.currency || 'USD',
      studentEmail: offer.studentEmail,
      returnOrigin: CUSTOM_PAYMENT_SITE_ORIGIN,
      environment,
    });
    if (!created.checkoutUrl) throw new Error('Stripe did not return a checkout URL');
    session = { provider: 'stripe', checkoutId: created.checkoutId, checkoutUrl: created.checkoutUrl };
    await attachCheckoutSession(order.id, {
      provider: session.provider,
      checkoutId: session.checkoutId,
    });
  } catch (err) {
    await closePendingPaymentOrder({ orderId: order.id, status: 'Cancelled' }).catch((closeErr: unknown) => {
      console.error('[custom-payment-offer] could not cancel the unused order', order.id, closeErr);
    });
    throw err;
  }

  if (previous.status === 'Pending') {
    const previousSessionId = paymentOrderCheckoutId(previous);
    try {
      if (previousSessionId && previous.provider === 'stripe') {
        const outcome = await expireOpenStripeCheckoutSession(previousSessionId, previous.checkoutEnvironment);
        if (outcome === 'complete') {
          await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
          throw new CustomPaymentOfferError('This payment has already been received.', 409);
        }
      }
      await closePendingPaymentOrder({ orderId: previous.id, status: 'Cancelled' });
    } catch (err) {
      if (err instanceof CustomPaymentOfferError) throw err;
      await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
      throw err;
    }
  }

  const replaced = await replaceCustomPaymentCheckout(offer.id, {
    previousPaymentOrderId: previous.id,
    paymentOrderId: order.id,
    stripeCheckoutSessionId: session.checkoutId,
    checkoutUrl: session.checkoutUrl,
  });
  if (!replaced) {
    await abandonUnpaidCheckout(order.id, session.checkoutId, environment);
    throw new CustomPaymentOfferError('This payment changed while it was being resent. Refresh and try again.', 409);
  }

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
      checkoutUrl: session.checkoutUrl,
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
    paymentOrderId: order.id,
    checkoutUrl: session.checkoutUrl,
    courseTitle: paymentTitle,
    durationDays: accessDays,
    emailSent,
    emailError,
  };
}
