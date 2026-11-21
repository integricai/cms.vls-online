import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type {
  UrlHealthOverview,
  UrlHealthPing,
  UrlHealthRunResult,
  UrlHealthStatus,
} from '../../../../shared/urlHealth';

const LIGHT: Record<UrlHealthStatus, { dot: string; label: string }> = {
  ok: { dot: 'bg-emerald-500', label: 'OK' },
  broken: { dot: 'bg-rose-600', label: 'Broken' },
  retrying: { dot: 'bg-amber-400', label: 'Checking again' },
  warning: { dot: 'bg-amber-400', label: 'Warning' },
  pending: { dot: 'bg-slate-300', label: 'Not checked yet' },
};

type Filter = 'all' | 'problems' | UrlHealthStatus;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All URLs' },
  { value: 'problems', label: 'Problems only' },
  { value: 'broken', label: 'Broken' },
  { value: 'retrying', label: 'Checking again' },
  { value: 'warning', label: 'Warning' },
  { value: 'ok', label: 'OK' },
];

const REFRESH_MS = 30_000;

function formatTime(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function codeLabel(code: number | null): string {
  if (code == null) return '—';
  return code === 0 ? 'No answer' : String(code);
}

function codeClass(code: number | null): string {
  if (code == null) return 'text-slate-400';
  if (code >= 200 && code < 400) return 'text-emerald-700';
  if (code === 0 || code === 404 || code === 410 || code >= 500) return 'text-rose-700 font-semibold';
  return 'text-amber-700';
}

function PingCell({ ping }: { ping: UrlHealthPing | null }) {
  if (!ping) return <span className="text-slate-300">—</span>;
  return (
    <div className="whitespace-nowrap">
      <span className={codeClass(ping.code)}>{codeLabel(ping.code)}</span>
      <div className="text-xs text-slate-400">{formatTime(ping.at)}</div>
    </div>
  );
}

function shortUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}` || '/';
  } catch {
    return url;
  }
}

export default function HealthCheck() {
  const [data, setData] = useState<UrlHealthOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const next = await api.get<UrlHealthOverview>('/health-check');
      setData(next);
      setError(null);
    } catch (e) {
      setError((e instanceof Error ? e.message : null) || 'Could not load the health check.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  async function runNow() {
    setRunning(true);
    setMessage(null);
    setError(null);
    try {
      const result = await api.post<UrlHealthRunResult>('/health-check/run', {});
      const parts = [`Checked ${result.checked} URL${result.checked === 1 ? '' : 's'}`];
      if (result.sitemapSynced) parts.push(`${result.sitemapUrls} URLs in the sitemap`);
      if (result.removed) parts.push(`${result.removed} removed from the sitemap`);
      parts.push('the cron checks the rest over the next few minutes');
      setMessage(parts.join(' · '));
      if (result.errors.length) setError(result.errors.join(' · '));
      await load();
    } catch (e) {
      setError((e instanceof Error ? e.message : null) || 'The check failed.');
    } finally {
      setRunning(false);
    }
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.rows ?? []).filter(row => {
      if (filter === 'problems' && (row.status === 'ok' || row.status === 'pending')) return false;
      if (filter !== 'all' && filter !== 'problems' && row.status !== filter) return false;
      return !term || row.url.toLowerCase().includes(term);
    });
  }, [data, filter, search]);

  const summary = data?.summary;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Health check</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Every URL in the live sitemap is pinged about once an hour. A 404, 5xx or no answer is pinged again after 1 minute and again a minute later. If all three fail, the URL turns red and one alert email goes out. 401, 403 and 429 show as warnings and do not send an email. The page refreshes every 30 seconds.
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {(['broken', 'retrying', 'warning', 'ok', 'pending'] as UrlHealthStatus[]).map(status => (
            <button
              key={status}
              type="button"
              onClick={() => setFilter(filter === status ? 'all' : status)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                filter === status ? 'border-slate-400 bg-slate-100' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${LIGHT[status].dot}`} />
              <span className="text-slate-600">{LIGHT[status].label}</span>
              <span className="font-semibold text-slate-800">{summary?.[status] ?? 0}</span>
            </button>
          ))}
          <div className="ml-auto text-right text-xs text-slate-500">
            <div>Last run {formatTime(data?.lastRunAt ?? null)}</div>
            <div>Sitemap read {formatTime(data?.sitemapSyncedAt ?? null)}</div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Search
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Part of a URL"
              className="w-72 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-slate-500">
            Show
            <select
              value={filter}
              onChange={event => setFilter(event.target.value as Filter)}
              className="w-44 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800"
            >
              {FILTERS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={running}
            onClick={() => void runNow()}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {running ? 'Checking…' : 'Check all now'}
          </button>
        </div>

        {data?.lastError ? (
          <p className="mb-3 text-sm text-amber-700">Last run: {data.lastError}</p>
        ) : null}
        {error ? <p className="mb-3 text-sm text-rose-600">{error}</p> : null}
        {message ? <p className="mb-3 text-sm text-emerald-700">{message}</p> : null}

        <p className="mb-3 text-sm text-slate-600">
          Showing {rows.length.toLocaleString()} of {(summary?.total ?? 0).toLocaleString()} URLs
          {loading ? ' — loading…' : ''}
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">URL</th>
                <th className="px-3 py-2 font-semibold">Last pinged</th>
                <th className="px-3 py-2 font-semibold">Ping 1</th>
                <th className="px-3 py-2 font-semibold">Ping 2</th>
                <th className="px-3 py-2 font-semibold">Ping 3</th>
                <th className="px-3 py-2 font-semibold">First broken</th>
                <th className="px-3 py-2 font-semibold">Alert sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                    {summary?.total ? 'No URLs match this filter.' : 'No URLs yet. They appear after the first run.'}
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.url} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2 whitespace-nowrap" title={row.lastError ?? undefined}>
                      <span className={`h-3 w-3 rounded-full ${LIGHT[row.status].dot}`} />
                      <span className={codeClass(row.lastStatusCode)}>{codeLabel(row.lastStatusCode)}</span>
                    </span>
                  </td>
                  <td className="max-w-md px-3 py-2">
                    <a href={row.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">
                      {shortUrl(row.url)}
                    </a>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatTime(row.lastCheckedAt)}</td>
                  {row.pings.map((ping, i) => (
                    <td key={i} className="px-3 py-2"><PingCell ping={ping} /></td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2 text-rose-700">{formatTime(row.firstBrokenAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600">{formatTime(row.alertedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
