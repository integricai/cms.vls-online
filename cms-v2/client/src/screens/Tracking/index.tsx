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

function formatFullDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(Date.UTC(year, month - 1, day)));
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
const TOTAL_SERIES_ID = 'total';

const SERIES_COLOR: Record<string, string> = {
  [TOTAL_SERIES_ID]: '#4f46e5',
  'Google Ads': '#2563eb',
  Meta: '#0ea5e9',
  Direct: '#334155',
  'Organic search': '#059669',
  'Other campaign': '#d97706',
  Referral: '#7c3aed',
};

function seriesColor(id: string): string {
  return SERIES_COLOR[id] ?? '#64748b';
}

function Glyph({ children, className }: { children: ReactNode; className: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {children}
    </svg>
  );
}

function SeriesIcon({ id, className = 'h-4 w-4' }: { id: string; className?: string }) {
  if (id === TOTAL_SERIES_ID) {
    return (
      <Glyph className={className}>
        <circle cx="7.2" cy="7" r="2.15" />
        <circle cx="13.1" cy="7.7" r="1.65" />
        <path d="M3.4 15.6v-.35a3.35 3.35 0 0 1 3.35-3.35h1.2a3.35 3.35 0 0 1 3.05 2" />
        <path d="M12.1 12.3a2.7 2.7 0 0 1 2.7 2.55v.75" />
      </Glyph>
    );
  }
  if (id === 'unique') {
    return (
      <Glyph className={className}>
        <circle cx="10" cy="6.7" r="2.35" />
        <path d="M5.2 15.8v-.55a3.6 3.6 0 0 1 3.6-3.6h2.4a3.6 3.6 0 0 1 3.6 3.6v.55" />
      </Glyph>
    );
  }
  if (id === 'returning') {
    return (
      <Glyph className={className}>
        <path d="M16.3 9.1A6.3 6.3 0 0 0 4.8 6.5" />
        <path d="M4.3 3.7v3.1h3.1" />
        <path d="M3.7 10.9a6.3 6.3 0 0 0 11.5 2.6" />
        <path d="M15.7 16.3v-3.1h-3.1" />
      </Glyph>
    );
  }
  if (id === 'Google Ads') {
    return (
      <Glyph className={className}>
        <path d="M3.6 8.4h2.3L10 5.2v9.6L5.9 11.6H3.6a.9.9 0 0 1-.9-.9V9.3a.9.9 0 0 1 .9-.9z" />
        <path d="M12.1 7.5a3.2 3.2 0 0 1 0 5" />
        <path d="M13.7 5.6a5.6 5.6 0 0 1 0 8.8" />
      </Glyph>
    );
  }
  if (id === 'Meta') {
    return (
      <Glyph className={className}>
        <path d="M10 10c-1.15-1.55-2.15-2.55-3.35-2.55-1.75 0-3 1.55-3 3.55s1.25 3.55 3 3.55c1.2 0 2.2-1 3.35-2.55 1.15 1.55 2.15 2.55 3.35 2.55 1.75 0 3-1.55 3-3.55s-1.25-3.55-3-3.55c-1.2 0-2.2 1-3.35 2.55z" />
      </Glyph>
    );
  }
  if (id === 'Direct') {
    return (
      <Glyph className={className}>
        <rect x="3" y="3.4" width="9.2" height="13.2" rx="1.4" />
        <path d="M8 10h8" />
        <path d="m13.4 7.6 2.6 2.4-2.6 2.4" />
      </Glyph>
    );
  }
  if (id === 'Organic search') {
    return (
      <Glyph className={className}>
        <circle cx="8.6" cy="8.6" r="4.1" />
        <path d="m11.7 11.7 4.1 4.1" />
      </Glyph>
    );
  }
  if (id === 'Other campaign') {
    return (
      <Glyph className={className}>
        <path d="M8.1 3.5h8.2v8.2L10 18.1 3.4 11.5 8.1 3.5z" />
        <circle cx="13.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </Glyph>
    );
  }
  if (id === 'Referral') {
    return (
      <Glyph className={className}>
        <circle cx="5.4" cy="10" r="1.9" />
        <circle cx="14.5" cy="5.5" r="1.9" />
        <circle cx="14.5" cy="14.5" r="1.9" />
        <path d="m7.1 9.2 5.5-2.7M7.1 10.8l5.5 2.7" />
      </Glyph>
    );
  }
  return (
    <Glyph className={className}>
      <circle cx="10" cy="10" r="3.2" />
    </Glyph>
  );
}

