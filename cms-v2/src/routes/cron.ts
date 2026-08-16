import { Router, Request, Response } from 'express';
import { uploadDuePurchaseConversions } from '../services/googleAdsConversions';

const router = Router();

function cronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.get('authorization') ?? '';
  return header === `Bearer ${secret}`;
}

router.get('/google-ads-conversions', handlePurchaseUpload);
router.post('/google-ads-conversions', handlePurchaseUpload);

async function handlePurchaseUpload(req: Request, res: Response): Promise<void> {
  if (!cronAuthorized(req)) {
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return;
  }

  try {
    const result = await uploadDuePurchaseConversions();
    const ok = result.failed === 0;
    res.status(ok ? 200 : 502).json({ ok, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Conversion upload failed';
    console.error('[cron/google-ads-conversions]', err);
    res.status(500).json({ ok: false, error: message });
  }
}

export default router;
