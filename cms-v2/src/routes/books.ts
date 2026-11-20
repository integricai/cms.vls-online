import { Router, Request, Response, NextFunction } from 'express';
import { put } from '@vercel/blob';
import { authGuard, requireRole } from '../middleware/authGuard';
import { BookCourseLinkError, createBook, deleteBook, listBooks, reorderBooks, updateBook } from '../models/book';
import { getBppBookDiscountPercent, saveBppBookDiscountPercent } from '../services/bppBookDiscount';
import { getCourseById, listActiveCourses } from '../models/course';
import type { BookRecord } from '../../shared/types';
import {
  BookWorkbookError,
  buildBookTemplate,
  planBookImport,
  readBookWorkbook,
  type BookTemplateCourse,
} from '../services/bookWorkbook';

class BookRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function requestedCourseId(value: unknown): Promise<number | null> {
  if (value == null || value === '') return null;
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw new BookRequestError(400, 'Choose a course from the list.');
  }
  const course = await getCourseById(id);
  if (!course) throw new BookRequestError(400, 'That course is not in the vault.');
  return id;
}

async function coursesForTemplate(books: BookRecord[]): Promise<BookTemplateCourse[]> {
  const active = await listActiveCourses();
  const byId = new Map(active.map(course => [course.id, course]));
  for (const book of books) {
    if (!book.courseId || byId.has(book.courseId)) continue;
    const course = await getCourseById(book.courseId);
    if (course) byId.set(course.id, course);
  }
  return Array.from(byId.values()).map(course => ({
    id: course.id,
    name: course.name,
    isActive: course.isActive,
  }));
}

const router = Router();

router.use(authGuard);

router.get('/discount-percentage', requireRole('admin', 'assistant'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ ok: true, data: { percent: await getBppBookDiscountPercent() } });
  } catch (err) {
    next(err);
  }
});

router.put('/discount-percentage', requireRole('admin', 'assistant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const percent = await saveBppBookDiscountPercent(req.body?.percent, req.user?.userId);
    return res.json({ ok: true, data: { percent } });
  } catch (err) {
    if (err instanceof Error && err.name === 'BppBookDiscountError') {
      return res.status(400).json({ ok: false, error: err.message });
    }
    next(err);
  }
});

router.get('/', requireRole('admin', 'assistant'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ ok: true, data: await listBooks() });
  } catch (err) {
    next(err);
  }
});

router.post('/sync', requireRole('admin', 'assistant'), (_req: Request, res: Response) => {
  return res.status(410).json({
    ok: false,
    error: 'Book sync has been disabled. The books table is the source of truth.',
  });
});

router.post('/upload-image', requireRole('admin', 'assistant'), async (req: Request, res: Response) => {
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

router.post('/reorder', requireRole('admin', 'assistant'), async (req: Request, res: Response, next: NextFunction) => {
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

router.get('/course-options', requireRole('admin', 'assistant'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const courses = await listActiveCourses();
    return res.json({
      ok: true,
      data: courses.map(course => ({ id: course.id, name: course.name })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/template', requireRole('admin', 'assistant'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const books = await listBooks();
    const buffer = await buildBookTemplate(books, await coursesForTemplate(books));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bpp-books-template.xlsx"');
    return res.send(buffer);
  } catch (err) {
    next(err);
  }
});

router.post('/import', requireRole('admin', 'assistant'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fileBase64 = typeof req.body?.fileBase64 === 'string' ? req.body.fileBase64 : '';
    if (!fileBase64.trim()) return res.status(400).json({ ok: false, error: 'Choose an Excel file.' });
    if (fileBase64.length > 8 * 1024 * 1024) {
      return res.status(400).json({ ok: false, error: 'That file is too large.' });
    }

    const rows = await readBookWorkbook(Buffer.from(fileBase64, 'base64'));
    const books = await listBooks();
    const plan = planBookImport(books, await coursesForTemplate(books), rows);
    let created = 0;
    let updated = 0;

    for (const item of plan.creates) {
      try {
        await createBook({ ...item, stripeUrl: '' });
        created += 1;
      } catch (err) {
        plan.errors.push({
          rowNumber: item.rowNumber,
          message: err instanceof BookCourseLinkError ? err.message : 'Could not add this book.',
        });
      }
    }
    for (const item of plan.updates) {
      try {
        await updateBook(item.id, item);
        updated += 1;
      } catch (err) {
        plan.errors.push({
          rowNumber: item.rowNumber,
          message: err instanceof BookCourseLinkError ? err.message : 'Could not update this book.',
        });
      }
    }

    plan.errors.sort((a, b) => a.rowNumber - b.rowNumber);
    return res.json({ ok: true, data: { created, updated, errors: plan.errors } });
  } catch (err) {
    if (err instanceof BookWorkbookError) return res.status(400).json({ ok: false, error: err.message });
    next(err);
  }
});

router.post('/', requireRole('admin', 'assistant'), async (req: Request, res: Response, next: NextFunction) => {
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
      courseId: await requestedCourseId(req.body.courseId),
    });
    return res.status(201).json({ ok: true, data: book });
  } catch (err) {
    if (err instanceof BookRequestError) return res.status(err.status).json({ ok: false, error: err.message });
    if (err instanceof BookCourseLinkError) return res.status(409).json({ ok: false, error: err.message });
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'assistant'), async (req: Request, res: Response, next: NextFunction) => {
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
      courseId: req.body.courseId === undefined ? undefined : await requestedCourseId(req.body.courseId),
    });

    if (!book) return res.status(404).json({ ok: false, error: 'Book not found' });
    return res.json({ ok: true, data: book });
  } catch (err) {
    if (err instanceof BookRequestError) return res.status(err.status).json({ ok: false, error: err.message });
    if (err instanceof BookCourseLinkError) return res.status(409).json({ ok: false, error: err.message });
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
