import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { ActiveEnrollment, ActiveEnrollmentPage } from '../../../../shared/types';

const PAGE_SIZE = 100;

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function studentName(row: Pick<ActiveEnrollment, 'firstName' | 'lastName' | 'email'>): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return name || row.email;
}

function rowKey(row: ActiveEnrollment): string {
  return `${row.saleId}:${row.zenlerCourseId}`;
}

export default function ActiveStudentsTab() {
  const [rows, setRows] = useState<ActiveEnrollment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [unenrollingKey, setUnenrollingKey] = useState<string | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    if (search.trim()) params.set('search', search.trim());
    return `?${params.toString()}`;
  }, [page, search]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<ActiveEnrollmentPage>(`/students/active${query}`);
      setRows(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      if (data.page && data.page !== page) setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load active students');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [query]);

  async function unenrol(row: ActiveEnrollment) {
    const name = studentName(row);
    const confirmed = window.confirm(
      `Unenrol ${name} from ${row.courseName}?\n\nThis removes school access for that course only. The payment is not refunded.`,
    );
    if (!confirmed) return;

    const key = rowKey(row);
    setUnenrollingKey(key);
    setError('');
    setMessage('');
    try {
      const result = await api.post<{ message: string }>('/students/active/unenroll', {
        saleId: row.saleId,
        zenlerCourseId: row.zenlerCourseId,
      });
      setMessage(result.message || `${name} was unenrolled from ${row.courseName}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not unenrol this course');
    } finally {
      setUnenrollingKey(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Active Students</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Paid enrolments that still have school access and a validity date in the future.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        <div className="mb-4">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Search
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Name, email, or course"
              className="w-72 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
        </div>

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p>
            Displaying {rows.length.toLocaleString()} of {total.toLocaleString()}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <p className="px-4 py-6 text-sm text-slate-500">Loading active students…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500">
              No active enrolments match this search.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Validity</th>
                  <th className="px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = rowKey(row);
                  const busy = unenrollingKey === key;
                  return (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{studentName(row)}</div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.courseName}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(row.expiryDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void unenrol(row)}
                          disabled={unenrollingKey !== null}
                          className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? 'Unenrolling…' : 'Unenrol'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
