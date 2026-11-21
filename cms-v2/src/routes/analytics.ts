import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { visitIpRateLimit } from '../middleware/rateLimit';
import { isTrackingPreset, trackingCustomBounds, trackingPresetBounds } from '../../shared/siteTracking';
import { buildTrackingReport, recordTrackingVisit } from '../models/siteTracking';
import { listTrackingNames } from '../models/siteUrl';
import { applyPageTrackingNames } from '../../shared/pageTracking';
import { loadTrackingSales } from '../models/trackingSales';
import { loadGa4Traffic } from '../services/ga4Report';
import { CheckoutFollowupResendError, listFailedPaymentsForVault, resendFailedPaymentEmail } from '../services/checkoutFollowups';
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

router.get('/ga4', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    const requested = String(req.query.range ?? 'this_month');
    res.setHeader('Cache-Control', 'no-store');
    const bounds = requested === 'custom'
      ? trackingCustomBounds(String(req.query.start ?? ''), String(req.query.end ?? ''))
      : trackingPresetBounds(isTrackingPreset(requested) ? requested : 'this_month');
    if (!bounds) {
      res.status(400).json({ ok: false, error: 'Choose a start date and an end date within one year.' });
      return;
    }
    const range = requested === 'custom' ? 'custom' : (isTrackingPreset(requested) ? requested : 'this_month');
    const [traffic, sales] = await Promise.all([
      loadGa4Traffic(bounds.start, bounds.end),
      loadTrackingSales(bounds.start, bounds.end),
    ]);
    res.json({ ok: true, data: { range, start: bounds.start, end: bounds.end, traffic, sales } });
  } catch (err) {
    next(err);
  }
});

async function namedLandingPages<T extends { landingPages: { label: string; visitors: number }[] }>(report: T): Promise<T> {
  try {
    const names = await listTrackingNames();
    if (Object.keys(names).length === 0) return report;
    const named = applyPageTrackingNames(
      report.landingPages.map(row => ({ label: row.label, value: row.visitors })),
      names,
    );
    return { ...report, landingPages: named.map(row => ({ label: row.label, visitors: row.value })) };
  } catch (err) {
    console.error('[tracking-names]', err instanceof Error ? err.message : err);
    return report;
  }
}

router.get('/tracking', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    const requested = String(req.query.range ?? 'this_month');
    res.setHeader('Cache-Control', 'no-store');
    if (requested === 'custom') {
      const bounds = trackingCustomBounds(String(req.query.start ?? ''), String(req.query.end ?? ''));
      if (!bounds) {
        res.status(400).json({ ok: false, error: 'Choose a start date and an end date within one year.' });
        return;
      }
      res.json({ ok: true, data: await namedLandingPages(await buildTrackingReport('custom', bounds)) });
      return;
    }
    const range = isTrackingPreset(requested) ? requested : 'this_month';
    res.json({ ok: true, data: await namedLandingPages(await buildTrackingReport(range, trackingPresetBounds(range))) });
  } catch (err) {
    next(err);
  }
});

function failedPaymentBounds(query: { range?: unknown; start?: unknown; end?: unknown }): { start: string; end: string } | null {
  const requested = String(query.range ?? 'this_month');
  if (requested === 'custom') {
    return trackingCustomBounds(String(query.start ?? ''), String(query.end ?? ''));
  }
  const range = isTrackingPreset(requested) ? requested : 'this_month';
  return trackingPresetBounds(range);
}

router.get('/failed-payments', authGuard, requireRole('admin'), async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    const bounds = failedPaymentBounds(req.query);
    if (!bounds) {
      res.status(400).json({ ok: false, error: 'Choose a start date and an end date within one year.' });
      return;
    }
    const rows = await listFailedPaymentsForVault(bounds.start, bounds.end);
    res.json({ ok: true, data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/failed-payments/:id/resend', authGuard, requireRole('admin'), async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ ok: false, error: 'That failed payment could not be found.' });
    return;
  }
  try {
    const row = await resendFailedPaymentEmail(id);
    res.json({ ok: true, data: row });
  } catch (err) {
    if (err instanceof CheckoutFollowupResendError) {
      res.status(err.status).json({ ok: false, error: err.message });
      return;
    }
    next(err);
  }
});

export default router;
