import { Router } from 'express';
import { visitIpRateLimit } from '../middleware/rateLimit';
import { detectClientIpFromRequest } from '../services/geoDetection';
import { recordSiteVisitor } from '../models/siteAnalytics';

const router = Router();

function allowVisitCors(res: { setHeader: (name: string, value: string) => void }): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

router.options('/visit', (_req, res) => {
  allowVisitCors(res);
  res.status(204).end();
});

router.post('/visit', visitIpRateLimit, async (req, res) => {
  allowVisitCors(res);
  res.setHeader('Cache-Control', 'no-store');
  const ip = detectClientIpFromRequest(req);
  if (!ip) {
    res.status(204).end();
    return;
  }
  try {
    await recordSiteVisitor(ip, String(req.get('user-agent') ?? ''));
  } catch (err) {
    console.error('[analytics] visit record failed', err instanceof Error ? err.message : err);
  }
  res.status(204).end();
});

export default router;
