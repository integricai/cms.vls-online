import { Router, Request, Response } from 'express';
import https from 'https';
import zlib from 'zlib';
import { authGuard } from '../middleware/authGuard';

const router = Router();
router.use(authGuard);

const TRUSTPILOT_REVIEW_URL = 'https://www.trustpilot.com/review/vls-online.com';

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

function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function findReviewArrays(value: any, results: any[][] = []): any[][] {
  if (!value || typeof value !== 'object') return results;
  if (Array.isArray(value)) {
    if (value.some(item => item && typeof item === 'object' && ('text' in item || 'stars' in item || 'rating' in item) && ('consumer' in item || 'title' in item))) {
      results.push(value);
    }
    value.forEach(item => findReviewArrays(item, results));
    return results;
  }
  Object.values(value).forEach(item => findReviewArrays(item, results));
  return results;
}

function parseTrustpilotReviews(body: string): any[] {
  const match = body.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match?.[1]) return [];

  const nextData = JSON.parse(decodeHtml(match[1]));
  const direct = nextData?.props?.pageProps?.reviews ?? nextData?.props?.pageProps?.businessUnit?.reviews;
  if (Array.isArray(direct) && direct.length) return direct;

  const candidates = findReviewArrays(nextData).sort((a, b) => b.length - a.length);
  return candidates[0] ?? [];
}

function trustpilotBlockedMessage(status?: number): string {
  return status === 403
    ? 'Trustpilot blocked the public-page sync with 403. This is Cloudflare protection on Trustpilot, not a CMS error. Wait a few minutes and try again, or manually add the testimonials if Trustpilot keeps blocking server requests.'
    : 'Trustpilot is serving a Cloudflare challenge instead of review data. The CMS can sync public-page reviews only when Trustpilot allows the request.';
}

function mapReviewToCard(r: any): TrustpilotCard {
  const name: string = r.consumer?.displayName ?? r.consumer?.consumerName ?? r.consumer?.name ?? '';
  const reviewId: string = r.id ?? '';
  return {
    initials: toInitials(name),
    name,
    title: r.title ?? '',
    dateLabel: toMonthYear(r.dates?.publishedDate ?? r.createdAt ?? r.date ?? ''),
    url: reviewId
      ? `https://www.trustpilot.com/reviews/${reviewId}`
      : TRUSTPILOT_REVIEW_URL,
    country: (r.consumer?.countryCode ?? r.consumer?.country ?? '').toUpperCase(),
    rating: Math.min(5, Math.max(1, Number(r.stars ?? r.rating ?? 5))),
    quote: r.text ?? r.content ?? '',
  };
}

// GET /api/trustpilot/sync?count=12
router.get('/sync', async (req: Request, res: Response) => {
  const count = Math.min(50, Math.max(1, Number(req.query.count) || 12));

  try {
    const reviews: any[] = [];
    const seen = new Set<string>();
    const pagesToTry = Math.max(1, Math.ceil(count / 20));

    for (let page = 1; page <= pagesToTry && reviews.length < count; page += 1) {
      const url = page === 1 ? TRUSTPILOT_REVIEW_URL : `${TRUSTPILOT_REVIEW_URL}?page=${page}`;
      const { status, body } = await browserGet(url);

      if (status === 403) {
        return res.status(502).json({ ok: false, error: trustpilotBlockedMessage(status) });
      }
      if (status !== 200) {
        return res.status(502).json({ ok: false, error: `Trustpilot returned HTTP ${status} while loading ${url}` });
      }

      if (body.includes('cf-browser-verification') || body.includes('_cf_chl_') || body.includes('Just a moment...')) {
        return res.status(502).json({ ok: false, error: trustpilotBlockedMessage() });
      }

      const pageReviews = parseTrustpilotReviews(body);
      if (!pageReviews.length) break;

      pageReviews.forEach(review => {
        const id = String(review?.id ?? `${review?.consumer?.displayName ?? ''}-${review?.createdAt ?? ''}-${review?.title ?? ''}`);
        if (seen.has(id)) return;
        seen.add(id);
        reviews.push(review);
      });
    }

    if (!reviews.length) {
      return res.status(502).json({ ok: false, error: 'No reviews found in Trustpilot page data — the page structure may have changed.' });
    }

    const cards = reviews.slice(0, count).map(mapReviewToCard);

    return res.json({ ok: true, data: cards });
  } catch (err: any) {
    console.error('[trustpilot sync]', err);
    return res.status(500).json({ ok: false, error: err?.message ?? 'Unexpected error fetching from Trustpilot.' });
  }
});

export default router;
