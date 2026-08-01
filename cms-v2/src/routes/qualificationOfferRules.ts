import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  listQualificationOfferRules,
  normalizeOfferRuleInput,
  replaceQualificationOfferRules,
} from '../models/qualificationOfferRule';
import type { QualificationOfferRuleInput } from '../../shared/types';
import {
  getNextOpenExamSessions,
  previewQualificationOffers,
} from '../services/qualificationOfferSessions';

const router = Router();

function parseRulesBody(body: unknown): QualificationOfferRuleInput[] {
  const raw = Array.isArray(body)
    ? body
    : (body && typeof body === 'object' && Array.isArray((body as { rules?: unknown }).rules)
      ? (body as { rules: unknown[] }).rules
      : null);

  if (!raw) {
    throw new Error('Request body must be an array of qualification offer rules');
  }

  return raw.map((item, index) => {
    try {
      return normalizeOfferRuleInput(item as QualificationOfferRuleInput);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid rule';
      throw new Error(`Rule at index ${index}: ${message}`);
    }
  });
}

router.get('/', authGuard, requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    const data = await listQualificationOfferRules();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const rules = parseRulesBody(req.body);
    const data = await replaceQualificationOfferRules(rules);
    return res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save qualification offer rules';
    return res.status(400).json({ ok: false, error: message });
  }
});

/** Preview open sessions / plan labels for a draft or saved rule as of a date. */
router.post('/preview', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const rule = normalizeOfferRuleInput(req.body?.rule ?? req.body);
    const asOfRaw = String(req.body?.asOf ?? req.query.asOf ?? '').trim();
    const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
    if (Number.isNaN(asOf.getTime())) {
      return res.status(400).json({ ok: false, error: 'Invalid asOf date' });
    }

    const data = previewQualificationOffers(rule, asOf);
    return res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to preview offers';
    return res.status(400).json({ ok: false, error: message });
  }
});

/** Utility: next open sessions for given months + cutoff. */
router.get('/sessions', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const months = String(req.query.months ?? '3,6,9,12')
      .split(',')
      .map(v => Number(v.trim()))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 12);
    const cutoffRaw = req.query.cutoffDay;
    const cutoffDay = cutoffRaw == null || cutoffRaw === ''
      ? null
      : Number(cutoffRaw);
    const asOfRaw = String(req.query.asOf ?? '').trim();
    const asOf = asOfRaw ? new Date(asOfRaw) : new Date();
    const count = Math.min(6, Math.max(1, Number(req.query.count ?? 2) || 2));

    if (cutoffDay != null && (!Number.isInteger(cutoffDay) || cutoffDay < 1 || cutoffDay > 28)) {
      return res.status(400).json({ ok: false, error: 'cutoffDay must be 1–28' });
    }
    if (Number.isNaN(asOf.getTime())) {
      return res.status(400).json({ ok: false, error: 'Invalid asOf date' });
    }

    const data = getNextOpenExamSessions(months, cutoffDay, asOf, count);
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

export default router;
