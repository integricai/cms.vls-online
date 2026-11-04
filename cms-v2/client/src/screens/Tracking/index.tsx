import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import type { DashboardRange } from '../../../../shared/salesFormat';
import type { TrackingCount, TrackingReport, TrackingSourceRow } from '../../../../shared/siteTracking';

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
];

const countryNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function countryLabel(code: string): string {
  if (code === 'Unknown') return code;
  try {
    return countryNames?.of(code) || code;
  } catch {
    return code;
  }
}

function CountryName({ code }: { code: string }) {
  const name = countryLabel(code);
  const flag = code.toLowerCase();
  if (!/^[a-z]{2}$/.test(flag)) return name;
  return (
    <span className="inline-flex items-center gap-2">
      <img
        src={`https://flagcdn.com/w40/${flag}.png`}
        width={20}
        height={15}
        alt=""
        className="h-[15px] w-5 rounded-sm object-cover"
      />
      {name}
    </span>
  );
}

function campaignLabel(value: string): string {
  if (value === 'No campaign' || value === 'No campaign stored') return value;
  let text = value.trim();
  try {
    text = decodeURIComponent(text);
  } catch {
    text = value.trim();
  }
  text = text.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^\d{3,24}$/.test(text)) return `Google campaign ${text}`;
  return text;
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function VisitorsChart({ days }: { days: TrackingReport['days'] }) {
  const width = 640;
  const height = 180;
  const max = Math.max(...days.map(day => day.visitors), 1);
  const step = days.length > 1 ? width / (days.length - 1) : 0;
  const coords = days.map((day, index) => {
    const x = days.length === 1 ? width / 2 : index * step;
    const y = height - 18 - (day.visitors / max) * (height - 36);
    return { x, y, ...day };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Visitors over the selected period">
      {line ? <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2.5" /> : null}
      {coords.filter((_, index) => days.length <= 8 || index % Math.ceil(days.length / 6) === 0 || index === coords.length - 1).map(point => (
        <text key={point.date} x={point.x} y={height - 2} textAnchor="middle" fill="#94a3b8" fontSize="11">
          {formatDay(point.date)}
        </text>
      ))}
    </svg>
  );
}

function CountTable({ title, rows, label }: { title: string; rows: TrackingCount[]; label: (value: string) => ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-400">No visits yet.</p> : (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {rows.map(row => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-700">{label(row.label)}</td>
                <td className="py-2 text-right font-medium text-slate-900">{row.visitors.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SourceTable({ rows }: { rows: TrackingSourceRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">Source</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-400">No source yet.</p> : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Source</th>
              <th className="pb-2 font-medium">Medium</th>
              <th className="pb-2 text-right font-medium">Visitors</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={`${row.source}-${row.medium}`} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-700">{row.source}</td>
                <td className="py-2 pr-3 text-slate-500">{row.medium}</td>
                <td className="py-2 text-right font-medium text-slate-900">{row.visitors.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function Tracking() {
  const [range, setRange] = useState<DashboardRange>('last_30_days');
  const [report, setReport] = useState<TrackingReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api.get<TrackingReport>(`/analytics/tracking?range=${range}`)
      .then(data => {
        if (!cancelled) setReport(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load tracking');
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Tracking</h1>
            <p className="mt-1 text-sm text-slate-500">
              One person a day. Channel, campaign, and landing page come from the address they opened.
            </p>
          </div>
          <label className="text-xs font-semibold text-slate-500">
            Period
            <select
              className="input ml-2 w-auto py-1 text-xs"
              value={range}
              onChange={event => setRange(event.target.value as DashboardRange)}
            >
              {RANGES.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!report && !error ? <p className="text-sm text-slate-500">Loading tracking…</p> : null}
        {report ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-3xl font-semibold tracking-tight text-slate-900">{report.visitors.toLocaleString('en-GB')}</p>
              <p className="text-sm text-slate-500">Visitors from {report.start} to {report.end}</p>
              <div className="mt-4">
                <VisitorsChart days={report.days} />
              </div>
            </section>
            <div className="grid gap-3 lg:grid-cols-2">
              <CountTable title="Channel" rows={report.channels} label={value => value} />
              <CountTable title="Campaign" rows={report.campaigns} label={campaignLabel} />
              <CountTable title="Landing page" rows={report.landingPages} label={value => value} />
              <CountTable title="Country" rows={report.countries} label={code => <CountryName code={code} />} />
              <CountTable title="Device" rows={report.devices} label={value => value} />
              <CountTable title="Language" rows={report.locales} label={value => value === 'ar' ? 'Arabic' : 'English'} />
            </div>
            <SourceTable rows={report.sources} />
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-slate-800">Paid enrolments</h2>
              <p className="mt-1 text-xs text-slate-500">
                Campaign names are saved when the buyer allowed marketing cookies. Enrolments with nothing stored are grouped together.
              </p>
              {report.enrolments.length === 0 ? <p className="mt-3 text-sm text-slate-400">No paid enrolments in this period.</p> : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-2 font-medium">Campaign</th>
                      <th className="pb-2 text-right font-medium">Orders</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.enrolments.map(row => (
                      <tr key={`${row.campaign}-${row.currency}`} className="border-t border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{campaignLabel(row.campaign)}</td>
                        <td className="py-2 text-right text-slate-900">{row.orders.toLocaleString('en-GB')}</td>
                        <td className="py-2 text-right font-medium text-slate-900">{formatMoney(row.amount, row.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
