import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { deleteBook, listBooks, reorderBooks, updateBook } from '../models/book';

const router = Router();

router.use(authGuard);

router.get('/', requireRole('admin', 'editor'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ ok: true, data: await listBooks() });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', requireRole('admin', 'editor'), (_req: Request, res: Response) => {
  return res.status(410).json({
    ok: false,
    error: 'Book sync has been disabled. The books table is the source of truth.',
  });
});

router.post('/reorder', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map((id: unknown) => Number(id)) : [];
    if (!ids.length || ids.some((id: number) => !Number.isInteger(id) || id <= 0)) {
      return res.status(400).json({ ok: false, error: 'A valid ordered list of book ids is required' });
    }
    return res.json({ ok: true, data: await reorderBooks(ids) });
  } catch (err) {
    next(err);
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
