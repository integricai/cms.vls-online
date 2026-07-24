import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import type { SaleAcceptPreview } from '../../../shared/types';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: Date | string): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AcceptSale() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [preview, setPreview] = useState<SaleAcceptPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('This accept link is missing or invalid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    api.get<SaleAcceptPreview>(`/sales/accept?token=${encodeURIComponent(token)}`)
      .then(data => setPreview(data))
      .catch(err => setError(err instanceof Error ? err.message : 'Unable to load sale invite'))
      .finally(() => setLoading(false));
  }, [token]);

  async function acceptSale() {
    if (!token) return;
    setAccepting(true);
    setError('');
    try {
      await api.post('/sales/accept', { token });
      setSuccess(true);
      setPreview(prev => (prev ? { ...prev, status: 'already_assigned', assignedTutorName: prev.tutorName } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to accept this sale');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">Accept course sale</h1>
        <p className="mt-1 text-sm text-slate-500">
          Confirm that you will teach this student.
        </p>

        {loading && <p className="mt-6 text-sm text-slate-500">Loading invite…</p>}

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            You have accepted this sale. Thank you.
          </div>
        )}

        {!loading && preview && preview.status !== 'invalid' && (
          <div className="mt-6 space-y-2 text-sm text-slate-700">
            <p><span className="text-slate-500">Course:</span> <strong>{preview.courseName || 'Course'}</strong></p>
            <p><span className="text-slate-500">Student:</span> {preview.studentFirstName || 'Student'}</p>
            <p><span className="text-slate-500">Amount:</span> {formatMoney(preview.amount, preview.currency)}</p>
            <p><span className="text-slate-500">Sold on:</span> {formatDate(preview.soldAt)}</p>
            {preview.tutorName && (
              <p><span className="text-slate-500">Invite for:</span> {preview.tutorName}</p>
            )}
          </div>
        )}

        {!loading && preview?.status === 'available' && !success && (
          <button
            className="btn-primary mt-6 w-full"
            disabled={accepting}
            onClick={() => void acceptSale()}
          >
            {accepting ? 'Accepting…' : 'Accept this sale'}
          </button>
        )}

        {!loading && preview?.status === 'already_assigned' && !success && (
          <p className="mt-6 text-sm text-amber-700">
            This sale has already been assigned
            {preview.assignedTutorName ? ` to ${preview.assignedTutorName}` : ''}.
          </p>
        )}

        {!loading && preview?.status === 'expired' && (
          <p className="mt-6 text-sm text-amber-700">
            This invite link has expired. Please contact the admin team.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          <Link to="/login" className="text-blue-600 hover:underline">Admin login</Link>
        </p>
      </div>
    </div>
  );
}
