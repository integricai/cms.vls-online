import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  listPricingRegions,
  replacePricingRegions,
  type PricingRegionRow,
} from '../models/pricingRegionConfig';
import { refreshGeoPricingCache } from '../services/geoPricing';

const router = Router();

function parseRegionInput(body: unknown): PricingRegionRow[] {
  if (!Array.isArray(body)) {
    throw new Error('Request body must be an array of pricing regions');
  }

  return body.map((item, index) => {
    const row = item as Record<string, unknown>;
    const code = String(row.code ?? '').trim();
    const label = String(row.label ?? '').trim();
    if (!code || !label) {
      throw new Error(`Region at index ${index} requires code and label`);
    }

    const countriesRaw = row.countries;
    const countries = Array.isArray(countriesRaw)
      ? countriesRaw.map(value => String(value).trim().toUpperCase()).filter(Boolean)
      : String(countriesRaw ?? '')
        .split(/[,\s]+/)
        .map(value => value.trim().toUpperCase())
        .filter(Boolean);

    return {
      code: code.toUpperCase().replace(/\s+/g, '_'),
      label,
      discountPercent: Number(row.discountPercent ?? row.discount_percent ?? 0),
      isActive: row.isActive !== false && row.is_active !== false,
      sortOrder: Number(row.sortOrder ?? row.sort_order ?? (index + 1) * 10),
      countries,
    };
  });
}

router.get('/', authGuard, requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    const data = await listPricingRegions();
    return res.json({ ok: true, data });
  } catch (err) {
    next(err);
  }
});

router.put('/', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const regions = parseRegionInput(req.body?.regions ?? req.body);
    const data = await replacePricingRegions(regions);
    await refreshGeoPricingCache();
    return res.json({ ok: true, data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save pricing regions';
    return res.status(400).json({ ok: false, error: message });
  }
});

export default router;
