import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import cors from 'cors';
import { authGuard, requireRole } from './middleware/authGuard';
import authRouter from './routes/auth';
import snippetsRouter from './routes/snippets';
import contentRouter from './routes/content';
import usersRouter from './routes/users';
import publicRouter from './routes/public';
import blogRouter from './routes/blog';
import coursesRouter from './routes/courses';
import booksRouter from './routes/books';
import bookDiscountCodesRouter from './routes/bookDiscountCodes';
import adminPaymentsRouter from './routes/adminPayments';
import paymentOptionsRouter from './routes/paymentOptions';
import paymentsRouter, { stripeWebhookHandler } from './routes/payments';
import activityRouter from './routes/activity';
import trustpilotRouter from './routes/trustpilot';
import { sendErrorAlert } from './utils/errorAlert';
import { getContent, upsertContent } from './models/content';
import { listBlogPosts } from './models/blog';
import { getBlogAsset } from './models/blogAsset';
import { blogTopicSlug, renderBlogArticle, renderBlogLanding } from './services/blogRender';
import { listCoursePrices } from './models/coursePrice';
import { listBooks } from './models/book';

const app = express();
const PORT = Number(process.env.PORT ?? 3001);

// ── Middleware ────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? '*',
  credentials: true,
}));

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '10mb' }));

// ── Routes ────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ ok: true, data: { status: 'ok', ts: new Date().toISOString() } });
});

// Public — no auth, must allow any origin (fetched from Zenler/external pages)
app.options('/api/publish-banner', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

app.get('/api/publish-banner', async (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const row = await getContent('vls-banners');
    const data = row?.data && typeof row.data === 'object' ? row.data as { banners?: unknown[] } : {};
    return res.json({ banners: Array.isArray(data.banners) ? data.banners : [] });
  } catch (err) {
    next(err);
  }
});

app.options('/api/publish-header', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.status(204).end();
});

app.get('/api/publish-header', async (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const row = await getContent('vls-header-config');
    const data = row?.data && typeof row.data === 'object' ? row.data as { config?: unknown } : {};
    return res.json({ config: data.config ?? null });
  } catch (err) {
    next(err);
  }
});

app.post('/api/publish-header', authGuard, requireRole('admin', 'editor'), async (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const config = req.body?.config ?? null;
    const row = await upsertContent('vls-header-config', { config }, req.user!.userId);
    return res.json({ ok: true, data: row, config });
  } catch (err) {
    next(err);
  }
});

app.options('/api/publish-course-prices', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

app.get('/api/publish-course-prices', async (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    return res.json({ prices: await listCoursePrices() });
  } catch (err) {
    next(err);
  }
});

app.options('/api/publish-bpp-books', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

app.get('/api/publish-bpp-books', async (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    return res.json({ books: await listBooks() });
  } catch (err) {
    next(err);
  }
});

app.options('/api/publish-testimonials-components', (_req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.status(204).end();
});

app.get('/api/publish-testimonials-components', async (_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  try {
    const row = await getContent('vls-testimonials-components');
    const data = row?.data && typeof row.data === 'object' ? row.data as { components?: unknown[] } : {};
    return res.json({ components: Array.isArray(data.components) ? data.components : [] });
  } catch (err) {
    next(err);
  }
});

app.get('/api/turnstile-site-key', (_req, res) => {
  const siteKey = process.env.TURNSTILE_SITE_KEY;
  if (!siteKey) {
    return res.status(500).json({ ok: false, error: 'Turnstile is not configured' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ok: true, siteKey });
});

app.use('/api/auth', authRouter);
app.use('/api/snippets', snippetsRouter);
app.use('/api/content', contentRouter);
app.use('/api/users', usersRouter);
app.use('/api/blog', blogRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/books', booksRouter);
app.use('/api/book-discount-codes', bookDiscountCodesRouter);
app.use('/api/admin', adminPaymentsRouter);
app.use('/api/payment-options', paymentOptionsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/trustpilot', trustpilotRouter);
app.use('/api/public', publicRouter);

app.get('/blog', async (_req, res, next) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(renderBlogLanding(await listBlogPosts()));
  } catch (err) {
    next(err);
  }
});

app.get('/blog/:topic/:slug', async (req, res, next) => {
  try {
    const posts = await listBlogPosts();
    const post = posts.find(item =>
      item.status === 'published'
      && item.slug === req.params.slug
      && blogTopicSlug(item.topic) === req.params.topic
    );
    if (!post) return res.status(404).send('Blog post not found');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(renderBlogArticle(post));
  } catch (err) {
    next(err);
  }
});

app.get('/blog-assets/:id/:filename', async (req, res, next) => {
  try {
    const asset = await getBlogAsset(req.params.id);
    if (!asset) return res.status(404).send('Image not found');
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', String(asset.data.length));
    return res.send(asset.data);
  } catch (err) {
    next(err);
  }
});

// ── 404 catch-all ─────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// ── Global error handler ──────────────────────────────────────────

app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  sendErrorAlert({
    area: 'CMS API request failure',
    explanation: `Request failed while handling ${req.method} ${req.originalUrl}. This may indicate a database, email, or route-level exception.`,
    error: err,
    req,
  }).catch(alertErr => {
    console.error('[alert] failed to send CMS API error alert', alertErr);
  });
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason);
  sendErrorAlert({
    area: 'CMS API unhandled rejection',
    explanation: 'A promise rejected without being handled. The API process may be unstable.',
    error: reason,
  }).catch(alertErr => console.error('[alert] failed to send unhandled rejection alert', alertErr));
});

process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err);
  sendErrorAlert({
    area: 'CMS API uncaught exception',
    explanation: 'An uncaught exception reached the process boundary. The API process may crash or restart.',
    error: err,
  }).catch(alertErr => console.error('[alert] failed to send uncaught exception alert', alertErr));
});

// ── Start ─────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`cms-v2 running on http://localhost:${PORT}`);
});

export default app;
