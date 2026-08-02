import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { ExamResultPreview, ExamResultSubmitResult, ExamStatus } from '../../../shared/types';

function statusLabel(status: ExamStatus | string): string {
  if (status === 'passed') return 'Passed';
  if (status === 'awaiting_result') return 'Awaiting result';
  return status;
}

export default function ExamResult() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const statusParam = searchParams.get('status') ?? '';

  const [preview, setPreview] = useState<ExamResultPreview | null>(null);
  const [result, setResult] = useState<ExamResultSubmitResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('This exam result link is missing or invalid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    api.get<ExamResultPreview>(`/students/exam-result?token=${encodeURIComponent(token)}`)
      .then(async (data) => {
        setPreview(data);
        if (data.expired) {
          setError('This exam result link has expired. Please ask VLS for a new email.');
          return;
        }
        if (data.used) {
          setError('This exam result link has already been used.');
          return;
        }
        if (statusParam === 'passed' || statusParam === 'awaiting_result') {
          setSubmitting(true);
          try {
            const saved = await api.post<ExamResultSubmitResult>('/students/exam-result', {
              token,
              status: statusParam,
            });
            setResult(saved);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to save your exam result');
          } finally {
            setSubmitting(false);
          }
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load exam result link'))
      .finally(() => setLoading(false));
  }, [token, statusParam]);

  async function submit(status: 'passed' | 'awaiting_result') {
    if (!token) return;
    setSubmitting(true);
    setError('');
    try {
      const saved = await api.post<ExamResultSubmitResult>('/students/exam-result', { token, status });
      setResult(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save your exam result');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Exam result update</h1>
        <p className="mt-1 text-sm text-slate-500">
          Tell VLS Online how your exam went.
        </p>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading…</p>}

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Thank you{result.studentName ? `, ${result.studentName}` : ''}. We have recorded
            your status for <strong>{result.courseName || 'your course'}</strong> as{' '}
            <strong>{statusLabel(result.examStatus)}</strong>.
          </div>
        )}

        {!loading && !result && preview && !preview.expired && !preview.used && !statusParam && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-slate-700">
              Course: <strong>{preview.courseName || 'Your course'}</strong>
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit('passed')}
              className="w-full rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
            >
              I have passed
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit('awaiting_result')}
              className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
            >
              Awaiting my result
            </button>
          </div>
        )}

        {submitting && !result && (
          <p className="mt-4 text-sm text-slate-500">Saving your response…</p>
        )}
      </div>
    </div>
  );
}
