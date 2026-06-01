import { Router, Request, Response } from 'express';
import { authGuard } from '../middleware/authGuard';

const router = Router();
router.use(authGuard);

interface TrustpilotCard {
  initials: string;
  name: string;
  title: string;
  dateLabel: string;
  url: string;
  country: string;
  rating: number;
  quote: string;
}

function toInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function toMonthYear(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

// GET /api/trustpilot/sync?count=12
// Uses the Trustpilot Public API (api.trustpilot.com/v1).
// Requires TRUSTPILOT_API_KEY in the server environment.
router.get('/sync', async (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 12));
  const apiKey = process.env.TRUSTPILOT_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      ok: false,
      error: 'TRUSTPILOT_API_KEY is not set. Add it to .env.local and restart the server.',
    });
  }

  try {
    // Step 1: resolve the business unit ID for vls-online.com
    const buRes = await fetch(
      `https://api.trustpilot.com/v1/business-units/find?name=vls-online.com&apikey=${encodeURIComponent(apiKey)}`
    );
    if (!buRes.ok) {
      const text = await buRes.text().catch(() => '');
      return res.status(502).json({ ok: false, error: `Trustpilot API returned ${buRes.status} looking up business unit. ${text}`.trim() });
    }
    const buData = await buRes.json() as any;
    const businessUnitId: string = buData.id ?? '';
    if (!businessUnitId) {
      return res.status(502).json({ ok: false, error: 'Trustpilot API did not return a business unit ID for vls-online.com.' });
    }

    // Step 2: fetch reviews
    const reviewsRes = await fetch(
      `https://api.trustpilot.com/v1/business-units/${encodeURIComponent(businessUnitId)}/reviews` +
      `?apikey=${encodeURIComponent(apiKey)}&perPage=${count}&orderBy=createdat.desc&stars=4&stars=5`
    );
    if (!reviewsRes.ok) {
      const text = await reviewsRes.text().catch(() => '');
      return res.status(502).json({ ok: false, error: `Trustpilot API returned ${reviewsRes.status} fetching reviews. ${text}`.trim() });
    }
    const reviewsData = await reviewsRes.json() as any;
    const rawReviews: any[] = reviewsData.reviews ?? [];

    if (rawReviews.length === 0) {
      return res.status(502).json({ ok: false, error: 'No reviews returned from Trustpilot API.' });
    }

    const cards: TrustpilotCard[] = rawReviews.map((r: any) => {
      const name: string = r.consumer?.displayName ?? '';
      const reviewId: string = r.id ?? '';
      return {
        initials: toInitials(name),
        name,
        title: r.title ?? '',
        dateLabel: toMonthYear(r.createdAt ?? ''),
        url: reviewId
          ? `https://www.trustpilot.com/reviews/${reviewId}`
          : 'https://www.trustpilot.com/review/vls-online.com',
        country: (r.consumer?.countryCode ?? '').toUpperCase(),
        rating: Math.min(5, Math.max(1, Number(r.stars ?? 5))),
        quote: r.text ?? '',
      };
    });

    return res.json({ ok: true, data: cards });
  } catch (err: any) {
    console.error('[trustpilot sync]', err);
    return res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error contacting Trustpilot API.' });
  }
});

export default router;
