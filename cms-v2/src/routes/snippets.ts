import { Router, Request, Response } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  getAllSnippets,
  getSnippetById,
  createSnippet,
  updateSnippet,
  deleteSnippet,
} from '../models/snippet';
import type { SnippetInput } from '../../shared/types';

const router = Router();

// All snippet routes require authentication
router.use(authGuard);

// GET /snippets
router.get('/', async (_req: Request, res: Response) => {
  const snippets = await getAllSnippets();
  return res.json({ ok: true, data: snippets });
});

// GET /snippets/:id
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' });

  const snippet = await getSnippetById(id);
  if (!snippet) return res.status(404).json({ ok: false, error: 'Snippet not found' });

  return res.json({ ok: true, data: snippet });
});

// POST /snippets — editor or admin only
router.post('/', requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  const { key, title, html, meta } = req.body as SnippetInput;

  if (!key || !title || html === undefined) {
    return res.status(400).json({ ok: false, error: 'key, title, and html are required' });
  }

  const snippet = await createSnippet(
    { key, title, html, meta: meta ?? {} },
    req.user!.userId,
  );
  return res.status(201).json({ ok: true, data: snippet });
});

// PATCH /snippets/:id — editor or admin only
router.patch('/:id', requireRole('admin', 'editor'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' });

  const updated = await updateSnippet(id, req.body as Partial<SnippetInput>);
  if (!updated) return res.status(404).json({ ok: false, error: 'Snippet not found' });

  return res.json({ ok: true, data: updated });
});

// DELETE /snippets/:id — admin only
router.delete('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ ok: false, error: 'Invalid id' });

  const deleted = await deleteSnippet(id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Snippet not found' });

  return res.json({ ok: true, data: { message: 'Deleted' } });
});

export default router;
