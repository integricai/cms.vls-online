import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { SaleListItem, SalesFeeSyncResult, Tutor } from '../../../../shared/types';
import { addIsoDays, amountInUsd, formatDisplayDate, formatLocalPrice, formatPlainAmount, formatUsdPlainAmount, isSalesPreset, londonToday, monthStart, salesPresetBounds, saleListSessionLabel, sumAmountsInUsd, type SalesPreset } from '../../../../shared/salesFormat';

const RANGE_PRESETS: Array<{ id: SalesPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'last_6_months', label: 'Last 6 months' },
  { id: 'this_year', label: 'This year' },
  { id: 'last_year', label: 'Last year' },
  { id: 'all_time', label: 'All time' },
];

function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null || Number.isNaN(amount)) return '—';
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function customerName(sale: SaleListItem): string {
  const name = [sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ').trim();
  return name || '—';
}

const countryNames = typeof Intl.DisplayNames === 'function'
  ? new Intl.DisplayNames(['en'], { type: 'region' })
  : null;

function countryLabel(code: string | null | undefined): string {
  const normalized = code?.trim().toUpperCase();
  if (!normalized) return '—';
  try {
    const name = countryNames?.of(normalized);
    if (!name || name.toUpperCase() === normalized) return normalized;
    return name;
  } catch {
    return normalized;
  }
}

function shortProcessorId(id: string | null | undefined): string {
  if (!id) return '—';
  if (id.length <= 22) return id;
  return `${id.slice(0, 12)}…${id.slice(-4)}`;
}

function processorLabel(sale: SaleListItem): string {
  return sale.provider === 'paypal' ? 'PayPal' : 'Stripe';
}

function processorPaymentUrl(sale: SaleListItem): string | null {
  const paymentId = sale.providerPaymentId ?? sale.stripePaymentIntentId;
  if (!paymentId) return null;
  if (sale.provider === 'paypal') return `https://www.paypal.com/activity/payment/${paymentId}`;
  return `https://dashboard.stripe.com/payments/${paymentId}`;
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function plainOrDash(value: string): string {
  return value || '—';
}

type CountryDaySeries = {
  code: string;
  name: string;
  total: number;
  values: number[];
};

const CHART_WIDTH = 760;
const CHART_HEIGHT = 260;
const CHART_LEFT = 48;
const CHART_RIGHT = 16;
const CHART_TOP = 16;
const CHART_BOTTOM = 32;

function londonIsoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function daysInRange(start: string, end: string): string[] {
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end && days.length < 800) {
    days.push(cursor);
    cursor = addIsoDays(cursor, 1);
  }
  return days;
}

function formatAxisDollars(amount: number): string {
  if (amount >= 1000) {
    const scaled = amount / 1000;
    return `$${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)}k`;
  }
  return `$${Math.round(amount)}`;
}

function formatChartDay(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(Date.UTC(year, month - 1, day)));
}

