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

// GET /api/trustpilot/sync
// Fetches the VLS Online Trustpilot page, extracts up to 12 reviews from the
// embedded __NEXT_DATA__ JSON blob, and returns them as TestimonialCard objects.
router.get('/sync', async (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 12));

  try {
    const pageRes = await fetch('https://www.trustpilot.com/review/vls-online.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
      },
    });

    if (!pageRes.ok) {
      return res.status(502).json({ ok: false, error: `Trustpilot returned HTTP ${pageRes.status}` });
    }

    const html = await pageRes.text();

    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      return res.status(502).json({ ok: false, error: 'Could not find __NEXT_DATA__ on the Trustpilot page — the page structure may have changed.' });
    }

    let nextData: any;
    try {
      nextData = JSON.parse(match[1]);
    } catch {
      return res.status(502).json({ ok: false, error: 'Failed to parse Trustpilot page data.' });
    }

    const pageProps = nextData?.props?.pageProps ?? {};
    const rawReviews: any[] = pageProps.reviews ?? pageProps.businessUnit?.reviews ?? [];

    if (!Array.isArray(rawReviews) || rawReviews.length === 0) {
      return res.status(502).json({ ok: false, error: 'No reviews found in Trustpilot page data. The page structure may have changed.' });
    }

    const cards: TrustpilotCard[] = rawReviews.slice(0, count).map((r: any) => {
      const name: string = r.consumer?.displayName ?? r.consumer?.consumerName ?? '';
      const reviewId: string = r.id ?? '';
      return {
        initials: toInitials(name),
        name,
        title: r.title ?? '',
        dateLabel: toMonthYear(r.dates?.publishedDate ?? r.createdAt ?? ''),
        url: reviewId
          ? `https://www.trustpilot.com/reviews/${reviewId}`
          : 'https://www.trustpilot.com/review/vls-online.com',
        country: (r.consumer?.countryCode ?? '').toUpperCase(),
        rating: Math.min(5, Math.max(1, Number(r.stars ?? r.rating ?? 5))),
        quote: r.text ?? '',
      };
    });

    return res.json({ ok: true, data: cards });
  } catch (err: any) {
    console.error('[trustpilot sync]', err);
    return res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error fetching from Trustpilot.' });
  }
});

export default router;
