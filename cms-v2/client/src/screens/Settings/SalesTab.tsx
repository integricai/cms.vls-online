import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type {
  SaleCourseSummary,
  SaleListItem,
  SaleTutorSummary,
  Tutor,
} from '../../../../shared/types';

type SalesView = 'overview' | 'unassigned' | 'byCourse' | 'byTutor';

const VIEW_LABELS: Record<SalesView, string> = {
  overview: 'Overview',
  unassigned: 'Unassigned',
  byCourse: 'By course',
  byTutor: 'By tutor',
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: currency || 'GBP',
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusLabel(sale: SaleListItem): string {
  if (!sale.tutorId) return 'Awaiting tutor';
  if (sale.assignmentStatus === 'AdminAssigned') return 'Admin assigned';
  return 'Assigned';
}

function customerLabel(sale: SaleListItem): string {
  const name = [sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ').trim();
  if (name && sale.customerEmail) return `${name} (${sale.customerEmail})`;
  return name || sale.customerEmail || '—';
}

export default function SalesTab() {
  const [view, setView] = useState<SalesView>('overview');
  const [sales, setSales] = useState<SaleListItem[]>([]);
  const [byCourse, setByCourse] = useState<SaleCourseSummary[]>([]);
  const [byTutor, setByTutor] = useState<SaleTutorSummary[]>([]);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [assigningSaleId, setAssigningSaleId] = useState<number | null>(null);
  const [selectedTutorId, setSelectedTutorId] = useState<Record<number, number>>({});

  const unassignedSales = useMemo(
    () => sales.filter(sale => !sale.tutorId),
    [sales],
  );

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const status = view === 'unassigned' ? 'Unassigned' : 'All';
      const [saleData, courseSummary, tutorSummary, tutorData] = await Promise.all([
        api.get<SaleListItem[]>(`/sales?status=${encodeURIComponent(status)}`),
        api.get<SaleCourseSummary[]>('/sales/summary/by-course'),
        api.get<SaleTutorSummary[]>('/sales/summary/by-tutor'),
        api.get<Tutor[]>('/tutors'),
      ]);
      setSales(saleData ?? []);
      setByCourse(courseSummary ?? []);
      setByTutor(tutorSummary ?? []);
      setTutors((tutorData ?? []).filter(t => t.isActive));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [view]);

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
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tutor');
    } finally {
      setAssigningSaleId(null);
    }
  }

  function tutorsForSale(sale: SaleListItem): Tutor[] {
    const linked = tutors.filter(t => t.courseIds.includes(sale.courseId));
    return linked.length > 0 ? linked : tutors;
  }

  function renderAssignControl(sale: SaleListItem) {
    if (sale.tutorId) return null;
    const options = tutorsForSale(sale);
    return (
      <div className="flex flex-wrap items-center gap-1">
        <select
          className="input text-[11px]"
          value={selectedTutorId[sale.id] ?? ''}
          onChange={e => setSelectedTutorId(prev => ({
            ...prev,
            [sale.id]: Number(e.target.value),
          }))}
        >
          <option value="">Assign tutor…</option>
          {options.map(tutor => (
            <option key={tutor.id} value={tutor.id}>
              {tutor.name} ({tutor.commissionPercent}%)
            </option>
          ))}
        </select>
        <button
          className="btn-primary text-[11px]"
          disabled={assigningSaleId === sale.id}
          onClick={() => void assignTutor(sale.id)}
        >
          {assigningSaleId === sale.id ? 'Assigning…' : 'Assign'}
        </button>
      </div>
    );
  }

  function renderSalesTable(rows: SaleListItem[]) {
    return (
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Sold</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2">Amount</th>
              <th className="px-3 py-2">Tutor</th>
              <th className="px-3 py-2">Commission</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No sales found.</td></tr>
            )}
            {!loading && rows.map(sale => (
              <tr key={sale.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <div>{formatDate(sale.soldAt)}</div>
                  <div className="text-[11px] text-slate-400">Expires {formatDate(sale.expiryDate)}</div>
                </td>
                <td className="px-3 py-2">{sale.courseName || `Course #${sale.courseId}`}</td>
                <td className="px-3 py-2">{customerLabel(sale)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatMoney(sale.amount, sale.currency)}</td>
                <td className="px-3 py-2">{sale.tutorName || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {sale.commissionAmount != null
                    ? `${formatMoney(sale.commissionAmount, sale.currency)} (${sale.commissionPercent ?? 0}%)`
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <span className={`inline-flex rounded px-2 py-0.5 text-[11px] font-medium ${
                    sale.tutorId
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-amber-50 text-amber-700'
                  }`}>
                    {statusLabel(sale)}
                  </span>
                  {!sale.tutorId && sale.inviteCount > 0 && (
                    <div className="mt-1 text-[11px] text-slate-400">
                      {sale.inviteCount} invite{sale.inviteCount === 1 ? '' : 's'} sent
                    </div>
                  )}
                </td>
                <td className="px-3 py-2">{renderAssignControl(sale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h2 className="mb-1 text-sm font-bold text-slate-700">Sales</h2>
        <p className="text-xs text-slate-500">
          Track course sales, tutor claims, and commission (% of paid amount).
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {(Object.keys(VIEW_LABELS) as SalesView[]).map(key => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`border-b-2 px-3 py-2 text-xs font-medium transition ${
              view === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {VIEW_LABELS[key]}
            {key === 'unassigned' && unassignedSales.length > 0 && view !== 'unassigned' ? (
              <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800">
                {unassignedSales.length}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

      {(view === 'overview' || view === 'unassigned') && renderSalesTable(sales)}

      {view === 'byCourse' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Course</th>
                <th className="px-3 py-2">Sales</th>
                <th className="px-3 py-2">Unassigned</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Commission</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && byCourse.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No sales yet.</td></tr>
              )}
              {!loading && byCourse.map(row => (
                <tr key={row.courseId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.courseName}</td>
                  <td className="px-3 py-2">{row.saleCount}</td>
                  <td className="px-3 py-2">{row.unassignedCount}</td>
                  <td className="px-3 py-2">
                    {row.currencies.length <= 1
                      ? formatMoney(row.totalAmount, row.currencies[0] || 'GBP')
                      : `${row.totalAmount.toFixed(2)} (mixed)`}
                  </td>
                  <td className="px-3 py-2">
                    {row.currencies.length <= 1
                      ? formatMoney(row.totalCommission, row.currencies[0] || 'GBP')
                      : `${row.totalCommission.toFixed(2)} (mixed)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'byTutor' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Tutor</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Assigned sales</th>
                <th className="px-3 py-2">Sales total</th>
                <th className="px-3 py-2">Commission earned</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">Loading…</td></tr>
              )}
              {!loading && byTutor.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No assigned sales yet.</td></tr>
              )}
              {!loading && byTutor.map(row => (
                <tr key={row.tutorId} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{row.tutorName}</td>
                  <td className="px-3 py-2">{row.commissionPercent}%</td>
                  <td className="px-3 py-2">{row.saleCount}</td>
                  <td className="px-3 py-2">
                    {row.currencies.length <= 1
                      ? formatMoney(row.totalAmount, row.currencies[0] || 'GBP')
                      : `${row.totalAmount.toFixed(2)} (mixed)`}
                  </td>
                  <td className="px-3 py-2">
                    {row.currencies.length <= 1
                      ? formatMoney(row.totalCommission, row.currencies[0] || 'GBP')
                      : `${row.totalCommission.toFixed(2)} (mixed)`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
