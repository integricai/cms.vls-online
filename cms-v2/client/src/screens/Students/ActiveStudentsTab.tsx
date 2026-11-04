import { useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../../api/client';
import {
  MANUAL_ACCESS_DURATIONS,
  type ActiveEnrollment,
  type ActiveEnrollmentPage,
  type ZenlerRosterSyncResult,
} from '../../../../shared/types';

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
  return `${row.zenlerUserId}:${row.zenlerCourseId}`;
}

function validityEnded(value: Date | string | null | undefined): boolean {
  if (!value) return false;
  const d = value instanceof Date ? value : new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() <= Date.now();
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
  const [syncing, setSyncing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [syncLabel, setSyncLabel] = useState('');
  const [unenrollingKey, setUnenrollingKey] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [durations, setDurations] = useState<Record<string, string>>({});

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
      const items = data.items ?? [];
      setRows(items);
      setDurations((current) => {
        const next = { ...current };
        for (const row of items) {
          const key = rowKey(row);
          if (next[key] == null) next[key] = row.durationDays ? String(row.durationDays) : '';
        }
        return next;
      });
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

  async function syncFromZenler() {
    setSyncing(true);
    setError('');
    setMessage('');
    let courseIndex = 0;
    let kept = 0;
    try {
      for (;;) {
        const result = await api.post<ZenlerRosterSyncResult>('/students/active/sync', { courseIndex });
        kept += result.kept;
        setSyncLabel(
          result.courseName
            ? `${result.courseName} (${result.courseIndex + 1} of ${result.totalCourses})`
            : `Course ${result.courseIndex + 1} of ${result.totalCourses}`,
        );
        if (result.done || result.nextCourseIndex == null) break;
        if (result.nextCourseIndex <= courseIndex) break;
        courseIndex = result.nextCourseIndex;
      }
      setMessage(`Zenler sync finished. ${kept.toLocaleString()} enrolments from 1 Nov 2025 are stored.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sync Zenler enrolments');
    } finally {
      setSyncing(false);
      setSyncLabel('');
    }
  }

  async function downloadExcel() {
    setDownloading(true);
    setError('');
    try {
      const token = getToken();
      const base = (import.meta.env.VITE_API_URL ?? '') + '/api';
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`${base}/students/active/export${suffix}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download the spreadsheet');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'active-students.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download the spreadsheet');
    } finally {
      setDownloading(false);
    }
  }

  async function saveDuration(row: ActiveEnrollment) {
    const key = rowKey(row);
    const durationDays = Number(durations[key]);
    if (!MANUAL_ACCESS_DURATIONS.includes(durationDays as typeof MANUAL_ACCESS_DURATIONS[number])) {
      setError('Choose a duration of 60, 90, 180, or 365 days');
      return;
    }
    setSavingKey(key);
    setError('');
    setMessage('');
    try {
      const saved = await api.post<ActiveEnrollment>('/students/active/duration', {
        zenlerCourseId: row.zenlerCourseId,
        zenlerUserId: row.zenlerUserId,
        durationDays,
      });
      setRows((current) => current.map((item) => (rowKey(item) === key ? { ...item, ...saved } : item)));
      setMessage(`Validity saved for ${studentName(row)}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the validity date');
    } finally {
      setSavingKey(null);
    }
  }

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
        zenlerUserId: row.zenlerUserId,
        email: row.email,
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">Active Students</h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Zenler enrolments from 1 Nov 2025. Set the duration you see in Zenler, then save the validity date.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void downloadExcel()}
              disabled={downloading || syncing || total === 0}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {downloading ? 'Downloading…' : 'Download Excel'}
            </button>
            <button
              type="button"
              onClick={() => void syncFromZenler()}
              disabled={syncing}
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {syncing ? 'Syncing…' : 'Sync from Zenler'}
            </button>
          </div>
        </div>
        {syncLabel && <p className="mt-2 text-xs text-slate-500">Syncing {syncLabel}</p>}
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
              No enrolments yet. Sync from Zenler to load students enrolled on or after 1 Nov 2025.
            </p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Course</th>
                  <th className="px-4 py-3 font-semibold">Enrolled</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Validity</th>
                  <th className="px-4 py-3 font-semibold"> </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = rowKey(row);
                  const busy = unenrollingKey === key;
                  const saving = savingKey === key;
                  const ended = validityEnded(row.expiryDate);
                  return (
                    <tr key={key} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{studentName(row)}</div>
                        <div className="text-xs text-slate-500">{row.email}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.courseName}</td>
                      <td className="px-4 py-3 text-slate-700">{formatDate(row.enrollmentDate)}</td>
                      <td className="px-4 py-3">
                        <select
                          value={durations[key] ?? ''}
                          onChange={(e) => setDurations((current) => ({ ...current, [key]: e.target.value }))}
                          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800"
                        >
                          <option value="">Days</option>
                          {MANUAL_ACCESS_DURATIONS.map((days) => (
                            <option key={days} value={days}>{days} days</option>
                          ))}
                        </select>
                      </td>
                      <td className={`px-4 py-3 ${ended ? 'text-amber-700' : 'text-slate-700'}`}>
                        {formatDate(row.expiryDate)}
                        {ended ? ' · ended' : ''}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void saveDuration(row)}
                            disabled={saving || syncing}
                            className="rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                          >
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void unenrol(row)}
                            disabled={unenrollingKey !== null}
                            className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            {busy ? 'Unenrolling…' : 'Unenrol'}
                          </button>
                        </div>
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
