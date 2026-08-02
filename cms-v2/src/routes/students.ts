import { Router } from 'express';
import { authGuard, requireRole } from '../middleware/authGuard';
import { getStudentDetail, listStudents } from '../models/customer';
import {
  previewExamResultToken,
  sendExamResultEmailForStudent,
  sendExamResultEmailsForCourse,
  submitExamResultFromToken,
  updateExamStatusManual,
} from '../services/examResultService';
import { setStudentNewsletterSubscription } from '../services/newsletterService';
import { syncZenlerStudentsPage } from '../services/zenlerStudentBackfill';

const router = Router();

function parseId(value: unknown): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function csvEscape(value: string | number | boolean | null | undefined): string {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

// ── Public exam-result link endpoints (no auth) ─────────────────────────────

router.get('/exam-result', async (req, res) => {
  try {
    const token = String(req.query.token ?? '').trim();
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });
    const preview = await previewExamResultToken(token);
    return res.json({ ok: true, data: preview });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid exam result link';
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post('/exam-result', async (req, res) => {
  try {
    const token = String(req.body?.token ?? '').trim();
    const status = req.body?.status;
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });

    const result = await submitExamResultFromToken({ token, status });
    return res.json({ ok: true, data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to save exam result';
    return res.status(400).json({ ok: false, error: message });
  }
});

router.use(authGuard);

router.get('/', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim() || undefined;
    const courseId = req.query.courseId != null ? parseId(req.query.courseId) : null;
    if (req.query.courseId != null && !courseId) {
      return res.status(400).json({ ok: false, error: 'Invalid courseId' });
    }

    const newsletterRaw = String(req.query.newsletter ?? 'all');
    const newsletter = (
      ['all', 'subscribed', 'unsubscribed'].includes(newsletterRaw)
        ? newsletterRaw
        : 'all'
    ) as 'all' | 'subscribed' | 'unsubscribed';

    const hasRefund = String(req.query.hasRefund ?? '') === 'true';
    const examStatus = String(req.query.examStatus ?? '').trim() || undefined;

    const students = await listStudents({
      search,
      courseId: courseId ?? undefined,
      newsletter,
      hasRefund: hasRefund || undefined,
      examStatus,
    });
    return res.json({ ok: true, data: students });
  } catch (err) {
    next(err);
  }
});

router.get('/export', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const search = String(req.query.search ?? '').trim() || undefined;
    const students = await listStudents({ search });

    const header = [
      'id',
      'email',
      'first_name',
      'last_name',
      'phone',
      'country_code',
      'zenler_user_id',
      'newsletter_subscribed',
      'source',
      'purchase_count',
      'refund_count',
      'courses',
      'created_at',
      'updated_at',
    ];

    const lines = [
      header.join(','),
      ...students.map((s) => [
        s.id,
        s.email,
        s.firstName,
        s.lastName,
        s.phone,
        s.countryCode,
        s.zenlerUserId,
        s.newsletterSubscribed,
        s.source,
        s.purchaseCount,
        s.refundCount,
        s.courseNames.join('; '),
        s.createdAt instanceof Date ? s.createdAt.toISOString() : s.createdAt,
        s.updatedAt instanceof Date ? s.updatedAt.toISOString() : s.updatedAt,
      ].map(csvEscape).join(',')),
    ];

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="students.csv"');
    return res.send(lines.join('\n'));
  } catch (err) {
    next(err);
  }
});

router.post('/sync-zenler', requireRole('admin'), async (req, res, next) => {
  try {
    const page = Number(req.body?.page ?? 1);
    const pageSize = Number(req.body?.pageSize ?? 50);
    const totals = req.body?.totals && typeof req.body.totals === 'object'
      ? req.body.totals as {
        fetched?: number;
        created?: number;
        updated?: number;
        skipped?: number;
      }
      : undefined;

    const result = await syncZenlerStudentsPage({ page, pageSize, totals });
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.post('/send-exam-emails', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const courseId = parseId(req.body?.courseId);
    if (!courseId) return res.status(400).json({ ok: false, error: 'courseId is required' });
    const result = await sendExamResultEmailsForCourse(courseId);
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ ok: false, error: 'Invalid student id' });

    const student = await getStudentDetail(id);
    if (!student) return res.status(404).json({ ok: false, error: 'Student not found' });
    return res.json({ ok: true, data: student });
  } catch (err) {
    next(err);
  }
});

router.put('/:id/newsletter', requireRole('admin', 'editor'), async (req, res) => {
  try {
    const customerId = parseId(req.params.id);
    if (!customerId) return res.status(400).json({ ok: false, error: 'Invalid student id' });

    const subscribed = Boolean(req.body?.subscribed);
    await setStudentNewsletterSubscription({ customerId, subscribed });
    const student = await getStudentDetail(customerId);
    return res.json({ ok: true, data: student });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update newsletter status';
    return res.status(400).json({ ok: false, error: message });
  }
});

router.put('/:id/courses/:courseId/exam-status', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const customerId = parseId(req.params.id);
    const courseId = parseId(req.params.courseId);
    if (!customerId || !courseId) {
      return res.status(400).json({ ok: false, error: 'Invalid student or course id' });
    }

    await updateExamStatusManual({
      customerId,
      courseId,
      examStatus: req.body?.examStatus,
    });
    const student = await getStudentDetail(customerId);
    return res.json({ ok: true, data: student });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update exam status';
    return res.status(400).json({ ok: false, error: message });
  }
});

router.post('/:id/courses/:courseId/send-exam-email', requireRole('admin', 'editor'), async (req, res, next) => {
  try {
    const customerId = parseId(req.params.id);
    const courseId = parseId(req.params.courseId);
    if (!customerId || !courseId) {
      return res.status(400).json({ ok: false, error: 'Invalid student or course id' });
    }

    const result = await sendExamResultEmailForStudent({ customerId, courseId });
    if (!result.sent) {
      return res.status(400).json({ ok: false, error: result.error || 'Failed to send email', data: result });
    }
    return res.json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
