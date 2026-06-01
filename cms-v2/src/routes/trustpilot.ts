import { Router, Request, Response } from 'express';
import https from 'https';
import zlib from 'zlib';
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

// Fetches a URL using Node's https module with full Chrome headers and
// automatic gzip/br decompression. Returns { status, body }.
function browserGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
    }, (res) => {
      const chunks: Buffer[] = [];
      const encoding = res.headers['content-encoding'] ?? '';

      let stream: NodeJS.ReadableStream = res;
      if (encoding === 'gzip') stream = res.pipe(zlib.createGunzip());
      else if (encoding === 'br') stream = res.pipe(zlib.createBrotliDecompress());
      else if (encoding === 'deflate') stream = res.pipe(zlib.createInflate());

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }));
      stream.on('error', reject);
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// GET /api/trustpilot/sync?count=12
router.get('/sync', async (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 12));

  try {
    const { status, body } = await browserGet('https://www.trustpilot.com/review/vls-online.com');

    if (status === 403) {
      return res.status(502).json({
        ok: false,
        error: 'Trustpilot returned 403 — Cloudflare is blocking the request. Try again in a few seconds, or use the official Trustpilot API (free key at developers.trustpilot.com).',
      });
    }
    if (status !== 200) {
      return res.status(502).json({ ok: false, error: `Trustpilot returned HTTP ${status}` });
    }

    // Detect Cloudflare JS challenge page (no actual content)
    if (body.includes('cf-browser-verification') || body.includes('_cf_chl_')) {
      return res.status(502).json({
        ok: false,
        error: 'Cloudflare is serving a JS challenge. The scraping approach cannot bypass this. Use the official Trustpilot API (free key at developers.trustpilot.com).',
      });
    }

    const match = body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match?.[1]) {
      return res.status(502).json({ ok: false, error: 'Could not find review data on the Trustpilot page — the page structure may have changed.' });
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
      return res.status(502).json({ ok: false, error: 'No reviews found in Trustpilot page data — the page structure may have changed.' });
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
