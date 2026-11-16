import { Router, Request, Response, NextFunction } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import {
  ExperimentRequestError,
  activateExperiment,
  createExperiment,
  deleteExperiment,
  endExperiment,
  listExperiments,
  listRunningExperiments,
  updateExperiment,
} from '../models/experiment';

const router = Router();

function experimentId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendExperimentError(err: unknown, res: Response, next: NextFunction): void {
  if (err instanceof ExperimentRequestError) {
    res.status(err.status).json({ ok: false, error: err.message });
    return;
  }
  next(err);
}

router.get('/active', async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ ok: true, data: await listRunningExperiments() });
  } catch (err) {
    next(err);
  }
});

router.use(authGuard);

router.get('/', requireRole('admin'), async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, data: await listExperiments() });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ ok: true, data: await createExperiment(req.body) });
  } catch (err) {
    sendExperimentError(err, res, next);
  }
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = experimentId(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: 'Invalid experiment id' });
      return;
    }
    res.json({ ok: true, data: await updateExperiment(id, req.body) });
  } catch (err) {
    sendExperimentError(err, res, next);
  }
});

router.post('/:id/activate', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = experimentId(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: 'Invalid experiment id' });
      return;
    }
    res.json({ ok: true, data: await activateExperiment(id) });
  } catch (err) {
    sendExperimentError(err, res, next);
  }
});

router.post('/:id/end', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = experimentId(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: 'Invalid experiment id' });
      return;
    }
    res.json({ ok: true, data: await endExperiment(id) });
  } catch (err) {
    sendExperimentError(err, res, next);
  }
});

router.delete('/:id', requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = experimentId(req.params.id);
    if (!id) {
      res.status(400).json({ ok: false, error: 'Invalid experiment id' });
      return;
    }
    await deleteExperiment(id);
    res.json({ ok: true, data: { id } });
  } catch (err) {
    sendExperimentError(err, res, next);
  }
});

export default router;
