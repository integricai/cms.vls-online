import { Request, Response, NextFunction } from 'express';
import { enrolFreeQuiz, FreeEnrolError } from '../services/freeEnrol';
import { verifyTurnstileToken } from '../utils/turnstile';

/** Public free-quiz enrolment. Mounted on its own so it does not depend on checkout routes. */
export async function freeEnrolHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const captcha = await verifyTurnstileToken(req.body?.turnstileToken, req);
    if (!captcha.ok) {
      res.status(400).json({ ok: false, error: 'captcha_failed', message: captcha.error });
      return;
    }

    const result = await enrolFreeQuiz({
      zenlerCourseId: String(req.body?.zenlerCourseId ?? req.body?.courseId ?? ''),
      studentEmail: String(req.body?.studentEmail ?? ''),
      studentName: String(req.body?.studentName ?? ''),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof FreeEnrolError) {
      res.status(err.status).json({ ok: false, error: err.code, message: err.message });
      return;
    }
    next(err);
  }
}
