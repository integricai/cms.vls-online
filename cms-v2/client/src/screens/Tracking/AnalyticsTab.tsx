import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import type { AnalyticsReport, Ga4Count, SalesChannel, SalesProduct } from '../../../../shared/ga4Report';

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

const CHANNEL_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#4f46e5', '#ea580c', '#ca8a04'];

function channelColor(index: number): string {
  return CHANNEL_COLORS[index % CHANNEL_COLORS.length];
}

function Glyph({ children, className }: { children: ReactNode; className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function MetricIcon({ id }: { id: 'sessions' | 'engaged' | 'pages' | 'checkout' }) {
  if (id === 'sessions') {
    return (
      <Glyph className="h-5 w-5">
        <circle cx="7.2" cy="7" r="2.15" />
        <circle cx="13.1" cy="7.7" r="1.65" />
        <path d="M3.4 15.6v-.35a3.35 3.35 0 0 1 3.35-3.35h1.2a3.35 3.35 0 0 1 3.05 2" />
        <path d="M12.1 12.3a2.7 2.7 0 0 1 2.7 2.55v.75" />
      </Glyph>
    );
  }
  if (id === 'engaged') {
    return (
      <Glyph className="h-5 w-5">
        <path d="M2.8 10h2.4l1.6-3.2 2.3 6.4 1.7-3.2h6.4" />
      </Glyph>
    );
  }
  if (id === 'pages') {
    return (
      <Glyph className="h-5 w-5">
        <path d="M5 3.2h7.2L16.2 7v9.8H5z" />
        <path d="M12 3.4V7h3.8M7.2 10.2h5.6M7.2 13.2h4.2" />
      </Glyph>
    );
  }
  return (
    <Glyph className="h-5 w-5">
      <path d="M3.4 5.2h1.6l1.5 7.2h8.2l1.4-4.6H6.2" />
      <circle cx="8.2" cy="15.4" r="1.1" />
      <circle cx="13.6" cy="15.4" r="1.1" />
    </Glyph>
  );
}

function Stat({
  value,
  label,
  hint,
  icon,
  tint,
}: {
  value: string;
  label: string;
  hint?: string;
  icon?: 'sessions' | 'engaged' | 'pages' | 'checkout';
  tint?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      {icon ? (
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint ?? ''}`}>
          <MetricIcon id={icon} />
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
        <p className="text-sm text-slate-600">{label}</p>
        {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day)));
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const PLOT_LEFT = 52;
const PLOT_RIGHT = 16;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 28;

function chartMax(peak: number): { max: number; ticks: number[] } {
  if (peak <= 4) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = peak / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 2.5, 5, 10].find(item => item * power >= rough) ?? 10) * power;
  const max = Math.ceil(peak / step) * step;
  const count = Math.round(max / step);
  return { max, ticks: Array.from({ length: count + 1 }, (_, index) => Math.round(index * step * 1000) / 1000) };
}

function ChannelChart({ days, channels }: { days: AnalyticsReport['traffic']['channelDays']; channels: Ga4Count[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const series = channels.map((channel, index) => ({
    label: channel.label,
    color: channelColor(index),
    values: days.map(day => day.channels[channel.label] ?? 0),
  }));
  const visible = series.filter(item => !hidden.has(item.label));
  const peak = visible.length === 0 ? 0 : Math.max(0, ...visible.flatMap(item => item.values));
  const axis = chartMax(peak);
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const xAt = (index: number) => (
    days.length <= 1 ? PLOT_LEFT + plotWidth / 2 : PLOT_LEFT + (index * plotWidth) / (days.length - 1)
  );
  const yAt = (value: number) => PLOT_TOP + plotHeight - (value / axis.max) * plotHeight;
  const active = activeIndex === null ? null : days[activeIndex] ?? null;
  const showDots = days.length <= 31;

  if (days.length === 0 || channels.length === 0) return <p className="text-sm text-slate-400">No channel sessions in this period.</p>;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {series.map(item => {
          const on = !hidden.has(item.label);
          return (
            <label key={item.label} className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-sm ${on ? 'border-slate-200 bg-white text-slate-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
              <input type="checkbox" className="h-3.5 w-3.5 cursor-pointer" style={{ accentColor: item.color }} checked={on} onChange={() => {
                setHidden(current => {
                  const next = new Set(current);
                  if (next.has(item.label)) next.delete(item.label);
                  else next.add(item.label);
                  return next;
                });
                setActiveIndex(null);
              }} />
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? item.color : '#cbd5e1' }} />
              {item.label}
            </label>
          );
        })}
      </div>
      <div className="relative mt-3 w-full" style={{ aspectRatio: `${CHART_WIDTH} / ${CHART_HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-full w-full"
          role="group"
          aria-label="GA4 sessions by channel"
          onPointerMove={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            if (rect.width === 0) return;
            const x = ((event.clientX - rect.left) / rect.width) * CHART_WIDTH;
            let nearest = 0;
            let best = Infinity;
            days.forEach((_, index) => {
              const distance = Math.abs(xAt(index) - x);
              if (distance < best) {
                best = distance;
                nearest = index;
              }
            });
            setActiveIndex(current => current === nearest ? current : nearest);
          }}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {axis.ticks.map(tick => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line x1={PLOT_LEFT} y1={y} x2={CHART_WIDTH - PLOT_RIGHT} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PLOT_LEFT - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="12">{Math.round(tick).toLocaleString('en-GB')}</text>
              </g>
            );
          })}
          {visible.map(item => {
            const line = item.values.map((value, index) => `${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(value).toFixed(1)}`).join(' ');
            return (
              <g key={item.label}>
                {days.length > 1 ? <path d={line} fill="none" stroke={item.color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" /> : null}
                {showDots ? item.values.map((value, index) => (
                  <circle key={`${item.label}-${days[index].date}`} cx={xAt(index)} cy={yAt(value)} r={days.length === 1 ? 5 : 2.5} fill={item.color} />
                )) : null}
              </g>
            );
          })}
          {days.filter((_, index) => days.length <= 8 || index % Math.ceil(days.length / 6) === 0 || index === days.length - 1).map(day => {
            const index = days.indexOf(day);
            const x = xAt(index);
            const anchor = x <= PLOT_LEFT + 1 ? 'start' : x >= PLOT_LEFT + plotWidth - 1 ? 'end' : 'middle';
            return <text key={day.date} x={x} y={CHART_HEIGHT - 8} textAnchor={anchor} fill="#64748b" fontSize="12">{formatDay(day.date)}</text>;
          })}
        </svg>
        {active && activeIndex !== null && visible.length > 0 ? (
          <div className="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg" style={{ left: `${(xAt(activeIndex) / CHART_WIDTH) * 100}%`, top: '12px', transform: 'translateX(-50%)' }}>
            <p className="font-medium">{formatDay(active.date)}</p>
            <ul className="mt-1 space-y-0.5">
              {visible.map(item => (
                <li key={item.label} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />
                    {item.label}
                  </span>
                  <span className="tabular-nums">{(item.values[activeIndex] ?? 0).toLocaleString('en-GB')}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CountTable({ title, rows, valueLabel }: { title: string; rows: Ga4Count[]; valueLabel: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-400">Nothing in this period.</p> : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 text-right font-medium">{valueLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-700">
                  <span className="inline-flex items-center gap-2">
                    {title === 'Channel' ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: channelColor(index) }} /> : null}
                    {row.label}
                  </span>
                </td>
                <td className="py-2 text-right text-slate-900">{row.value.toLocaleString('en-GB')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function MoneyTable({
  title,
  hint,
  rows,
  label,
}: {
  title: string;
  hint: string;
  rows: Array<SalesProduct | SalesChannel>;
  label: (row: SalesProduct | SalesChannel) => ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">{hint}</p>
      {rows.length === 0 ? <p className="mt-3 text-sm text-slate-400">No paid orders in this period.</p> : (
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-400">
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 text-right font-medium">Orders</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const name = 'name' in row ? row.name : row.channel;
              return (
                <tr key={`${name}-${row.currency}`} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-slate-700">{label(row)}</td>
                  <td className="py-2 text-right text-slate-900">{row.orders.toLocaleString('en-GB')}</td>
                  <td className="py-2 text-right font-medium text-slate-900">{formatMoney(row.amount, row.currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

export default function AnalyticsTab({ query }: { query: string | null }) {
  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!query) {
      setReport(null);
      setError('');
      return undefined;
    }
    let cancelled = false;
    setError('');
    api.get<AnalyticsReport>(query)
      .then(data => {
        if (!cancelled) setReport(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load analytics');
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  if (!query) return null;
  if (error) return <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>;
  if (!report) return <p className="text-sm text-slate-500">Loading analytics…</p>;

  const traffic = report.traffic;
  const sales = report.sales;

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Traffic</h2>
        <p className="mt-1 text-xs text-slate-500">
          Sessions and pages from GA4. People who declined analytics cookies are not included.
        </p>
        {!traffic.configured ? (
          <p className="mt-3 text-sm text-slate-600">
            GA4 is not connected yet. Set GA4_PROPERTY_ID, GA4_CLIENT_EMAIL, and GA4_PRIVATE_KEY, then give that service account Viewer access on the property.
          </p>
        ) : null}
        {traffic.error ? (
          <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">{traffic.error}</div>
        ) : null}
        {traffic.configured && !traffic.error ? (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon="sessions" tint="bg-blue-50 text-blue-600" value={traffic.sessions.toLocaleString('en-GB')} label="Sessions" />
              <Stat icon="engaged" tint="bg-green-50 text-green-600" value={traffic.engagedSessions.toLocaleString('en-GB')} label="Engaged sessions" />
              <Stat icon="pages" tint="bg-indigo-50 text-indigo-600" value={traffic.pageViews.toLocaleString('en-GB')} label="Page views" />
              <Stat icon="checkout" tint="bg-orange-50 text-orange-600" value={traffic.checkoutViews.toLocaleString('en-GB')} label="Checkout views" />
            </div>
            <div className="mt-4">
              <ChannelChart days={traffic.channelDays} channels={traffic.channels} />
            </div>
          </>
        ) : null}
      </section>
      {traffic.configured && !traffic.error ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <CountTable title="Channel" rows={traffic.channels} valueLabel="Sessions" />
          <CountTable title="Landing page" rows={traffic.landingPages} valueLabel="Sessions" />
          <CountTable title="Pages viewed" rows={traffic.pages} valueLabel="Views" />
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Sales</h2>
        <p className="mt-1 text-xs text-slate-500">
          Production payments for this period, in London time. Refunds are excluded. Amounts are what was taken, not the GA4 purchase event.
        </p>
        {sales.orders === 0 ? <p className="mt-3 text-sm text-slate-400">No paid orders in this period.</p> : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat value={sales.orders.toLocaleString('en-GB')} label="Paid orders" />
            {sales.totals.map(row => (
              <Stat
                key={row.currency}
                value={formatMoney(row.amount, row.currency)}
                label={`Revenue ${row.currency}`}
                hint={`${row.orders.toLocaleString('en-GB')} orders`}
              />
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <MoneyTable
          title="Product"
          hint="The course or pack named on the payment."
          rows={sales.products}
          label={row => ('name' in row ? row.name : row.channel)}
        />
        <MoneyTable
          title="Sales channel"
          hint="Taken from the campaign data stored on the order when the buyer allowed marketing cookies."
          rows={sales.channels}
          label={row => ('channel' in row ? row.channel : row.name)}
        />
      </div>
    </>
  );
}
