import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { listPaidConversionOrders, type PaymentOrder } from '../models/paymentOrder';
import type {
  CheckoutEnvironment,
  ConversionUploadStatus,
  GoogleConversionListItem,
  GoogleConversionListPage,
} from '../../shared/types';
import {
  uploadDuePurchaseConversions,
  uploadSinglePurchaseConversion,
} from '../services/googleAdsConversions';

const router = Router();
router.use(authGuard);
router.use(requireRole('admin'));

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toListItem(order: PaymentOrder): GoogleConversionListItem {
  return {
    id: order.id,
    checkoutEnvironment: order.checkoutEnvironment,
    paidAt: toIso(order.paidAt),
    studentName: order.studentName,
    studentEmail: order.studentEmail ?? order.stripeCustomerEmail,
    studentPhone: order.studentPhone,
    courseTitle: order.courseTitle,
    amount: order.amount,
    currency: order.currency,
    conversionUploadStatus: order.conversionUploadStatus,
    gclid: order.gclid,
    gbraid: order.gbraid,
    wbraid: order.wbraid,
    utmSource: order.utmSource,
    utmMedium: order.utmMedium,
    utmCampaign: order.utmCampaign,
    conversionUploadedAt: toIso(order.conversionUploadedAt),
    conversionUploadError: order.conversionUploadError,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim() || undefined;
    const statusRaw = String(req.query.status ?? 'all');
    const uploadStatus = (
      ['all', 'pending_upload', 'uploaded', 'extended_upload', 'failed'].includes(statusRaw)
        ? statusRaw
        : 'all'
    ) as ConversionUploadStatus | 'all';
    const environmentRaw = String(req.query.environment ?? 'all');
    const environment = (
      ['all', 'staging', 'production'].includes(environmentRaw)
        ? environmentRaw
        : 'all'
    ) as CheckoutEnvironment | 'all';
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 50);

    const result = await listPaidConversionOrders({
      search,
      uploadStatus,
      environment,
      page,
      pageSize,
    });

    const data: GoogleConversionListPage = {
      items: result.items.map(toListItem),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
    };
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

router.post('/run-due', async (_req, res, next) => {
  try {
    const result = await uploadDuePurchaseConversions();
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/retry', async (req, res, next) => {
  try {
    const orderId = parseId(req.params.id);
    if (!orderId) return res.status(400).json({ ok: false, error: 'Invalid order id' });
    const result = await uploadSinglePurchaseConversion(orderId);
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Retry failed';
    if (message === 'Payment order not found') {
      return res.status(404).json({ ok: false, error: message });
    }
    if (message.startsWith('Only paid')) {
      return res.status(400).json({ ok: false, error: message });
    }
    next(err);
  }
});

export default router;