function ChannelLabel({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span style={{ color: seriesColor(name) }}><SeriesIcon id={name} /></span>
      {name}
    </span>
  );
}

type ChartSeries = { id: string; label: string; color: string; values: number[] };

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

function VisitorsChart({ days, series }: { days: TrackingReport['days']; series: ChartSeries[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => setActiveIndex(null), [days]);
  const visible = series.filter(item => !hidden.has(item.id));
  const peak = visible.length === 0 ? 0 : Math.max(0, ...visible.flatMap(item => item.values));
  const axis = chartAxis(peak);
  const plotWidth = CHART_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  const plotHeight = CHART_HEIGHT - PLOT_TOP - PLOT_BOTTOM;
  const xAt = (index: number) => (
    days.length === 1 ? PLOT_LEFT + plotWidth / 2 : PLOT_LEFT + (index * plotWidth) / (days.length - 1)
  );
  const yAt = (value: number) => PLOT_TOP + plotHeight - (value / axis.max) * plotHeight;
  const drawn = visible.map(item => ({
    ...item,
    points: item.values.map((value, index) => ({ x: xAt(index), y: yAt(value), date: days[index].date })),
  }));
  const guide = drawn[0]?.points ?? days.map((day, index) => ({ x: xAt(index), y: yAt(0), date: day.date }));
  const active = activeIndex === null ? null : guide[activeIndex] ?? null;
  const showDots = days.length <= 31;

  function nearestIndex(clientX: number, clientY: number, svg: SVGSVGElement): number | null {
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * CHART_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * CHART_HEIGHT;
    if (x < PLOT_LEFT - 8 || x > CHART_WIDTH - PLOT_RIGHT + 8 || y < PLOT_TOP - 12 || y > CHART_HEIGHT - 4) return null;
    let nearest = 0;
    let best = Infinity;
    guide.forEach((point, index) => {
      const distance = Math.abs(point.x - x);
      if (distance < best) {
        best = distance;
        nearest = index;
      }
    });
    return nearest;
  }

  function toggle(id: string) {
    setHidden(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setActiveIndex(null);
  }

  if (days.length === 0) return <p className="text-sm text-slate-400">No visits yet.</p>;

  const tooltipAlign = !active ? 'center' : active.x < PLOT_LEFT + 110 ? 'left' : active.x > CHART_WIDTH - PLOT_RIGHT - 110 ? 'right' : 'center';
  const tooltipAbove = !active || active.y > 72;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {series.map(item => {
          const on = !hidden.has(item.id);
          return (
            <label
              key={item.id}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1 text-sm transition ${on ? 'border-slate-200 bg-white text-slate-700 shadow-sm' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 cursor-pointer"
                style={{ accentColor: item.color }}
                checked={on}
                onChange={() => toggle(item.id)}
              />
              <span style={{ color: on ? item.color : undefined }}>
                <SeriesIcon id={item.id} />
              </span>
              {item.label}
            </label>
          );
        })}
      </div>
      {visible.length === 0 ? <p className="mt-3 text-sm text-slate-400">Tick a channel to draw its line.</p> : null}
      <div className="relative mt-3 w-full" style={{ aspectRatio: `${CHART_WIDTH} / ${CHART_HEIGHT}` }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          className="h-full w-full"
          role="group"
          aria-label="Visits by channel over the selected period"
          onPointerMove={event => {
            const nearest = nearestIndex(event.clientX, event.clientY, event.currentTarget);
            setActiveIndex(current => current === nearest ? current : nearest);
          }}
          onPointerLeave={() => setActiveIndex(null)}
        >
          {axis.ticks.map(tick => {
            const y = yAt(tick);
            return (
              <g key={tick}>
                <line x1={PLOT_LEFT} y1={y} x2={CHART_WIDTH - PLOT_RIGHT} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={PLOT_LEFT - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize="12">
                  {formatAxis(tick)}
                </text>
              </g>
            );
          })}
          {drawn.map(item => {
            const line = item.points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
            const width = item.id === TOTAL_SERIES_ID ? 2.75 : 2;
            return (
              <g key={item.id}>
                {item.points.length > 1 ? (
                  <path d={line} fill="none" stroke={item.color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round" />
                ) : null}
                {showDots ? item.points.map(point => (
                  <circle key={`${item.id}-${point.date}`} cx={point.x} cy={point.y} r={item.points.length === 1 ? 5 : 2.5} fill={item.color} />
                )) : null}
              </g>
            );
          })}
          {active ? (
            <g>
              <line x1={active.x} y1={PLOT_TOP} x2={active.x} y2={PLOT_TOP + plotHeight} stroke="#c7d2fe" strokeWidth="1" />
              {drawn.map(item => {
                const point = item.points[activeIndex ?? -1];
                if (!point) return null;
                return <circle key={item.id} cx={point.x} cy={point.y} r="4.5" fill="#ffffff" stroke={item.color} strokeWidth="2.25" />;
              })}
            </g>
          ) : null}
          {guide.filter((_, index) => days.length <= 8 || index % Math.ceil(days.length / 6) === 0 || index === guide.length - 1).map(point => {
            const anchor = point.x <= PLOT_LEFT + 1 ? 'start' : point.x >= PLOT_LEFT + plotWidth - 1 ? 'end' : 'middle';
            return (
              <text key={point.date} x={point.x} y={CHART_HEIGHT - 8} textAnchor={anchor} fill="#64748b" fontSize="12">
                {formatDay(point.date)}
              </text>
            );
          })}
        </svg>
        {active && activeIndex !== null && visible.length > 0 ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[10rem] rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
            style={{
              left: `${(active.x / CHART_WIDTH) * 100}%`,
              top: `${(active.y / CHART_HEIGHT) * 100}%`,
              transform: `${tooltipAlign === 'left' ? 'translate(0, 0)' : tooltipAlign === 'right' ? 'translate(-100%, 0)' : 'translate(-50%, 0)'} ${tooltipAbove ? 'translateY(calc(-100% - 12px))' : 'translateY(12px)'}`,
            }}
          >
            <p className="font-medium">{formatDay(active.date)}</p>
            <ul className="mt-1 space-y-0.5">
              {drawn.map(item => (
                <li key={item.id} className="flex items-center justify-between gap-3">
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

function VisitStat({ icon, tint, value, label, hint }: { icon: string; tint: string; value: number; label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
        <SeriesIcon id={icon} className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value.toLocaleString('en-GB')}</p>
        <p className="text-sm text-slate-600">{label}</p>
        {hint ? <p className="text-xs text-slate-400">{hint}</p> : null}
      </div>
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
              <div className="grid gap-3 sm:grid-cols-3">
                <VisitStat
                  icon={TOTAL_SERIES_ID}
                  tint="bg-indigo-50 text-indigo-600"
                  value={report.visitors}
                  label="Total visits"
                  hint={`${formatFullDay(report.start)} – ${formatFullDay(report.end)}`}
                />
                <VisitStat
                  icon="unique"
                  tint="bg-sky-50 text-sky-600"
                  value={report.uniqueVisits}
                  label="Unique visits"
                />
                <VisitStat
                  icon="returning"
                  tint="bg-emerald-50 text-emerald-600"
                  value={report.returningVisits}
                  label="Returning visits"
                />
              </div>
              <div className="mt-4">
                <VisitorsChart
                  days={report.days}
                  series={[
                    {
                      id: TOTAL_SERIES_ID,
                      label: 'Total visits',
                      color: seriesColor(TOTAL_SERIES_ID),
                      values: report.days.map(day => day.visitors),
                    },
                    ...report.channels.map(row => ({
                      id: row.label,
                      label: row.label,
                      color: seriesColor(row.label),
                      values: report.days.map(day => day.channels[row.label] ?? 0),
                    })),
                  ]}
                />
              </div>
            </section>
            <div className="grid gap-3 lg:grid-cols-2">
              <CountTable title="Channel" rows={report.channels} label={value => <ChannelLabel name={value} />} />
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
