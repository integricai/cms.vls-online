import { Router, Request, Response, NextFunction } from 'express';
import { put } from '@vercel/blob';
import { authGuard, requireRole } from '../middleware/authGuard';
import { createBook, deleteBook, listBooks, reorderBooks, updateBook } from '../models/book';

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

router.post('/upload-image', requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ ok: false, error: 'Image upload requires Blob storage. Paste a direct image URL instead.' });
  }

  const filename = typeof req.body?.filename === 'string' ? req.body.filename : 'book-cover.jpg';
  const contentType = typeof req.body?.contentType === 'string' ? req.body.contentType : 'image/jpeg';
  const data = typeof req.body?.data === 'string' ? req.body.data : '';
  if (!data) return res.status(400).json({ ok: false, error: 'No image data provided' });
  if (!contentType.startsWith('image/')) return res.status(400).json({ ok: false, error: 'Only image uploads are supported' });
  if (data.length > 8 * 1024 * 1024) return res.status(400).json({ ok: false, error: 'Image too large. Please compress it or paste an image URL.' });

  try {
    const buffer = Buffer.from(data, 'base64');
    const ext = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const pathname = `cms/books/manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const result = await put(pathname, buffer, {
      access: 'public',
      addRandomSuffix: false,
      contentType,
    });
    return res.json({ ok: true, data: { url: result.url } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Image upload failed';
    return res.status(500).json({ ok: false, error: message });
  }
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

router.post('/', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const price = Number(req.body.price);
    const discountedPrice = req.body.discountedPrice == null || req.body.discountedPrice === ''
      ? null
      : Number(req.body.discountedPrice);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';

    if (!title) return res.status(400).json({ ok: false, error: 'Title is required' });
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ ok: false, error: 'Price must be a valid number' });
    if (discountedPrice != null && (!Number.isFinite(discountedPrice) || discountedPrice < 0)) {
      return res.status(400).json({ ok: false, error: 'Discounted price must be a valid number' });
    }

    const book = await createBook({
      title,
      description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
      imageUrl: typeof req.body.imageUrl === 'string' ? req.body.imageUrl.trim() : '',
      imageAltText: typeof req.body.imageAltText === 'string' ? req.body.imageAltText.trim() : '',
      price,
      discountedPrice,
      currency: typeof req.body.currency === 'string' ? req.body.currency.trim() || 'GBP' : 'GBP',
      stripeUrl: typeof req.body.stripeUrl === 'string' ? req.body.stripeUrl.trim() : '',
      isActive: req.body.isActive !== false,
    });
    return res.status(201).json({ ok: true, data: book });
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
      isActive: typeof req.body.isActive === 'boolean' ? req.body.isActive : undefined,
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
