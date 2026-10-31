import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  getPaymentOrder,
  markPaymentOrderRefunded,
  paymentOrderPaymentId,
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
import { getPaymentRefundProvider } from '../services/payments/registry';
import { revokeZenlerAccessForRefundedOrder } from '../services/zenlerEnrollmentEnsure';
import { buildSalesDashboard } from '../services/salesDashboard';
import { getUsdRates } from '../services/fxRates';
import { countMissingStripeFees, syncStripeFees } from '../services/stripeSettlement';
import { isDashboardRange, isIsoDate } from '../../shared/salesFormat';

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

router.get('/', requireRole('admin'), async (req, res, next) => {
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
    const fromDate = String(req.query.from ?? '').trim();
    const toDate = String(req.query.to ?? '').trim();
    if ((fromDate && !isIsoDate(fromDate)) || (toDate && !isIsoDate(toDate))) {
      return res.status(400).json({ ok: false, error: 'Dates must be YYYY-MM-DD' });
    }
    if (fromDate && toDate && fromDate > toDate) {
      return res.status(400).json({ ok: false, error: 'Start date is after the end date' });
    }

    const environmentRaw = String(req.query.environment ?? 'production');
    const environment = environmentRaw === 'staging' || environmentRaw === 'all'
      ? environmentRaw
      : 'production';

    const sales = await listSales({
      status,
      courseId: courseId ?? undefined,
      tutorId: tutorId ?? undefined,
      fromDate: fromDate || null,
      toDate: toDate || null,
      environment: environment === 'all' ? null : environment,
    });
    return res.json({ ok: true, data: sales });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/by-course', requireRole('admin'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await summarizeSalesByCourse() });
  } catch (err) {
    next(err);
  }
});

function readDateRange(body: unknown): { from: string; to: string } | null {
  const record = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const from = String(record.from ?? '').trim();
  const to = String(record.to ?? '').trim();
  if (!isIsoDate(from) || !isIsoDate(to) || from > to) return null;
  return { from, to };
}

router.get('/fx-rates', requireRole('admin'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await getUsdRates() });
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard', requireRole('admin'), async (req, res, next) => {
  try {
    const requested = String(req.query.range ?? 'this_month');
    const range = isDashboardRange(requested) ? requested : 'this_month';
    return res.json({ ok: true, data: await buildSalesDashboard(range) });
  } catch (err) {
    next(err);
  }
});

router.post('/sync-fees', requireRole('admin'), async (req, res, next) => {
  try {
    const range = readDateRange(req.body);
    if (!range) return res.status(400).json({ ok: false, error: 'from and to must be YYYY-MM-DD' });
    const updated = await syncStripeFees(range.from, range.to);
    const [sales, sandboxSales, remaining] = await Promise.all([
      listSales({ fromDate: range.from, toDate: range.to, environment: 'production' }),
      listSales({ fromDate: range.from, toDate: range.to, environment: 'staging' }),
      countMissingStripeFees(range.from, range.to),
    ]);
    return res.json({ ok: true, data: { sales, sandboxSales, remaining, updated } });
  } catch (err) {
    next(err);
  }
});

router.get('/summary/by-tutor', requireRole('admin'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await summarizeSalesByTutor() });
  } catch (err) {
    next(err);
  }
});

router.get('/tutors', requireRole('admin'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await listTutors() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/eligible-tutors', requireRole('admin'), async (req, res, next) => {
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

router.post('/:id/assign', requireRole('admin'), async (req, res, next) => {
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

router.post('/:id/refund', requireRole('admin'), async (req, res) => {
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
    const paymentId = paymentOrderPaymentId(order);
    if (!paymentId) {
      return res.status(409).json({
        ok: false,
        error: 'Missing processor payment ID — refund this payment in the provider dashboard, or wait for webhook sync',
      });
    }

    // Direct checkout disabled, legacy refund only. Stripe orders refund through Stripe, including Stripe PayPal.
    const refund = await getPaymentRefundProvider(order.provider).refund({
      paymentId,
      reason: 'requested_by_customer',
      environment: order.checkoutEnvironment,
    });

    const { order: refunded, wasAlreadyRefunded } = await markPaymentOrderRefunded({
      orderId: order.id,
      provider: order.provider,
      refundId: refund.refundId,
      paymentId: refund.paymentId ?? paymentId,
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
    console.error('[sales] refund failed', err);
    const message = err instanceof Error && err.message.trim()
      ? err.message
      : 'Refund failed';
    return res.status(502).json({ ok: false, error: message });
  }
});

export default router;
