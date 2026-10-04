import { useEffect, useState } from 'react';
import { api } from '../../api/client';

type LogLevel = 'error' | 'warn' | 'info';

interface SystemLog {
  id: number;
  level: LogLevel;
  area: string;
  explanation: string;
  errorName: string | null;
  errorMessage: string | null;
  errorStack: string | null;
  requestMethod: string | null;
  requestUrl: string | null;
  requestIp: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
}

const LEVEL_STYLES: Record<LogLevel, string> = {
  error: 'bg-red-50 text-red-700',
  warn: 'bg-amber-50 text-amber-700',
  info: 'bg-sky-50 text-sky-700',
};

export default function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [level, setLevel] = useState('');
  const [q, setQ] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '80' });
      if (level) params.set('level', level);
      if (q.trim()) params.set('q', q.trim());
      const data = await api.get<SystemLog[]>(`/system-logs?${params.toString()}`);
      setLogs(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load system logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="mb-1 text-sm font-bold text-slate-700">System logs</h2>
        <p className="text-xs text-slate-500">
          Crashes, API 500s, and failed payment webhooks. Email alerts still go out; this page is the in-CMS record.
        </p>
      </div>

      <form
        className="mb-4 flex flex-wrap items-end gap-3"
        onSubmit={event => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="text-xs font-medium text-slate-600">
          Level
          <select
            className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            value={level}
            onChange={event => setLevel(event.target.value)}
          >
            <option value="">All</option>
            <option value="error">Error</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
          </select>
        </label>
        <label className="min-w-[220px] flex-1 text-xs font-medium text-slate-600">
          Search
          <input
            className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            value={q}
            onChange={event => setQ(event.target.value)}
            placeholder="Area, message, or URL"
          />
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </form>

      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {loading && !logs.length && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-400">Loading logs…</div>
      )}
      {!loading && !error && logs.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No matching system logs yet.
        </div>
      )}

      <div className="space-y-3">
        {logs.map(log => (
          <div key={log.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-1 text-xs font-semibold uppercase ${LEVEL_STYLES[log.level]}`}>
                    {log.level}
                  </span>
                  <span className="text-sm font-semibold text-slate-800">{log.area}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700">{log.explanation}</p>
                {log.errorMessage && <p className="mt-1 text-xs text-slate-500">{log.errorMessage}</p>}
                {(log.requestMethod || log.requestUrl) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {[log.requestMethod, log.requestUrl].filter(Boolean).join(' ')}
                    {log.requestIp ? ` · ${log.requestIp}` : ''}
                  </p>
                )}
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>{new Date(log.createdAt).toLocaleString()}</div>
                <button
                  type="button"
                  className="mt-2 text-blue-600 hover:underline"
                  onClick={() => setOpenId(openId === log.id ? null : log.id)}
                >
                  {openId === log.id ? 'Hide details' : 'Show details'}
                </button>
              </div>
            </div>
            {openId === log.id && (
              <pre className="mt-3 overflow-auto rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">
                {JSON.stringify({
                  errorName: log.errorName,
                  errorMessage: log.errorMessage,
                  errorStack: log.errorStack,
                  extra: log.extra,
                }, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
