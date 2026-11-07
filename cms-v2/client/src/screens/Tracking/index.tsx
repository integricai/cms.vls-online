import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../api/client';
import {
  trackingCustomBounds,
  type TrackingCount,
  type TrackingRange,
  type TrackingReport,
  type TrackingSourceRow,
} from '../../../../shared/siteTracking';

const RANGES: Array<{ id: TrackingRange; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
  { id: 'custom', label: 'Custom' },
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

const CHART_WIDTH = 800;
const CHART_HEIGHT = 220;
const PLOT_LEFT = 68;
const PLOT_RIGHT = 18;
const PLOT_TOP = 16;
const PLOT_BOTTOM = 30;

function chartAxis(peak: number): { max: number; ticks: number[] } {
  if (peak <= 4) return { max: 4, ticks: [0, 1, 2, 3, 4] };
  const rough = peak / 4;
  const power = 10 ** Math.floor(Math.log10(rough));
  const fraction = rough / power;
  const nice = fraction <= 1.5 ? 1 : fraction <= 3 ? 2 : fraction <= 7 ? 5 : 10;
  const step = nice * power;
  const max = Math.ceil(peak / step) * step;
  const count = Math.round(max / step);
  return {
    max,
    ticks: Array.from({ length: count + 1 }, (_, index) => Math.round(index * step * 1000) / 1000),
  };
}

function formatAxis(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-GB')
    : value.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

function VisitorsChart({ days }: { days: TrackingReport['days'] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  useEffect(() => setActiveIndex(null), [days]);
  const peak = Math.max(0, ...days.map(day => day.visitors));
  const axis = chartAxis(peak);
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const coords = days.map((day, index) => {
    const x = days.length === 1 ? PLOT_LEFT + plotWidth / 2 : PLOT_LEFT + (index * plotWidth) / (days.length - 1);
    const y = PLOT_TOP + plotHeight - (day.visitors / axis.max) * plotHeight;
    return { x, y, ...day };
  });
  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const active = activeIndex === null ? null : coords[activeIndex] ?? null;
  const showDots = days.length <= 31;

  function nearestIndex(clientX: number, clientY: number, svg: SVGSVGElement): number | null {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CHART_HEIGHT;
    if (x < PLOT_LEFT - 8 || x > CHART_WIDTH - PLOT_RIGHT + 8 || y < PLOT_TOP - 12 || y > CHART_HEIGHT - 4) return null;
    let nearest = 0;
    let best = Infinity;
    coords.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  }

  if (days.length === 0) return <p className="text-sm text-slate-400">No visits yet.</p>;

  const tooltipAlign = !active ? 'center' : active.x < PLOT_LEFT + 80 ? 'left' : active.x > CHART_WIDTH - PLOT_RIGHT - 80 ? 'right' : 'center';
  const tooltipAbove = !active || active.y > 56;

  return (
    <div className="relative w-full" style={{ aspectRatio: `${CHART_WIDTH} / ${CHART_HEIGHT}` }}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="h-full w-full"
        role="group"
        aria-label="Visitors over the selected period"
        onPointerMove={event => {
          const nearest = nearestIndex(event.clientX, event.clientY, event.currentTarget);
          setActiveIndex(current => current === nearest ? current : nearest);
        }}
        onPointerLeave={() => setActiveIndex(null)}
      >
        {axis.ticks.map(tick => {
          const y = PLOT_TOP + plotHeight - (tick / axis.max) * plotHeight;
          return (
            <g key={tick}>
              <line x1={PLOT_LEFT} y1={y} x2={CHART_WIDTH - PLOT_RIGHT} y2={y} stroke="#e2e8f0" strokeWidth="1" />
              <text x={PLOT_LEFT - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="12">
                {formatAxis(tick)}
              </text>
            </g>
          );
        })}
        {coords.length > 1 ? (
          <path d={line} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        ) : null}
        {showDots ? coords.map(point => (
          <circle key={point.date} cx={point.x} cy={point.y} r={coords.length === 1 ? 5 : 3} fill="#4f46e5" />
        )) : null}
        {active ? (
          <g>
            <line x1={active.x} y1={PLOT_TOP} x2={active.x} y2={PLOT_TOP + plotHeight} stroke="#c7d2fe" strokeWidth="1" />
            <circle cx={active.x} cy={active.y} r="5.5" fill="#ffffff" stroke="#4f46e5" strokeWidth="2.5" />
          </g>
        ) : null}
        {coords.filter((_, index) => days.length <= 8 || index % Math.ceil(days.length / 6) === 0 || index === coords.length - 1).map(point => {
          const anchor = point.x <= PLOT_LEFT + 1 ? 'start' : point.x >= PLOT_LEFT + plotWidth - 1 ? 'end' : 'middle';
          return (
            <text key={point.date} x={point.x} y={CHART_HEIGHT - 8} textAnchor={anchor} fill="#64748b" fontSize="12">
              {formatDay(point.date)}
            </text>
          );
        })}
      </svg>
      {active ? (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
          style={{
            left: `${(active.x / CHART_WIDTH) * 100}%`,
            top: `${(active.y / CHART_HEIGHT) * 100}%`,
            transform: `${tooltipAlign === 'left' ? 'translate(0, 0)' : tooltipAlign === 'right' ? 'translate(-100%, 0)' : 'translate(-50%, 0)'} ${tooltipAbove ? 'translateY(calc(-100% - 12px))' : 'translateY(12px)'}`,
          }}
        >
          <p className="font-medium">{formatDay(active.date)}</p>
          <p className="tabular-nums text-slate-200">{active.visitors.toLocaleString('en-GB')}</p>
        </div>
      ) : null}
    </div>
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
  const [range, setRange] = useState<TrackingRange>('this_month');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [report, setReport] = useState<TrackingReport | null>(null);
  const [error, setError] = useState('');
  const customBounds = range === 'custom' ? trackingCustomBounds(start, end) : null;
  const query = range === 'custom'
    ? (customBounds ? `/analytics/tracking?range=custom&start=${customBounds.start}&end=${customBounds.end}` : null)
    : `/analytics/tracking?range=${range}`;

  useEffect(() => {
    if (!query) {
      setReport(null);
      setError(start && end ? 'Choose a start date and an end date within one year.' : '');
      return undefined;
    }
    let cancelled = false;
    setError('');
    api.get<TrackingReport>(query)
      .then(data => {
        if (!cancelled) setReport(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load tracking');
      });
    return () => {
      cancelled = true;
    };
  }, [query, start, end]);

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
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-semibold text-slate-500">
              Period
              <select
                className="input mt-1 w-auto py-1 text-xs"
                value={range}
                onChange={event => setRange(event.target.value as TrackingRange)}
              >
                {RANGES.map(option => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
            </label>
            {range === 'custom' ? (
              <>
                <label className="text-xs font-semibold text-slate-500">
                  Start date
                  <input
                    type="date"
                    className="input mt-1 w-auto py-1 text-xs"
                    value={start}
                    max={end || undefined}
                    onChange={event => setStart(event.target.value)}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-500">
                  End date
                  <input
                    type="date"
                    className="input mt-1 w-auto py-1 text-xs"
                    value={end}
                    min={start || undefined}
                    onChange={event => setEnd(event.target.value)}
                  />
                </label>
              </>
            ) : null}
          </div>
        </div>
        {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {!report && !error && query ? <p className="text-sm text-slate-500">Loading tracking…</p> : null}
        {range === 'custom' && !customBounds && !error ? <p className="text-sm text-slate-500">Choose a start date and an end date.</p> : null}
        {report ? (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap gap-x-10 gap-y-4">
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">{report.visitors.toLocaleString('en-GB')}</p>
                  <p className="text-sm text-slate-500">Visitors from {report.start} to {report.end}</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">{report.uniqueVisits.toLocaleString('en-GB')}</p>
                  <p className="text-sm text-slate-500">Unique visits</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold tracking-tight text-slate-900">{report.returningVisits.toLocaleString('en-GB')}</p>
                  <p className="text-sm text-slate-500">Returning visits</p>
                </div>
              </div>
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