/** Daily dollar sales for every country in the selected dates. Refunds are left out. */
function countryDailySeries(
  rows: SaleListItem[],
  from: string,
  to: string,
  rates: Record<string, number> | null,
): { days: string[]; series: CountryDaySeries[]; missingCurrencies: string[] } {
  const live = rows.filter(sale => sale.paymentStatus !== 'Refunded');
  let start = from;
  let end = to;
  if (!start || !end) {
    const sold = live
      .map(sale => londonIsoDate(sale.soldAt))
      .filter((day): day is string => Boolean(day))
      .sort();
    start = sold[0] ?? '';
    end = sold[sold.length - 1] ?? '';
  }
  if (!start || !end || start > end) return { days: [], series: [], missingCurrencies: [] };

  const days = daysInRange(start, end);
  const slot = new Map(days.map((day, index) => [day, index]));
  const groups = new Map<string, number[]>();
  const missing = new Set<string>();

  for (const sale of live) {
    const day = londonIsoDate(sale.soldAt);
    const index = day ? slot.get(day) : undefined;
    if (index == null || sale.amount == null || !Number.isFinite(Number(sale.amount))) continue;
    const currency = (sale.currency || 'USD').trim().toUpperCase() || 'USD';
    const usd = amountInUsd(Number(sale.amount), currency, rates);
    if (usd == null) {
      missing.add(currency);
      continue;
    }
    const code = sale.countryCode?.trim().toUpperCase() || 'Unknown';
    const cents = groups.get(code) ?? Array(days.length).fill(0);
    cents[index] += Math.round(usd * 100);
    groups.set(code, cents);
  }

  const series = [...groups.entries()]
    .map(([code, cents]) => {
      const totalCents = cents.reduce((sum, value) => sum + value, 0);
      return {
        code,
        name: code === 'Unknown' ? 'Unknown' : countryLabel(code),
        total: totalCents / 100,
        values: cents.map(value => value / 100),
      };
    })
    .filter(country => country.total > 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { days, series, missingCurrencies: [...missing].sort() };
}

/** Stable hue from the country code, so a country keeps its colour when the dates change. */
function countryColor(code: string): string {
  if (code === 'Unknown') return '#94a3b8';
  let hash = 2166136261;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const hue = ((hash >>> 0) * 137.508) % 360;
  return `hsl(${hue.toFixed(1)} 62% 46%)`;
}

function CountryFlag({ code }: { code: string }) {
  const flag = code.toLowerCase();
  if (!/^[a-z]{2}$/.test(flag)) return null;
  return (
    <img
      src={`https://flagcdn.com/w40/${flag}.png`}
      width={20}
      height={15}
      alt=""
      className="h-[15px] w-5 shrink-0 rounded-sm object-cover"
    />
  );
}

function chartX(index: number, count: number): number {
  const plot = CHART_WIDTH - CHART_LEFT - CHART_RIGHT;
  if (count <= 1) return CHART_LEFT + plot / 2;
  return CHART_LEFT + (index / (count - 1)) * plot;
}

function chartY(amount: number, max: number): number {
  const plot = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;
  return CHART_TOP + plot - (amount / max) * plot;
}

function CountrySalesChart({
  rows,
  loading,
  from,
  to,
  rates,
}: {
  rows: SaleListItem[];
  loading: boolean;
  from: string;
  to: string;
  rates: Record<string, number> | null;
}) {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const { days, series, missingCurrencies } = countryDailySeries(rows, from, to, rates);
  const peak = Math.max(...series.flatMap(country => country.values), 0);
  const max = peak > 0 ? peak : 1;
  const ordered = activeCode
    ? [...series.filter(country => country.code !== activeCode), ...series.filter(country => country.code === activeCode)]
    : series;
  const plotBottom = CHART_HEIGHT - CHART_BOTTOM;
  const labelEvery = Math.max(1, Math.ceil(days.length / 6));

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white" aria-label="Sales by country">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Sales by country</h2>
      {loading ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">Loading…</p>
      ) : series.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">No live sales in this date range.</p>
      ) : (
        <div className="px-4 py-3">
          <p className="mb-2 text-xs text-slate-500">Dollars sold each day. The amount beside each flag is that country’s total for these dates.</p>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} className="h-64 w-full" role="img" aria-label="Daily sales by country">
            {[0, 0.5, 1].map(tick => {
              const y = chartY(max * tick, max);
              return (
                <g key={tick}>
                  <line x1={CHART_LEFT} x2={CHART_WIDTH - CHART_RIGHT} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="3 4" />
                  <text x={CHART_LEFT - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">
                    {formatAxisDollars(max * tick)}
                  </text>
                </g>
              );
            })}
            {ordered.map(country => {
              const color = countryColor(country.code);
              const dimmed = activeCode != null && activeCode !== country.code;
              const path = country.values
                .map((amount, index) => `${index === 0 ? 'M' : 'L'}${chartX(index, days.length).toFixed(1)},${chartY(amount, max).toFixed(1)}`)
                .join(' ');
              return (
                <g key={country.code} opacity={dimmed ? 0.15 : 1}>
                  <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round">
                    <title>{`${country.name}: ${formatMoney(country.total, 'USD')} in this date range`}</title>
                  </path>
                  {country.values.map((amount, index) => amount > 0 ? (
                    <circle key={`${country.code}-${days[index]}`} cx={chartX(index, days.length)} cy={chartY(amount, max)} r="3" fill={color}>
                      <title>{`${country.name} on ${formatChartDay(days[index])}: ${formatMoney(amount, 'USD')}`}</title>
                    </circle>
                  ) : null)}
                </g>
              );
            })}
            {days.map((day, index) => (
              index % labelEvery === 0 || index === days.length - 1 ? (
                <text key={day} x={chartX(index, days.length)} y={plotBottom + 18} textAnchor="middle" fill="#94a3b8" fontSize="11">
                  {formatChartDay(day)}
                </text>
              ) : null
            ))}
          </svg>
          <ul className="mt-3 flex max-h-40 flex-wrap gap-x-4 gap-y-2 overflow-auto">
            {series.map(country => (
              <li key={country.code}>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 text-xs text-slate-700"
                  onMouseEnter={() => setActiveCode(country.code)}
                  onMouseLeave={() => setActiveCode(null)}
                  onFocus={() => setActiveCode(country.code)}
                  onBlur={() => setActiveCode(null)}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: countryColor(country.code) }} aria-hidden="true" />
                  <CountryFlag code={country.code} />
                  <span>{country.name}</span>
                  <span className="tabular-nums text-slate-500">{formatMoney(country.total, 'USD')}</span>
                </button>
              </li>
            ))}
          </ul>
          {missingCurrencies.length > 0 ? (
            <p className="mt-2 text-[11px] text-amber-700">
              No dollar rate for {missingCurrencies.join(', ')}, so those amounts are not on the chart.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

function dollarTotals(
  rows: SaleListItem[],
  rates: Record<string, number> | null,
): { gross: number; net: number; missingCurrencies: string[] } {
  const grossEntries: Array<{ amount: number | null; currency: string }> = [];
  const netEntries: Array<{ amount: number | null; currency: string }> = [];
  for (const sale of rows) {
    if (sale.paymentStatus === 'Refunded') continue;
    grossEntries.push({ amount: sale.amount, currency: sale.currency || 'USD' });
    if (sale.netAmount != null && sale.settlementCurrency) {
      netEntries.push({ amount: sale.netAmount, currency: sale.settlementCurrency });
    }
  }
  const gross = sumAmountsInUsd(grossEntries, rates);
  const net = sumAmountsInUsd(netEntries, rates);
  const missingCurrencies = [...new Set([...gross.missingCurrencies, ...net.missingCurrencies])].sort();
  return { gross: gross.usd, net: net.usd, missingCurrencies };
}

function downloadSales(rows: SaleListItem[], from: string, to: string) {
  const header = [
    'SaleId',
    'StripeId',
    'User Name',
    'User Email',
    'Course',
    'Session',
    'Country',
    'Payment Method',
    'Stripe/PayPal',
    'Amount Paid $',
    'Amount paid',
    'Transaction Fee in $',
    'Net Payment $',
  ];
  const lines = rows.map(sale => [
    String(sale.id),
    sale.providerPaymentId ?? sale.stripePaymentIntentId ?? '',
    customerName(sale),
    sale.customerEmail ?? '',
    sale.courseName || `Course #${sale.courseId}`,
    saleListSessionLabel(sale.durationDays, sale.expiryDate, sale.paymentReason, sale.sessionMonth, sale.sessionYear),
    countryLabel(sale.countryCode),
    sale.paymentMethod ?? '',
    processorLabel(sale),
    formatUsdPlainAmount(sale.amount, sale.currency),
    formatLocalPrice(sale),
    formatUsdPlainAmount(sale.processorFee, sale.settlementCurrency || sale.currency),
    formatPlainAmount(sale.netAmount),
  ].map(csvCell).join(','));
  const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = from && to ? `sales-${from}-to-${to}.csv` : 'sales-all-time.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function SalesTab() {
  const [from, setFrom] = useState(() => monthStart(londonToday()));
  const [to, setTo] = useState(() => londonToday());
  const [preset, setPreset] = useState<SalesPreset | ''>('');
  const [usdRates, setUsdRates] = useState<Record<string, number> | null>(null);
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [sandboxSales, setSandboxSales] = useState<SaleListItem[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingFees, setSyncingFees] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [assigningSaleId, setAssigningSaleId] = useState<number | null>(null);
  const [refundingSaleId, setRefundingSaleId] = useState<number | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<Record<number, number>>({});
  const requestId = useRef(0);

  async function loadData(fromDate: string, toDate: string) {
    const id = requestId.current + 1;
    requestId.current = id;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      const live = new URLSearchParams(params);
      live.set('environment', 'production');
      const sandbox = new URLSearchParams(params);
      sandbox.set('environment', 'staging');
      const [saleData, sandboxData, tutorData, rates] = await Promise.all([
        api.get<SaleListItem[]>(`/sales?${live.toString()}`),
        api.get<SaleListItem[]>(`/sales?${sandbox.toString()}`),
        api.get<Tutor[]>('/tutors'),
        api.get<Record<string, number> | null>('/sales/fx-rates').catch(() => null),
      ]);
      if (requestId.current !== id) return;
      setSales(saleData ?? []);
      setSandboxSales(sandboxData ?? []);
      setTutors((tutorData ?? []).filter(tutor => tutor.isActive));
      setUsdRates(rates);
      setLoading(false);
      setSyncingFees(true);
      const syncFrom = fromDate || '2000-01-01';
      const syncTo = toDate || londonToday();
      let remaining = 1;
      for (let attempt = 0; attempt < 8 && remaining > 0; attempt += 1) {
        const result = await api.post<SalesFeeSyncResult>('/sales/sync-fees', { from: syncFrom, to: syncTo });
        if (requestId.current !== id) return;
        setSales(result.sales ?? []);
        setSandboxSales(result.sandboxSales ?? []);
        remaining = result.updated > 0 ? (result.remaining ?? 0) : 0;
      }
    } catch (err) {
      if (requestId.current !== id) return;
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      if (requestId.current === id) {
        setLoading(false);
        setSyncingFees(false);
      }
    }
  }

  useEffect(() => {
    void loadData(from, to);
  }, [from, to]);

  async function assignTutor(saleId: number) {
    const tutorId = selectedTutorId[saleId];
    if (!tutorId) {
      setError('Select a tutor before assigning');
      return;
    }
    setAssigningSaleId(saleId);
    setError('');
    setMessage('');
    try {
      await api.post(`/sales/${saleId}/assign`, { tutorId });
      setMessage('Tutor assigned');
      await loadData(from, to);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tutor');
    } finally {
      setAssigningSaleId(null);
    }
  }

  async function refundSale(sale: SaleListItem) {
    if (sale.paymentStatus === 'Refunded') return;
    const confirmed = window.confirm(
      sale.courseId == null
        ? `Refund ${formatMoney(sale.amount, sale.currency)} for this payment order?\n\nThis will create a full refund in ${processorLabel(sale)}.`
        : `Refund ${formatMoney(sale.amount, sale.currency)} for ${sale.courseName || `course #${sale.courseId}`}?\n\nThis will create a full refund in ${processorLabel(sale)} and revoke the student's access to this course.`,
    );
    if (!confirmed) return;

    setRefundingSaleId(sale.id);
    setError('');
    setMessage('');
    try {
      await api.post(`/sales/${sale.id}/refund`, {});
      setMessage(`Refund processed in ${processorLabel(sale)}, sale marked refunded, and course access revoked`);
      await loadData(from, to);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refund sale');
    } finally {
      setRefundingSaleId(null);
    }
  }

  function tutorsForSale(sale: SaleListItem): Tutor[] {
    const courseId = sale.courseId;
    if (courseId == null) return [];
    const linked = tutors.filter(tutor => tutor.courseIds.includes(courseId));
    return linked.length > 0 ? linked : tutors;
  }

  const columnCount = 14;
  const totals = dollarTotals(sales, usdRates);

  return (
    <div className="h-full overflow-auto">
      <div className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-bold text-slate-800">Sales</h1>
        <p className="mt-0.5 text-xs text-slate-500">
          Live course sales. Staging checkouts are listed under Sandbox and tests and are not included in the dashboard or the download.
        </p>
      </div>
      <div className="p-6">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-xs font-semibold text-slate-600">
            Range
            <select
              className="input mt-1 w-auto"
              value={preset}
              onChange={event => {
                const value = event.target.value;
                if (!isSalesPreset(value)) {
                  setPreset('');
                  return;
                }
                const bounds = salesPresetBounds(value);
                setPreset(value);
                setFrom(bounds?.start ?? '');
                setTo(bounds?.end ?? '');
              }}
            >
              <option value="">Custom range</option>
              {RANGE_PRESETS.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-600">
            Start date
            <input
              type="date"
              className="input mt-1"
              value={from}
              max={to || undefined}
              onChange={event => {
                if (!event.target.value) return;
                setPreset('');
                setFrom(event.target.value);
              }}
            />
          </label>
          <label className="text-xs font-semibold text-slate-600">
            End date
            <input
              type="date"
              className="input mt-1"
              value={to}
              min={from || undefined}
              onChange={event => {
                if (!event.target.value) return;
                setPreset('');
                setTo(event.target.value);
              }}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={loading || sales.length === 0}
            onClick={() => downloadSales(sales, from, to)}
          >
            Download
          </button>
          {syncingFees ? <span className="pb-2 text-xs text-slate-500">Updating Stripe fees…</span> : null}
          <div className="ml-auto flex flex-wrap justify-end gap-3">
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Gross Payments $</p>
              <p className={`text-lg font-semibold ${loading ? 'text-slate-400' : 'text-slate-900'}`}>
                {loading ? '…' : formatMoney(totals.gross, 'USD')}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Net Payments $</p>
              <p className={`text-lg font-semibold ${loading ? 'text-slate-400' : 'text-slate-900'}`}>
                {loading ? '…' : formatMoney(totals.net, 'USD')}
              </p>
            </div>
            {!loading && totals.missingCurrencies.length > 0 ? (
              <p className="basis-full text-right text-[11px] text-amber-700">
                No dollar rate for {totals.missingCurrencies.join(', ')}, so those amounts are not in the totals yet.
              </p>
            ) : null}
          </div>
        </div>

        {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}

        <CountrySalesChart rows={sales} loading={loading} from={from} to={to} rates={usdRates} />

        <h2 className="mb-2 text-sm font-semibold text-slate-800">Sales</h2>
        {renderSalesTable(sales, 'No live sales in this date range.')}

        <h2 className="mb-1 mt-8 text-sm font-semibold text-slate-800">Sandbox and tests</h2>
        <p className="mb-2 text-xs text-slate-500">Staging checkouts. These are kept out of the sales totals.</p>
        {renderSalesTable(sandboxSales, 'No sandbox sales in this date range.')}
      </div>
    </div>
  );

  function renderSalesTable(rows: SaleListItem[], emptyLabel: string) {
    return (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[1600px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">SaleId</th>
                <th className="px-3 py-2">StripeId</th>
                <th className="px-3 py-2">User name</th>
                <th className="px-3 py-2">User email</th>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Session</th>
                <th className="px-3 py-2">Country</th>
                <th className="px-3 py-2">Payment method</th>
                <th className="px-3 py-2">Stripe/PayPal</th>
                <th className="px-3 py-2">Amount Paid $</th>
                <th className="px-3 py-2">Amount paid</th>
                <th className="px-3 py-2">Transaction Fee in $</th>
                <th className="px-3 py-2">Net Payment $</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={columnCount} className="px-3 py-8 text-center text-slate-500">{emptyLabel}</td></tr>
              )}
              {!loading && rows.map(sale => {
                const paymentId = sale.providerPaymentId ?? sale.stripePaymentIntentId;
                const paymentUrl = processorPaymentUrl(sale);
                return (
                  <tr key={sale.id} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2 font-medium text-slate-800">{sale.id}</td>
                    <td className="px-3 py-2">
                      {paymentId && paymentUrl ? (
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[11px] text-blue-600 hover:underline"
                          title={paymentId}
                        >
                          {shortProcessorId(paymentId)}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{customerName(sale)}</td>
                    <td className="px-3 py-2">{sale.customerEmail || '—'}</td>
                    <td className="px-3 py-2">{sale.courseName || `Course #${sale.courseId}`}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {saleListSessionLabel(sale.durationDays, sale.expiryDate, sale.paymentReason, sale.sessionMonth, sale.sessionYear)}
                      <div className="text-[11px] text-slate-400">Sold {formatDisplayDate(sale.soldAt)}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" title={sale.countryCode ?? undefined}>
                      {countryLabel(sale.countryCode)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{sale.paymentMethod || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{processorLabel(sale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{plainOrDash(formatUsdPlainAmount(sale.amount, sale.currency))}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatLocalPrice(sale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{plainOrDash(formatUsdPlainAmount(sale.processorFee, sale.settlementCurrency || sale.currency))}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{plainOrDash(formatPlainAmount(sale.netAmount))}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {sale.courseId != null && sale.paymentStatus !== 'Refunded' && !sale.tutorId ? (
                          <div className="flex flex-wrap items-center gap-1">
                            <select
                              className="input text-[11px]"
                              value={selectedTutorId[sale.id] ?? ''}
                              onChange={event => setSelectedTutorId(prev => ({
                                ...prev,
                                [sale.id]: Number(event.target.value),
                              }))}
                            >
                              <option value="">Assign tutor…</option>
                              {tutorsForSale(sale).map(tutor => (
                                <option key={tutor.id} value={tutor.id}>
                                  {tutor.name} ({tutor.commissionPercent}%)
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="btn-primary text-[11px]"
                              disabled={assigningSaleId === sale.id}
                              onClick={() => void assignTutor(sale.id)}
                            >
                              {assigningSaleId === sale.id ? 'Assigning…' : 'Assign'}
                            </button>
                          </div>
                        ) : null}
                        {sale.paymentStatus === 'Refunded' ? (
                          <span className="text-[11px] text-slate-400">Refunded {formatDisplayDate(sale.refundedAt)}</span>
                        ) : sale.paymentStatus === 'Paid' ? (
                          <button
                            type="button"
                            className="btn-danger text-[11px]"
                            disabled={refundingSaleId === sale.id || !paymentId}
                            title={paymentId ? `Refund in ${processorLabel(sale)}` : 'Missing processor payment ID'}
                            onClick={() => void refundSale(sale)}
                          >
                            {refundingSaleId === sale.id ? 'Refunding…' : 'Refund'}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
    );
  }
}
