import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import type { TutorInput } from '../../shared/types';
import {
  createTutor,
  deactivateTutor,
  deleteTutor,
  getTutorById,
  listTutors,
  updateTutor,
} from '../models/tutor';

const router = Router();

router.use(authGuard);

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseCourseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => Number(v)).filter(id => Number.isInteger(id) && id > 0))];
}

function parseBody(body: Record<string, unknown>): TutorInput {
  return {
    name: String(body.name ?? '').trim(),
    email: body.email == null || body.email === '' ? null : String(body.email).trim(),
    role: body.role == null || body.role === '' ? null : String(body.role).trim(),
    bio: body.bio == null || body.bio === '' ? null : String(body.bio).trim(),
    photoUrl: body.photoUrl == null || body.photoUrl === '' ? null : String(body.photoUrl).trim(),
    initials: body.initials == null || body.initials === '' ? null : String(body.initials).trim(),
    isActive: body.isActive !== false && body.isActive !== 'false',
    courseIds: parseCourseIds(body.courseIds),
  };
}

router.get('/', requireRole('admin', 'editor'), async (_req, res, next) => {
  try {
    return res.json({ ok: true, data: await listTutors() });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid tutor id' });
    const tutor = await getTutorById(id);
    if (!tutor) return res.status(404).json({ ok: false, error: 'Tutor not found' });
    return res.json({ ok: true, data: tutor });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const input = parseBody(req.body ?? {});
    if (!input.name) return res.status(400).json({ ok: false, error: 'Tutor name is required' });
    const tutor = await createTutor(input);
    return res.status(201).json({ ok: true, data: tutor });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid tutor id' });
    const input = parseBody(req.body ?? {});
    if (input.name === '') return res.status(400).json({ ok: false, error: 'Tutor name is required' });
    const tutor = await updateTutor(id, input);
    if (!tutor) return res.status(404).json({ ok: false, error: 'Tutor not found' });
    return res.json({ ok: true, data: tutor });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/deactivate', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid tutor id' });
    const tutor = await deactivateTutor(id);
    if (!tutor) return res.status(404).json({ ok: false, error: 'Tutor not found' });
    return res.json({ ok: true, data: tutor });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid tutor id' });
    const deleted = await deleteTutor(id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Tutor not found' });
    return res.json({ ok: true, data: { deleted: true } });
  } catch (err) {
    next(err);
  }
});

export default router;
