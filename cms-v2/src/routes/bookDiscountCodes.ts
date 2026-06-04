import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { listBookDiscountCodes, replaceBookDiscountCodes } from '../models/bookDiscountCode';

const router = Router();

router.use(authGuard);

router.get('/', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = req.query.bookId ? Number(req.query.bookId) : undefined;
    if (bookId !== undefined && (!Number.isInteger(bookId) || bookId <= 0)) {
      return res.status(400).json({ ok: false, error: 'Invalid book id' });
    }
    return res.json({ ok: true, data: await listBookDiscountCodes(bookId) });
  } catch (err) {
    next(err);
  }
});

router.put('/:bookId', requireRole('admin', 'editor'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookId = Number(req.params.bookId);
    if (!Number.isInteger(bookId) || bookId <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid book id' });
    }

    const codes = Array.isArray(req.body?.codes) ? req.body.codes : [];
    return res.json({ ok: true, data: await replaceBookDiscountCodes(bookId, codes) });
  } catch (err) {
    next(err);
  }
});

export default router;
