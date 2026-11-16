import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { ExperimentResultRow } from '../../../../shared/experiments';

function formatConversion(value: number | null): string {
  if (value == null) return '—';
  return `${(value * 100).toFixed(1)}%`;
}

function formatMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return '—';
  if (!currency) {
    return amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default function ExperimentResults({ experimentId }: { experimentId: number }) {
  const [rows, setRows] = useState<ExperimentResultRow[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError('');
    api.get<ExperimentResultRow[]>(`/experiments/${experimentId}/results`)
      .then(data => {
        if (!cancelled) setRows(data);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load results');
      });
    return () => {
      cancelled = true;
    };
  }, [experimentId]);

  const ahead = rows?.find(row => row.ahead) ?? null;
  const withOrders = rows?.filter(row => row.orders > 0) ?? [];
  const bestConversion = withOrders.reduce((best, row) => Math.max(best, row.conversion ?? 0), 0);
  const level = !ahead && withOrders.filter(row => row.conversion === bestConversion).length > 1;

  return (
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-900">Results</h3>
      <p className="mt-1 text-xs text-slate-500">
        Visitors are counted once. Orders are paid course checkouts while the test is open. The page with the higher conversion is ahead.
      </p>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {rows == null && !error ? <p className="mt-3 text-sm text-slate-500">Loading results…</p> : null}
      {rows ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-semibold">Page</th>
                <th className="py-2 pr-3 font-semibold">Visitors</th>
                <th className="py-2 pr-3 font-semibold">Orders</th>
                <th className="py-2 pr-3 font-semibold">Conversion</th>
                <th className="py-2 pr-3 font-semibold">Revenue</th>
                <th className="py-2 font-semibold">Revenue per visitor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.label} className={row.ahead ? 'bg-green-50' : ''}>
                  <td className="py-2 pr-3">
                    <span className="font-medium text-slate-900">{row.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{row.path}</span>
                    {row.ahead ? (
                      <span className="mt-1 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-800">
                        Ahead
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3 text-slate-700">{row.visitors.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-3 text-slate-700">{row.orders.toLocaleString('en-GB')}</td>
                  <td className="py-2 pr-3 text-slate-700">{formatConversion(row.conversion)}</td>
                  <td className="py-2 pr-3 text-slate-700">{formatMoney(row.revenue, row.currency)}</td>
                  <td className="py-2 text-slate-700">{formatMoney(row.revenuePerVisitor, row.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ahead ? (
            <p className="mt-3 text-xs text-slate-600">
              Page {ahead.label} is ahead on conversion. Ending the test leaves the live page as it is.
            </p>
          ) : null}
          {level ? (
            <p className="mt-3 text-xs text-slate-600">The leading pages are level on conversion.</p>
          ) : null}
          {!ahead && !level && rows.every(row => row.orders === 0) ? (
            <p className="mt-3 text-xs text-slate-500">No paid orders for this test yet.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
