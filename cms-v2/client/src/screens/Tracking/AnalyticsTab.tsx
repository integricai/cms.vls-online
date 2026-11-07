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

function Stat({ value, label, hint }: { value: string; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
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
            {rows.map(row => (
              <tr key={row.label} className="border-t border-slate-100">
                <td className="py-2 pr-3 text-slate-700">{row.label}</td>
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
              <Stat value={traffic.sessions.toLocaleString('en-GB')} label="Sessions" />
              <Stat value={traffic.engagedSessions.toLocaleString('en-GB')} label="Engaged sessions" />
              <Stat value={traffic.pageViews.toLocaleString('en-GB')} label="Page views" />
              <Stat value={traffic.checkoutViews.toLocaleString('en-GB')} label="Checkout views" />
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
