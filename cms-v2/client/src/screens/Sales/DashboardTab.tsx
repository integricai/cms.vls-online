import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../../api/client';
import type { SalesDashboard, SalesDashboardCard, SalesDashboardPoint, SalesFeeSyncResult } from '../../../../shared/types';
import { formatDisplayDate, formatVaultPrice, londonToday, monthStart, shiftMonth, type DashboardRange } from '../../../../shared/salesFormat';
import { normalizeExamSession, sessionSaleLabel } from '../../../../shared/sessionAccess';

const RANGES: Array<{ id: DashboardRange; label: string }> = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
];

function sittingLabel(month: number | null, year: number | null): string | null {
  const session = normalizeExamSession(month, year);
  return session ? sessionSaleLabel(session.month, session.year) : null;
}

function formatMoney(amount: number, currency: string, compact = false): string {
  const code = currency || 'USD';
  try {
    if (compact && Math.abs(amount) >= 1000) {
      const scaled = new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: code,
        maximumFractionDigits: Math.abs(amount) >= 10000 ? 1 : 2,
      }).format(amount / 1000);
      return `${scaled}K`;
    }
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${code}`;
  }
}

function formatPercent(value: number | null): string | null {
  if (value == null) return null;
  const rounded = Math.round(value * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

function timeAgo(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day)));
}

function SalesChart({ points, currency }: { points: SalesDashboardPoint[]; currency: string }) {
  const width = 640;
  const height = 210;
  const max = Math.max(...points.map(point => point.amount), 1);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : index * step;
    const y = height - 18 - (point.amount / max) * (height - 36);
    return { x, y, ...point };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const area = coords.length
    ? `${line} L${coords[coords.length - 1].x.toFixed(1)},${height} L${coords[0].x.toFixed(1)},${height} Z`
    : '';
  const ticks = [0, 0.5, 1];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Sales over the selected period">
      {ticks.map(tick => {
        const y = height - 18 - tick * (height - 36);
        return (
          <g key={tick}>
            <line x1="0" x2={width} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
            <text x="0" y={y - 4} fill="#94a3b8" fontSize="11">
              {formatMoney(max * tick, currency, true)}
            </text>
          </g>
        );
      })}
      {area ? <path d={area} fill="rgba(99,102,241,0.18)" /> : null}
      {line ? <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2.5" /> : null}
      {coords.filter((_, index) => points.length <= 8 || index % Math.ceil(points.length / 6) === 0 || index === points.length - 1).map(point => (
        <text key={point.date} x={point.x} y={height - 2} textAnchor="middle" fill="#94a3b8" fontSize="11">
          {formatDay(point.date)}
        </text>
      ))}
    </svg>
  );
}

function Metric({
  label,
  value,
  detail,
  hint,
}: {
  label: string;
  value: string;
  detail?: string | null;
  hint: string;
}) {
  return (
    <div className="border-b border-slate-100 py-4 last:border-b-0" title={hint}>
      <div className="text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
      {detail ? <div className="mt-1 text-xs text-slate-400">{detail}</div> : null}
    </div>
  );
}

function SummaryCard({ card }: { card: SalesDashboardCard }) {
  const change = formatPercent(card.changePercent);
  const positive = (card.changePercent ?? 0) > 0;
  const negative = (card.changePercent ?? 0) < 0;
  return (
    <article className="relative overflow-hidden rounded-2xl bg-indigo-50/80 px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-slate-600">{card.label}</p>
        {change ? (
          <span className={`text-xs font-semibold ${positive ? 'text-emerald-600' : negative ? 'text-rose-600' : 'text-slate-400'}`}>
            {positive ? '▲' : negative ? '▼' : ''} {change}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-indigo-950">
        {formatMoney(card.amount, card.currency, true)}
      </p>
      <p className="mt-1 text-xs text-slate-500">Earnings {formatMoney(card.earnings, card.currency)}</p>
      <p className="mt-3 text-xs text-emerald-700">
        {formatMoney(card.comparisonAmount, card.currency)} {card.comparisonLabel}
      </p>
    </article>
  );
}

export default function DashboardTab() {
  const [range, setRange] = useState<DashboardRange>('this_month');
  const [dashboard, setDashboard] = useState<SalesDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const firstName = getCurrentUser()?.firstName?.trim() || 'there';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get<SalesDashboard>(`/sales/dashboard?range=${encodeURIComponent(range)}`)
      .then(data => {
        if (!cancelled) setDashboard(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the dashboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range, refreshKey]);

  useEffect(() => {
    const today = londonToday();
    const from = monthStart(shiftMonth(monthStart(today), -1));
    let cancelled = false;
    (async () => {
      let remaining = 1;
      let changed = false;
      for (let attempt = 0; attempt < 8 && remaining > 0; attempt += 1) {
        const result = await api.post<SalesFeeSyncResult>('/sales/sync-fees', { from, to: today });
        if (cancelled) return;
        if (result.updated > 0) changed = true;
        remaining = result.updated > 0 ? (result.remaining ?? 0) : 0;
      }
      if (!cancelled && changed) setRefreshKey(key => key + 1);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const leadRate = dashboard?.leadConversionPercent;
  const enrolmentRate = dashboard?.enrollmentConversionPercent;

  return (
    <div className="h-full overflow-auto bg-slate-50">
      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Welcome back, {firstName}.</h1>
        {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading && !dashboard ? <p className="text-sm text-slate-500">Loading dashboard…</p> : null}
        {dashboard ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {dashboard.cards.map(card => <SummaryCard key={card.id} card={card} />)}
            </div>
            {dashboard.otherCurrencies.length > 0 ? (
              <p className="text-xs text-slate-500">
                Totals are in {dashboard.currency}. This period also has sales in {dashboard.otherCurrencies.join(', ')}.
              </p>
            ) : null}
            <div className="flex items-center justify-end">
              <label className="text-xs font-semibold text-slate-500">
                Overview
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
            <div className="grid gap-3 xl:grid-cols-[220px_minmax(0,1fr)_280px]">
              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Overview</h2>
                <Metric
                  label="Visitors"
                  value={dashboard.visitors.toLocaleString('en-GB')}
                  hint="Unique visitors on vls-online.com during the selected period."
                />
                <Metric
                  label="Leads"
                  value={dashboard.leads.toLocaleString('en-GB')}
                  detail={leadRate == null ? null : `${leadRate}% lead conversion`}
                  hint="Enquiry form submissions and Zenler funnel leads during the selected period."
                />
                <Metric
                  label="Course enrolments"
                  value={dashboard.enrollments.toLocaleString('en-GB')}
                  detail={enrolmentRate == null ? null : `${enrolmentRate}% enrolment conversion`}
                  hint="Paid course sales during the selected period. Refunds are not included."
                />
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="mb-3 text-sm font-semibold text-slate-800">Sales</h2>
                <div className="grid gap-3 lg:grid-cols-[160px_minmax(0,1fr)]">
                  <div className="rounded-xl bg-slate-950 px-4 py-4 text-white">
                    <p className="text-2xl font-semibold">{formatMoney(dashboard.totalSales, dashboard.currency, true)}</p>
                    <p className="text-xs text-slate-300">Total sales</p>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-indigo-200">One-time</dt>
                        <dd>{formatMoney(dashboard.oneTime, dashboard.currency, true)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-amber-200">Subscriptions</dt>
                        <dd>{formatMoney(dashboard.subscriptions, dashboard.currency, true)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-emerald-200">Others</dt>
                        <dd>{formatMoney(dashboard.others, dashboard.currency, true)}</dd>
                      </div>
                    </dl>
                  </div>
                  <SalesChart points={dashboard.series} currency={dashboard.currency} />
                </div>
              </section>

              <aside className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-slate-800">Live stream</h2>
                <ul className="mt-3 space-y-3">
                  {dashboard.activity.length === 0 ? (
                    <li className="text-sm text-slate-500">No enrolments yet.</li>
                  ) : dashboard.activity.map(item => {
                    const sitting = sittingLabel(item.sessionMonth, item.sessionYear);
                    return (
                    <li key={item.id} className="flex gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">
                        {item.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold">{item.name}</span>
                          {' '}enrolled in {item.courseName}
                          {sitting ? ` (${sitting})` : ''}
                        </p>
                        <p className="text-xs text-slate-400">{timeAgo(item.soldAt)}</p>
                      </div>
                    </li>
                    );
                  })}
                </ul>
              </aside>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Recent orders</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs text-slate-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Customer</th>
                      <th className="px-4 py-2 font-medium">Date</th>
                      <th className="px-4 py-2 font-medium">Type</th>
                      <th className="px-4 py-2 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.recentOrders.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-500">No orders yet.</td></tr>
                    ) : dashboard.recentOrders.map(order => (
                      <tr key={order.id} className="border-t border-slate-100">
                        <td className="px-4 py-2">{order.courseName}</td>
                        <td className="px-4 py-2">{order.customerName}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatDisplayDate(order.soldAt)}</td>
                        <td className="px-4 py-2">{order.type === 'Refunded' ? 'Refunded' : (sittingLabel(order.sessionMonth, order.sessionYear) ?? order.type)}</td>
                        <td className="px-4 py-2 whitespace-nowrap">{formatVaultPrice(order)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
