import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { PathOutcome, PathReport, PathSessionRow } from '../../../../shared/pathScore';

const OUTCOMES: Array<{ id: PathOutcome; label: string }> = [
  { id: 'all', label: 'All sessions' },
  { id: 'paid', label: 'Paid' },
  { id: 'dropped', label: 'Left without buying' },
];

const whenFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/London',
});

const countryNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return whenFormat.format(date);
}

function countryLabel(code: string | null): string {
  if (!code) return 'Unknown';
  try {
    return countryNames?.of(code) || code;
  } catch {
    return code;
  }
}

function scoreTone(score: number): string {
  if (score >= 80) return 'bg-emerald-50 text-emerald-800';
  if (score >= 50) return 'bg-amber-50 text-amber-800';
  return 'bg-rose-50 text-rose-800';
}

function SessionPath({ row }: { row: PathSessionRow }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {row.pages.map((page, index) => {
        const last = index === row.pages.length - 1;
        const droppedHere = !row.converted && last;
        const paidHere = row.converted && last;
        return (
          <li key={`${page.path}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-slate-300" aria-hidden="true">→</span> : null}
            <span
              title={page.path}
              className={`max-w-[16rem] truncate rounded-md px-2 py-1 text-xs ${
                paidHere
                  ? 'bg-emerald-100 font-medium text-emerald-900'
                  : droppedHere
                    ? 'bg-rose-100 font-medium text-rose-900'
                    : 'bg-slate-100 text-slate-700'
              }`}
            >
              {page.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export default function PathTab({ query }: { query: string | null }) {
  const [outcome, setOutcome] = useState<PathOutcome>('all');
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<PathReport | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [query, outcome]);

  useEffect(() => {
    if (!query) {
      setReport(null);
      setError('');
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get<PathReport>(`${query}&outcome=${outcome}&page=${page}`)
      .then(data => {
        if (!cancelled) setReport(data);
      })
      .catch(err => {
        if (!cancelled) {
          setReport(null);
          setError(err instanceof Error ? err.message : 'Could not load paths');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query, outcome, page]);

  if (!query) return null;
  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!report) return <p className="text-sm text-slate-500">Loading paths…</p>;

  const pageCount = Math.max(1, Math.ceil(report.total / report.pageSize));
  const from = report.total === 0 ? 0 : (report.page - 1) * report.pageSize + 1;
  const to = Math.min(report.total, report.page * report.pageSize);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary value={report.sessions} label="Sessions" hint="One browser visit, from the first page to the last." />
        <Summary value={report.paid} label="Paid" hint="Opened the payment success page." />
        <Summary value={report.dropped} label="Left without buying" hint="The session ended before payment success." />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Page score</h2>
        <p className="mt-1 text-xs text-slate-500">
          Score is how often a session does not end on that page. 100 means nobody left there without reaching payment success.
          Left here is the number of sessions that stopped on the page.
        </p>
        {report.scores.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No page visits in this period yet. Paths start from the day each session is stored.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-2 font-medium">Page</th>
                  <th className="pb-2 text-right font-medium">Sessions</th>
                  <th className="pb-2 text-right font-medium">Left here</th>
                  <th className="pb-2 text-right font-medium">Drop-off</th>
                  <th className="pb-2 text-right font-medium">Paid after this page</th>
                  <th className="pb-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {report.scores.map(row => (
                  <tr key={row.path} className="border-t border-slate-100">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-800">{row.label}</p>
                      {row.label !== row.path ? <p className="text-xs text-slate-400">{row.path}</p> : null}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{row.sessions.toLocaleString('en-GB')}</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{row.dropoffs.toLocaleString('en-GB')}</td>
                    <td className="py-2 text-right tabular-nums text-slate-700">
                      {row.sessions === 0 ? '0%' : `${Math.round((row.dropoffs / row.sessions) * 100)}%`}
                    </td>
                    <td className="py-2 text-right tabular-nums text-slate-700">{row.conversions.toLocaleString('en-GB')}</td>
                    <td className="py-2 text-right">
                      <span className={`inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums ${scoreTone(row.score)}`}>
                        {row.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">Sessions</h2>
          <div className="flex flex-wrap gap-1">
            {OUTCOMES.map(option => (
              <button
                key={option.id}
                type="button"
                className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                  outcome === option.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setOutcome(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        {loading && report.rows.length === 0 ? <p className="mt-3 text-sm text-slate-500">Loading sessions…</p> : null}
        {report.rows.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No sessions in this view.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {report.rows.map(row => (
              <li key={row.id} className="py-3">
                <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{formatWhen(row.startedAt)}</span>
                  <span>{row.channel}</span>
                  <span>{countryLabel(row.country)}</span>
                  <span className="capitalize">{row.device}</span>
                  {row.converted ? (
                    <span className="rounded-md bg-emerald-100 px-2 py-0.5 font-medium text-emerald-900">Paid</span>
                  ) : (
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 font-medium text-rose-900">
                      Left on {row.exitLabel || 'the last page'}
                    </span>
                  )}
                </div>
                <SessionPath row={row} />
              </li>
            ))}
          </ul>
        )}
        {report.total > report.pageSize ? (
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
            <span>{from}–{to} of {report.total.toLocaleString('en-GB')}</span>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700 disabled:opacity-40"
                disabled={report.page <= 1 || loading}
                onClick={() => setPage(current => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded-lg bg-slate-100 px-2.5 py-1 font-medium text-slate-700 disabled:opacity-40"
                disabled={report.page >= pageCount || loading}
                onClick={() => setPage(current => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function Summary({ value, label, hint }: { value: number; label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value.toLocaleString('en-GB')}</p>
      <p className="text-sm text-slate-700">{label}</p>
      <p className="text-xs text-slate-400">{hint}</p>
    </div>
  );
}
