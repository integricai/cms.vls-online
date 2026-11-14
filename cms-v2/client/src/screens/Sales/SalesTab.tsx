import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { SaleListItem, SalesFeeSyncResult, Tutor } from '../../../../shared/types';
import { formatDisplayDate, formatLocalPrice, formatPlainAmount, formatUsdPlainAmount, isSalesPreset, londonToday, monthStart, salesPresetBounds, saleListSessionLabel, sumAmountsInUsd, type SalesPreset } from '../../../../shared/salesFormat';

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

type CountrySalesBar = {
  code: string;
  name: string;
  count: number;
  amounts: Array<{ currency: string; amount: number }>;
};

/** One bar per country in the loaded live sales. Refunds are left out, matching the page totals. */
function salesByCountry(rows: SaleListItem[]): CountrySalesBar[] {
  const groups = new Map<string, { count: number; cents: Map<string, number> }>();
  for (const sale of rows) {
    if (sale.paymentStatus === 'Refunded') continue;
    const code = sale.countryCode?.trim().toUpperCase() || 'Unknown';
    const group = groups.get(code) ?? { count: 0, cents: new Map<string, number>() };
    group.count += 1;
    if (sale.amount != null && !Number.isNaN(Number(sale.amount))) {
      const currency = (sale.currency || 'USD').trim().toUpperCase() || 'USD';
      group.cents.set(currency, (group.cents.get(currency) ?? 0) + Math.round(Number(sale.amount) * 100));
    }
    groups.set(code, group);
  }
  return [...groups.entries()]
    .map(([code, group]) => ({
      code,
      name: code === 'Unknown' ? 'Unknown' : countryLabel(code),
      count: group.count,
      amounts: [...group.cents.entries()]
        .map(([currency, value]) => ({ currency, amount: value / 100 }))
        .sort((a, b) => b.amount - a.amount || a.currency.localeCompare(b.currency)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
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

function countrySalesSummary(country: CountrySalesBar): string {
  const sales = `${country.count} sale${country.count === 1 ? '' : 's'}`;
  if (country.amounts.length === 0) return sales;
  return `${sales} · ${country.amounts.map(amount => formatMoney(amount.amount, amount.currency)).join(', ')}`;
}

function CountrySalesChart({ rows, loading }: { rows: SaleListItem[]; loading: boolean }) {
  const countries = salesByCountry(rows);
  const max = Math.max(...countries.map(country => country.count), 1);

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white" aria-label="Sales by country">
      <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-800">Sales by country</h2>
      {loading ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">Loading…</p>
      ) : countries.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-slate-500">No live sales in this date range.</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2.5 overflow-auto px-4 py-3">
          {countries.map(country => {
            const summary = countrySalesSummary(country);
            const width = Math.max((country.count / max) * 100, 1.5);
            return (
              <li
                key={country.code}
                className="grid items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)_auto]"
                title={summary}
              >
                <span className="inline-flex min-w-0 items-center gap-2 text-xs text-slate-700">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: countryColor(country.code) }}
                    aria-hidden="true"
                  />
                  <CountryFlag code={country.code} />
                  <span className="truncate">{country.name}</span>
                </span>
                <span className="h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                  <span
                    className="block h-full rounded-full"
                    style={{ width: `${width}%`, backgroundColor: countryColor(country.code) }}
                  />
                </span>
                <span className="text-xs tabular-nums text-slate-600 sm:text-right">{summary}</span>
              </li>
            );
          })}
        </ul>
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

        <CountrySalesChart rows={sales} loading={loading} />

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
