import { useEffect, useState } from 'react';
import { api } from '../../api/client';

export interface FailedPaymentRow {
  id: number;
  abandonedAt: string;
  courseTitle: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailSentAt: string | null;
  secondEmailSentAt: string | null;
  thirdEmailSentAt: string | null;
  purchased: boolean;
  canResend: boolean;
}

const whenFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return whenFormat.format(date);
}

function text(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed || '—';
}

export default function FailedPaymentsTab({ query }: { query: string | null }) {
  const [rows, setRows] = useState<FailedPaymentRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendingId, setResendingId] = useState<number | null>(null);

  useEffect(() => {
    if (!query) {
      setRows([]);
      setError('');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get<FailedPaymentRow[]>(query)
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) {
          setRows([]);
          setError(err instanceof Error ? err.message : 'Could not load failed payments');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function resend(row: FailedPaymentRow) {
    setResendingId(row.id);
    setError('');
    try {
      const updated = await api.post<FailedPaymentRow>(`/analytics/failed-payments/${row.id}/resend`, {});
      setRows(current => current.map(item => (item.id === updated.id ? updated : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend the email');
    } finally {
      setResendingId(null);
    }
  }

  if (!query) return null;

  return (
    <section className="space-y-3">
      {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {loading ? <p className="text-sm text-slate-500">Loading failed payments…</p> : null}
      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-slate-500">No failed payments in this period.</p>
      ) : null}
      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2">Date</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Email</th>
                <th className="whitespace-nowrap px-3 py-2">First name</th>
                <th className="whitespace-nowrap px-3 py-2">Last name</th>
                <th className="whitespace-nowrap px-3 py-2">Email sent</th>
                <th className="whitespace-nowrap px-3 py-2">2nd email sent</th>
                <th className="whitespace-nowrap px-3 py-2">Third email sent</th>
                <th className="whitespace-nowrap px-3 py-2">Made the purchase</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">{formatWhen(row.abandonedAt)}</td>
                  <td className="px-3 py-2 text-slate-800">{text(row.courseTitle)}</td>
                  <td className="px-3 py-2 text-slate-700">{row.email}</td>
                  <td className="px-3 py-2 text-slate-700">{text(row.firstName)}</td>
                  <td className="px-3 py-2 text-slate-700">{text(row.lastName)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatWhen(row.emailSentAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatWhen(row.secondEmailSentAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatWhen(row.thirdEmailSentAt)}</td>
                  <td className={`px-3 py-2 font-medium ${row.purchased ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {row.purchased ? 'Yes' : 'No'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={!row.canResend || resendingId === row.id}
                      onClick={() => void resend(row)}
                      className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {resendingId === row.id ? 'Sending…' : 'Resend email'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
