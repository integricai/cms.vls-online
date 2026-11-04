import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { visitIpRateLimit } from '../middleware/rateLimit';
import { isDashboardRange } from '../../shared/salesFormat';
import { buildTrackingReport, recordTrackingVisit } from '../models/siteTracking';
import { recordSiteVisitor } from '../models/siteAnalytics';
import { detectClientIpFromRequest, detectCountryFromRequest } from '../services/geoDetection';
import { proxySecretMatches } from '../services/proxySecret';
import {
  TRACKING_CONSENT_REGIONS,
  classifyTrackingVisit,
  parseTrackingVisit,
  trackingAllowed,
} from '../services/siteTracking';

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

router.post('/track', visitIpRateLimit, async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!proxySecretMatches(req.get('x-vls-proxy-secret'))) {
    res.status(200).json({ ok: true, recorded: false });
    return;
  }
  const ip = detectClientIpFromRequest(req);
  const country = detectCountryFromRequest(req).countryCode;
  const visit = parseTrackingVisit(req.body);
  if (!ip || !trackingAllowed(visit.consent, country, TRACKING_CONSENT_REGIONS)) {
    res.status(200).json({ ok: true, recorded: false });
    return;
  }
  try {
    await recordTrackingVisit(ip, String(req.get('user-agent') ?? ''), classifyTrackingVisit(visit), country);
    res.status(200).json({ ok: true, recorded: true });
  } catch (err) {
    console.error('[analytics] track record failed', err instanceof Error ? err.message : err);
    res.status(200).json({ ok: true, recorded: false });
  }
});

router.get('/tracking', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    const requested = String(req.query.range ?? 'last_30_days');
    const range = isDashboardRange(requested) ? requested : 'last_30_days';
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, data: await buildTrackingReport(range) });
  } catch (err) {
    next(err);
  }
});

export default router;
