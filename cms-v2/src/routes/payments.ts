import { Router, Request, Response, NextFunction } from 'express';
import { getPaymentCard } from '../models/coursePaymentCard';
import {
  attachStripeCheckoutSession,
  createPaymentOrder,
  getPaymentOrderByCheckoutSession,
  markOrderEmailsSent,
  markPaymentOrderPaid,
} from '../models/paymentOrder';
import {
  createStripeCheckoutSession,
  verifyStripeWebhook,
} from '../services/stripeCheckout';
import {
  sendAdminPaymentNotification,
  sendStudentPaymentConfirmation,
} from '../services/paymentEmails';

const router = Router();

function parsePaymentOptionId(value: unknown): number | null {
  const text = String(value ?? '').trim();
  const match = text.match(/^payopt_(\d+)$/);
  const id = Number(match ? match[1] : text);
  return Number.isInteger(id) && id > 0 ? id : null;
}

router.post('/create-checkout-session', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
      studentEmail: order.studentEmail ?? order.stripeCustomerEmail,
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
