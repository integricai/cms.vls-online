import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { deleteBook, listBooks, updateBook, upsertScrapedBooks } from '../models/book';
import { scrapeBppBooks } from '../services/bookScraper';

const router = Router();

router.use(authGuard);

router.get('/', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ ok: true, data: await listBooks() });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', requireRole('admin', 'editor'), async (_req: Request, res: Response) => {
  try {
    const scraped = await scrapeBppBooks();
    const books = await upsertScrapedBooks(scraped);
    return res.json({
      ok: true,
      data: {
        scraped: scraped.length,
        saved: books.length,
        books,
        syncedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Book sync failed';
    console.error('[book-sync]', err);
    return res.status(502).json({ ok: false, error: message });
  }
});

router.put('/:id', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Invalid book id' });

    const price = Number(req.body.price);
    const discountedPrice = req.body.discountedPrice == null || req.body.discountedPrice === ''
      ? null
      : Number(req.body.discountedPrice);

    const book = await updateBook(id, {
      title: typeof req.body.title === 'string' ? req.body.title.trim() : undefined,
      description: typeof req.body.description === 'string' ? req.body.description.trim() : undefined,
      imageUrl: typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : undefined,
      imageAltText: typeof req.body.imageAltText === 'string' ? req.body.imageAltText.trim() : undefined,
      price: Number.isFinite(price) ? price : undefined,
      discountedPrice: discountedPrice == null || Number.isFinite(discountedPrice) ? discountedPrice : undefined,
      currency: typeof req.body.currency === 'string' ? req.body.currency.trim() || 'GBP' : undefined,
      stripeUrl: typeof req.body.stripeUrl === 'string' ? req.body.stripeUrl.trim() : undefined,
    });

    if (!book) return res.status(404).json({ ok: false, error: 'Book not found' });
    return res.json({ ok: true, data: book });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ ok: false, error: 'Invalid book id' });
    const deleted = await deleteBook(id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Book not found' });
    return res.json({ ok: true, data: { id } });
  } catch (err) {
    next(err);
  }
});

export default router;
