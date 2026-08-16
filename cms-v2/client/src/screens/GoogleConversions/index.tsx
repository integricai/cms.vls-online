import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type {
  CheckoutEnvironment,
  ConversionUploadStatus,
  GoogleConversionListItem,
  GoogleConversionListPage,
  GoogleConversionUploadResult,
} from '../../../../shared/types';

const STATUS_OPTIONS: Array<{ value: 'all' | ConversionUploadStatus; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending_upload', label: 'Pending upload' },
  { value: 'uploaded', label: 'Uploaded' },
  { value: 'extended_upload', label: 'Extended upload' },
  { value: 'failed', label: 'Failed' },
];

const ENVIRONMENT_OPTIONS: Array<{ value: 'all' | CheckoutEnvironment; label: string }> = [
  { value: 'all', label: 'All environments' },
  { value: 'staging', label: 'Staging' },
  { value: 'production', label: 'Production' },
];

const ENVIRONMENT_STYLES: Record<CheckoutEnvironment, string> = {
  staging: 'bg-violet-50 text-violet-800',
  production: 'bg-slate-100 text-slate-800',
};

const STATUS_STYLES: Record<ConversionUploadStatus, string> = {
  pending_upload: 'bg-amber-50 text-amber-800',
  uploaded: 'bg-emerald-50 text-emerald-800',
  extended_upload: 'bg-sky-50 text-sky-800',
  failed: 'bg-rose-50 text-rose-800',
};

function statusLabel(status: ConversionUploadStatus): string {
  return STATUS_OPTIONS.find(option => option.value === status)?.label ?? status;
}

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

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function shorten(value: string | null, size = 14): string {
  if (!value) return '—';
  if (value.length <= size) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function summarizeUpload(result: GoogleConversionUploadResult): string {
  if (!result.configured) return result.message || 'Google Ads is not configured';
  const parts = [
    `${result.uploaded} uploaded`,
    `${result.extendedUpload} extended`,
    `${result.failed} failed`,
  ];
  return result.message ? `${parts.join(', ')}. ${result.message}` : parts.join(', ');
}

export default function GoogleConversions() {
  const [items, setItems] = useState<GoogleConversionListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | ConversionUploadStatus>('all');
  const [environment, setEnvironment] = useState<'all' | CheckoutEnvironment>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [runningDue, setRunningDue] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  async function loadData(nextPage = page) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        pageSize: String(pageSize),
        status,
        environment,
      });
      if (search.trim()) params.set('search', search.trim());
      const data = await api.get<GoogleConversionListPage>(`/google-conversions?${params}`);
      setItems(data.items);
      setTotal(data.total);
      setPage(data.page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversions');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData(1);
  }, [status, environment]);

  async function retryRow(id: number) {
    setRetryingId(id);
    setError('');
    setMessage('');
    try {
      const result = await api.post<GoogleConversionUploadResult>(`/google-conversions/${id}/retry`, {});
      setMessage(`Order #${id}: ${summarizeUpload(result)}`);
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  }

  async function runDueUploads() {
    setRunningDue(true);
    setError('');
    setMessage('');
    try {
      const result = await api.post<GoogleConversionUploadResult>('/google-conversions/run-due', {});
      setMessage(`Due uploads: ${summarizeUpload(result)}`);
      await loadData(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Due upload failed');
    } finally {
      setRunningDue(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Google Conversions</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Paid orders saved for Google Ads upload. Retry ignores the 7-hour delay. Due uploads send production only.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Search
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void loadData(1);
              }}
              placeholder="Email, course, gclid, order id"
              className="w-72 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Environment
            <select
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as typeof environment)}
              className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              {ENVIRONMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void loadData(1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Search
          </button>
          <button
            type="button"
            disabled={runningDue}
            onClick={() => void runDueUploads()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {runningDue ? 'Running…' : 'Run due uploads'}
          </button>
        </div>

        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
          <p>
            Displaying {items.length.toLocaleString()} of {total.toLocaleString()} paid orders
            {loading ? ' — loading…' : ''}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => void loadData(page - 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => void loadData(page + 1)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Order</th>
                <th className="px-3 py-2 font-semibold">Environment</th>
                <th className="px-3 py-2 font-semibold">Paid at</th>
                <th className="px-3 py-2 font-semibold">Student</th>
                <th className="px-3 py-2 font-semibold">Phone</th>
                <th className="px-3 py-2 font-semibold">Course</th>
                <th className="px-3 py-2 font-semibold">Amount</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">gclid</th>
                <th className="px-3 py-2 font-semibold">UTMs</th>
                <th className="px-3 py-2 font-semibold">Uploaded at</th>
                <th className="px-3 py-2 font-semibold">Error</th>
                <th className="px-3 py-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && !loading ? (
                <tr>
                  <td colSpan={13} className="px-3 py-8 text-center text-slate-500">
                    No paid conversion rows found.
                  </td>
                </tr>
              ) : items.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium text-slate-800">#{row.id}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${ENVIRONMENT_STYLES[row.checkoutEnvironment]}`}>
                      {row.checkoutEnvironment}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(row.paidAt)}</td>
                  <td className="px-3 py-2 text-slate-700">
                    <div>{row.studentName || '—'}</div>
                    <div className="text-xs text-slate-500" title={row.studentEmail ?? undefined}>
                      {row.studentEmail || '—'}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-slate-600">{row.studentPhone || '—'}</td>
                  <td className="max-w-[220px] px-3 py-2 text-slate-700">{row.courseTitle}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {formatMoney(row.amount, row.currency)}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[row.conversionUploadStatus]}`}>
                      {statusLabel(row.conversionUploadStatus)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div title={row.gclid ?? undefined}>gclid: {shorten(row.gclid)}</div>
                    <div title={row.gbraid ?? undefined}>gbraid: {shorten(row.gbraid)}</div>
                    <div title={row.wbraid ?? undefined}>wbraid: {shorten(row.wbraid)}</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-600">
                    <div>{row.utmSource || '—'}</div>
                    <div>{[row.utmMedium, row.utmCampaign].filter(Boolean).join(' / ') || '—'}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatDate(row.conversionUploadedAt)}</td>
                  <td className="max-w-[220px] px-3 py-2 text-xs text-rose-600" title={row.conversionUploadError ?? undefined}>
                    {row.conversionUploadError || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={retryingId === row.id}
                      onClick={() => void retryRow(row.id)}
                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {retryingId === row.id ? 'Retrying…' : 'Retry'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
