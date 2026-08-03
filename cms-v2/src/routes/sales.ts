import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  getPaymentOrder,
  markPaymentOrderRefunded,
} from '../models/paymentOrder';
import {
  getSaleById,
  getSaleListItemById,
  listSales,
  summarizeSalesByCourse,
  summarizeSalesByTutor,
} from '../models/sale';
import { listActiveTutorsForCourse, listTutors } from '../models/tutor';
import {
  acceptSaleInvite,
  adminAssignSale,
  previewSaleAccept,
} from '../services/saleAssignment';
import { sendStudentRefundConfirmation } from '../services/paymentEmails';
import { createStripeRefund } from '../services/stripeCheckout';
import { revokeZenlerAccessForRefundedOrder } from '../services/zenlerEnrollmentEnsure';

const router = Router();

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Public accept endpoints (no auth)
router.get('/accept', async (req, res, next) => {
  try {
    const token = String(req.query.token ?? '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });
    const preview = await previewSaleAccept(token);
    return res.json({ ok: true, data: preview });
  } catch (err) {
    next(err);
  }
});

router.post('/accept', async (req, res, next) => {
  try {
    const token = String(req.body?.token ?? '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });
    const result = await acceptSaleInvite(token);
    if (!result.ok) return res.status(409).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.sale });
  } catch (err) {
    next(err);
  }
});

router.use(authGuard);

router.get('/', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const statusRaw = String(req.query.status ?? 'All');
    const status = (
      ['All', 'Unassigned', 'AwaitingTutor', 'Assigned', 'AdminAssigned', 'AssignedAny'].includes(statusRaw)
        ? statusRaw
        : 'All'
    ) as 'All' | 'Unassigned' | 'AwaitingTutor' | 'Assigned' | 'AdminAssigned' | 'AssignedAny';

    const courseId = req.query.courseId != null ? parseId(req.query.courseId) : null;
    const tutorId = req.query.tutorId != null ? parseId(req.query.tutorId) : null;
    if (req.query.courseId != null && !courseId) {
      return res.status(400).json({ ok: false, error: 'Invalid courseId' });
    }
    if (req.query.tutorId != null && !tutorId) {
      return res.status(400).json({ ok: false, error: 'Invalid tutorId' });
    }

    const sales = await listSales({
      status,
      courseId: courseId ?? undefined,
      tutorId: tutorId ?? undefined,
    });
    return res.json({ ok: true, data: sales });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/by-course', requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await summarizeSalesByCourse() });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/by-tutor', requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await summarizeSalesByTutor() });
  } catch (err) {
    next(err);
  }
});

router.get('/tutors', requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await listTutors() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/eligible-tutors', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid sale id' });
    const sale = await getSaleById(id);
    if (!sale) return res.status(404).json({ ok: false, error: 'Sale not found' });
    const tutors = await listActiveTutorsForCourse(sale.courseId);
    return res.json({ ok: true, data: tutors });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/assign', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const tutorId = parseId(req.body?.tutorId);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid sale id' });
    if (!tutorId) return res.status(400).json({ ok: false, error: 'tutorId is required' });

    const result = await adminAssignSale(id, tutorId);
    if (!result.ok) return res.status(409).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.sale });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/refund', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid sale id' });

    const sale = await getSaleById(id);
    if (!sale) return res.status(404).json({ ok: false, error: 'Sale not found' });

    const order = await getPaymentOrder(sale.paymentOrderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Payment order not found' });
    if (order.status === 'Refunded') {
      await revokeZenlerAccessForRefundedOrder(order);
      const existing = await getSaleListItemById(id);
      return res.json({ ok: true, data: existing });
    }
    if (order.status !== 'Paid') {
      return res.status(409).json({ ok: false, error: `Cannot refund a ${order.status.toLowerCase()} payment` });
    }
    if (!order.stripePaymentIntentId) {
      return res.status(409).json({
        ok: false,
        error: 'Missing Stripe payment intent ID — refund this payment in Stripe Dashboard, or wait for webhook sync',
      });
    }

    const refund = await createStripeRefund({
      paymentIntentId: order.stripePaymentIntentId,
      reason: 'requested_by_customer',
    });

    const { order: refunded, wasAlreadyRefunded } = await markPaymentOrderRefunded({
      orderId: order.id,
      stripeRefundId: refund.id,
      stripePaymentIntentId: refund.paymentIntentId ?? order.stripePaymentIntentId,
    });

    await revokeZenlerAccessForRefundedOrder(refunded);

    if (!wasAlreadyRefunded) {
      try {
        await sendStudentRefundConfirmation(refunded);
      } catch (emailErr) {
        console.error('[sales] refund confirmation email failed', emailErr);
      }
    }

    const updated = await getSaleListItemById(id);
    return res.json({ ok: true, data: updated });
  } catch (err) {
    next(err);
  }
});

export default router;
