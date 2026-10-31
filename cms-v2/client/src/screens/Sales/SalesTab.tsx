import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import type { SaleListItem, SalesFeeSyncResult, Tutor } from '../../../../shared/types';
import { formatDisplayDate, formatPlainAmount, formatVaultPrice, isSalesPreset, londonToday, monthStart, salesPresetBounds, saleSessionLabel, type SalesPreset } from '../../../../shared/salesFormat';

const RANGE_PRESETS: Array<{ id: SalesPreset; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'last_month', label: 'Last month' },
  { id: 'last_3_months', label: 'Last 3 months' },
  { id: 'last_6_months', label: 'Last 6 months' },
  { id: 'last_year', label: 'Last year' },
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

function periodSalesTotals(rows: SaleListItem[]): Array<{ currency: string; amount: number }> {
  const cents = new Map<string, number>();
  for (const sale of rows) {
    if (sale.paymentStatus === 'Refunded') continue;
    if (sale.amount == null || Number.isNaN(Number(sale.amount))) continue;
    const currency = (sale.currency || 'USD').trim().toUpperCase() || 'USD';
    cents.set(currency, (cents.get(currency) ?? 0) + Math.round(Number(sale.amount) * 100));
  }
  return [...cents.entries()]
    .map(([currency, value]) => ({ currency, amount: value / 100 }))
    .sort((a, b) => {
      if (a.currency === 'USD') return -1;
      if (b.currency === 'USD') return 1;
      return a.currency.localeCompare(b.currency);
    });
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
    'Amount paid',
    'Stripe charge',
    'Net Payment $',
  ];
  const lines = rows.map(sale => [
    String(sale.id),
    sale.providerPaymentId ?? sale.stripePaymentIntentId ?? '',
    customerName(sale),
    sale.customerEmail ?? '',
    sale.courseName || `Course #${sale.courseId}`,
    saleSessionLabel(sale.durationDays, sale.expiryDate),
    countryLabel(sale.countryCode),
    sale.paymentMethod ?? '',
    processorLabel(sale),
    formatVaultPrice(sale),
    formatMoney(sale.processorFee, sale.settlementCurrency || sale.currency),
    formatPlainAmount(sale.netAmount),
  ].map(csvCell).join(','));
  const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `sales-${from}-to-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function SalesTab() {
  const [from, setFrom] = useState(() => monthStart(londonToday()));
  const [to, setTo] = useState(() => londonToday());
  const [preset, setPreset] = useState<SalesPreset | ''>('');
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
      const query = `from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      const [saleData, sandboxData, tutorData] = await Promise.all([
        api.get<SaleListItem[]>(`/sales?${query}&environment=production`),
        api.get<SaleListItem[]>(`/sales?${query}&environment=staging`),
        api.get<Tutor[]>('/tutors'),
      ]);
      if (requestId.current !== id) return;
      setSales(saleData ?? []);
      setSandboxSales(sandboxData ?? []);
      setTutors((tutorData ?? []).filter(tutor => tutor.isActive));
      setLoading(false);
      setSyncingFees(true);
      let remaining = 1;
      for (let attempt = 0; attempt < 8 && remaining > 0; attempt += 1) {
        const result = await api.post<SalesFeeSyncResult>('/sales/sync-fees', { from: fromDate, to: toDate });
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
      `Refund ${formatMoney(sale.amount, sale.currency)} for ${sale.courseName || `course #${sale.courseId}`}?\n\nThis will create a full refund in ${processorLabel(sale)} and revoke the student's access to this course.`,
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
    const linked = tutors.filter(tutor => tutor.courseIds.includes(sale.courseId));
    return linked.length > 0 ? linked : tutors;
  }

  const columnCount = 13;
  const totals = periodSalesTotals(sales);

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
                setFrom(bounds.start);
                setTo(bounds.end);
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
              max={to}
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
              min={from}
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
          <div className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total sales</p>
            {loading ? (
              <p className="text-lg font-semibold text-slate-400">…</p>
            ) : totals.length === 0 ? (
              <p className="text-lg font-semibold text-slate-900">{formatMoney(0, 'USD')}</p>
            ) : (
              totals.map(total => (
                <p key={total.currency} className="text-lg font-semibold text-slate-900">
                  {formatMoney(total.amount, total.currency)}
                </p>
              ))
            )}
          </div>
        </div>

        {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}

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
          <table className="w-full min-w-[1480px] text-left text-xs">
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
                <th className="px-3 py-2">Amount paid</th>
                <th className="px-3 py-2">Stripe charge</th>
                <th className="px-3 py-2">Net payment</th>
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
                      {saleSessionLabel(sale.durationDays, sale.expiryDate)}
                      <div className="text-[11px] text-slate-400">Sold {formatDisplayDate(sale.soldAt)}</div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap" title={sale.countryCode ?? undefined}>
                      {countryLabel(sale.countryCode)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{sale.paymentMethod || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{processorLabel(sale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatVaultPrice(sale)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatMoney(sale.processorFee, sale.settlementCurrency || sale.currency)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatMoney(sale.netAmount, sale.settlementCurrency || sale.currency)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1">
                        {sale.paymentStatus !== 'Refunded' && !sale.tutorId ? (
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
