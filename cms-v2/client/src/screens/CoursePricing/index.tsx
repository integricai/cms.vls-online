import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../../api/client';
import type {
  CourseGeoPrice,
  CoursePriceImportPreview,
  CoursePriceImportResult,
  CoursePricingSummary,
} from '../../../../shared/types';
import {
  EVENDEALS_PRODUCT_OPTIONS,
  evenDealsProductLabel,
} from '../../../../shared/evenDealsProducts';

type View = 'list' | 'manage' | 'import';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 11 }, (_, i) => CURRENT_YEAR + i);

type PricingMode = 'session' | 'duration';

type PriceDraft = {
  id?: number;
  name: string;
  amount: string;
  discountPercent: string;
  compareAtAmount: string;
  pricingMode: PricingMode;
  examSessionMonth: string;
  examSessionYear: string;
  durationDays: string;
  evenDeals: string;
  isActive: boolean;
  isDefault: boolean;
  stripePriceId: string;
};

function emptyDraft(): PriceDraft {
  return {
    name: '',
    amount: '',
    discountPercent: '',
    compareAtAmount: '',
    pricingMode: 'duration',
    examSessionMonth: String(MONTH_OPTIONS[0]!.value),
    examSessionYear: String(CURRENT_YEAR),
    durationDays: '',
    evenDeals: '',
    isActive: true,
    isDefault: false,
    stripePriceId: '',
  };
}

function calcDiscountedPrice(amount: string, discountPercent: string): number | null {
  const list = Number(amount);
  const discount = Number(discountPercent);
  if (!Number.isFinite(list) || list <= 0 || !Number.isFinite(discount) || discount <= 0) return null;
  return Math.round(list * (1 - discount / 100) * 100) / 100;
}

function priceToDraft(price: CourseGeoPrice): PriceDraft {
  return {
    id: price.id,
    name: price.name,
    amount: String(price.amount),
    discountPercent: price.discountPercent != null ? String(price.discountPercent) : '',
    compareAtAmount: price.compareAtAmount != null ? String(price.compareAtAmount) : '',
    pricingMode: price.pricingMode,
    examSessionMonth: price.examSessionMonth != null ? String(price.examSessionMonth) : String(MONTH_OPTIONS[0]!.value),
    examSessionYear: price.examSessionYear != null ? String(price.examSessionYear) : String(CURRENT_YEAR),
    durationDays: price.durationDays != null ? String(price.durationDays) : '',
    evenDeals: price.evenDeals ?? '',
    isActive: price.isActive,
    isDefault: price.isDefault,
    stripePriceId: price.stripePriceId ?? '',
  };
}

function formatMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return '—';
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

function formatPricingMode(price: Pick<CourseGeoPrice, 'pricingMode' | 'examSessionMonth' | 'examSessionYear' | 'durationDays'>): string {
  if (price.pricingMode === 'session') {
    if (price.examSessionMonth == null || price.examSessionYear == null) return '—';
    const monthLabel = MONTH_OPTIONS.find(m => m.value === price.examSessionMonth)?.label ?? String(price.examSessionMonth);
    return `${monthLabel} ${price.examSessionYear}`;
  }
  return price.durationDays != null ? `${price.durationDays} day${price.durationDays === 1 ? '' : 's'}` : '—';
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function downloadText(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function downloadTemplate(): Promise<void> {
  const token = getToken();
  const base = (import.meta.env.VITE_API_URL ?? '') + '/api';
  const res = await fetch(`${base}/course-pricing/admin/template`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Failed to download template');
  const text = await res.text();
  downloadText('course-pricing-template.csv', text);
}

export default function CoursePricing({ embedded = false }: { embedded?: boolean }) {
  const [view, setView] = useState<View>('list');
  const [search, setSearch] = useState('');
  const [summaries, setSummaries] = useState<CoursePricingSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseTitle, setCourseTitle] = useState('');
  const [prices, setPrices] = useState<CourseGeoPrice[]>([]);
  const [draft, setDraft] = useState<PriceDraft>(emptyDraft());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationMissing, setValidationMissing] = useState<Array<{ id: number; name: string }>>([]);

  // Import state
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<CoursePriceImportPreview | null>(null);
  const [importResult, setImportResult] = useState<CoursePriceImportResult | null>(null);
  const [importValidOnly, setImportValidOnly] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadSummaries = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, validation] = await Promise.all([
        api.get<CoursePricingSummary[]>(`/course-pricing/admin/courses${search ? `?search=${encodeURIComponent(search)}` : ''}`),
        api.get<{ valid: boolean; missingDefaultPrice: Array<{ id: number; name: string }> }>('/course-pricing/admin/validation'),
      ]);
      setSummaries(data);
      setValidationMissing(validation.missingDefaultPrice ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (view === 'list') void loadSummaries();
  }, [view, loadSummaries]);

  const openManage = async (courseId: number, title: string) => {
    setError('');
    setMessage('');
    setSelectedCourseId(courseId);
    setCourseTitle(title);
    setDraft(emptyDraft());
    setEditingId(null);
    setView('manage');
    try {
      const data = await api.get<{ course: { name: string }; prices: CourseGeoPrice[] }>(
        `/course-pricing/admin/courses/${courseId}/prices`,
      );
      setCourseTitle(data.course.name);
      setPrices(data.prices);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load prices');
    }
  };

  const refreshPrices = async () => {
    if (!selectedCourseId) return;
    const data = await api.get<{ course: { name: string }; prices: CourseGeoPrice[] }>(
      `/course-pricing/admin/courses/${selectedCourseId}/prices`,
    );
    setPrices(data.prices);
  };

  const savePrice = async () => {
    if (!selectedCourseId) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const body = {
        name: draft.name.trim(),
        amount: Number(draft.amount),
        compareAtAmount: draft.compareAtAmount === '' ? null : Number(draft.compareAtAmount),
        discountPercent: draft.discountPercent === '' ? null : Number(draft.discountPercent),
        isActive: draft.isActive,
        isDefault: draft.isDefault,
        pricingMode: draft.pricingMode,
        examSessionMonth: draft.pricingMode === 'session' ? Number(draft.examSessionMonth) : null,
        examSessionYear: draft.pricingMode === 'session' ? Number(draft.examSessionYear) : null,
        durationDays: draft.pricingMode === 'duration' ? Number(draft.durationDays) : null,
        stripePriceId: draft.stripePriceId.trim() || null,
        evenDeals: draft.evenDeals.trim() || null,
      };

      if (editingId) {
        await api.put(`/course-pricing/admin/prices/${editingId}`, body);
        setMessage('Price updated');
      } else {
        await api.post(`/course-pricing/admin/courses/${selectedCourseId}/prices`, body);
        setMessage('Price created');
      }
      setDraft(emptyDraft());
      setEditingId(null);
      await refreshPrices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save price');
    } finally {
      setSaving(false);
    }
  };

  const deactivatePrice = async (priceId: number) => {
    if (!confirm('Deactivate this price?')) return;
    setError('');
    try {
      await api.post(`/course-pricing/admin/prices/${priceId}/deactivate`, {});
      await refreshPrices();
      setMessage('Price deactivated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate');
    }
  };

  const setDefault = async (priceId: number) => {
    if (!selectedCourseId) return;
    setError('');
    try {
      await api.post(`/course-pricing/admin/courses/${selectedCourseId}/prices/${priceId}/set-default`, {});
      await refreshPrices();
      setMessage('Default price updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set default');
    }
  };

  const runPreview = async () => {
    setImporting(true);
    setError('');
    setImportResult(null);
    try {
      const data = await api.post<CoursePriceImportPreview>('/course-pricing/admin/import/preview', {
        csv: csvText,
      });
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setImporting(false);
    }
  };

  const runCommit = async () => {
    if (!preview) return;
    setImporting(true);
    setError('');
    try {
      const data = await api.post<{ preview: CoursePriceImportPreview; result: CoursePriceImportResult }>(
        '/course-pricing/admin/import/commit',
        { preview, importValidRowsOnly: importValidOnly },
      );
      setPreview(data.preview);
      setImportResult(data.result);
      setMessage(`Import complete: ${data.result.created} created, ${data.result.updated} updated`);
    } catch (err) {
      const e = err as Error & { data?: CoursePriceImportPreview };
      if (e.data) setPreview(e.data);
      setError(e.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const downloadErrorReport = () => {
    if (!preview?.errors?.length) return;
    const lines = [
      'row_number,field,message',
      ...preview.errors.map(err => {
        const field = String(err.field ?? '').replace(/"/g, '""');
        const message = String(err.message ?? '').replace(/"/g, '""');
        return `${err.rowNumber},"${field}","${message}"`;
      }),
    ];
    downloadText('course-pricing-import-errors.csv', `${lines.join('\n')}\n`);
  };

  const filteredCount = useMemo(() => summaries.length, [summaries]);

  const shellClass = embedded ? 'space-y-4 p-6' : 'mx-auto max-w-6xl space-y-4 p-6';

  if (view === 'import') {
    return (
      <div className={shellClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Bulk Upload Prices</h1>
            <p className="text-sm text-slate-500">Upload CSV/Excel-exported CSV, preview, then confirm.</p>
          </div>
          <div className="flex gap-2">
            <button className="btn-ghost text-xs" onClick={() => void downloadTemplate()}>
              Download Template
            </button>
            <button className="btn-ghost text-xs" onClick={() => { setView('list'); setPreview(null); setImportResult(null); }}>
              Back to courses
            </button>
          </div>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Download the pricing template</li>
          <li>Fill prices in Excel and save as CSV</li>
          <li>Paste or upload the file below</li>
          <li>Preview changes and review errors</li>
          <li>Confirm import</li>
        </ol>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="mb-2 block text-sm font-medium text-slate-700">CSV content</label>
          <textarea
            className="input min-h-[180px] font-mono text-xs"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            placeholder="Paste CSV contents here…"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setCsvText(await file.text());
              }}
            />
            <button className="btn-primary text-xs" disabled={importing || !csvText.trim()} onClick={() => void runPreview()}>
              {importing ? 'Working…' : 'Preview import'}
            </button>
          </div>
        </div>

        {preview && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                Valid rows: <strong>{preview.validRows.length}</strong>
              </div>
              <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                Errors: <strong>{preview.errors.length}</strong>
              </div>
              <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Warnings: <strong>{preview.warnings.length}</strong>
              </div>
              {preview.stats && (
                <>
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    No default: <strong>{preview.stats.coursesWithoutDefault}</strong>
                  </div>
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                    Auto-defaulted: <strong>{preview.stats.autoDefaultedCourses}</strong>
                  </div>
                </>
              )}
            </div>

            {preview.warnings.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold text-amber-800">Import warnings</h2>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="py-1 pr-2">Row</th>
                        <th className="py-1 pr-2">Field</th>
                        <th className="py-1">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.warnings.map((warn, i) => (
                        <tr key={`${warn.rowNumber}-${i}`} className="border-b border-slate-100">
                          <td className="py-1 pr-2">{warn.rowNumber || '—'}</td>
                          <td className="py-1 pr-2">{warn.field ?? '—'}</td>
                          <td className="py-1">{warn.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-white p-4">
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-red-800">Row errors</h2>
                  <button className="btn-ghost text-xs" onClick={downloadErrorReport}>Download error report</button>
                </div>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="py-1 pr-2">Row</th>
                        <th className="py-1 pr-2">Field</th>
                        <th className="py-1">Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.errors.map((err, i) => (
                        <tr key={`${err.rowNumber}-${i}`} className="border-b border-slate-100">
                          <td className="py-1 pr-2">{err.rowNumber}</td>
                          <td className="py-1 pr-2">{err.field ?? '—'}</td>
                          <td className="py-1">{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {preview.validRows.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <h2 className="mb-2 text-sm font-semibold text-slate-800">Preview changes</h2>
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b text-slate-500">
                        <th className="py-1 pr-2">Row</th>
                        <th className="py-1 pr-2">Action</th>
                        <th className="py-1 pr-2">Course</th>
                        <th className="py-1 pr-2">Price</th>
                        <th className="py-1 pr-2">Amount (USD)</th>
                        <th className="py-1 pr-2">Discount</th>
                        <th className="py-1 pr-2">Pricing</th>
                        <th className="py-1">Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.validRows.map(row => (
                        <tr key={row.rowNumber} className="border-b border-slate-100">
                          <td className="py-1 pr-2">{row.rowNumber}</td>
                          <td className="py-1 pr-2">{row.action}</td>
                          <td className="py-1 pr-2">{row.courseTitle}</td>
                          <td className="py-1 pr-2">{row.price.priceName}</td>
                          <td className="py-1 pr-2">{formatMoney(row.price.amount, 'USD')}</td>
                          <td className="py-1 pr-2">
                            {row.price.discountPercent != null && row.price.discountPercent > 0
                              ? `${row.price.discountPercent}%`
                              : '—'}
                          </td>
                          <td className="py-1 pr-2">
                            {formatPricingMode({
                              pricingMode: row.price.pricingMode ?? 'duration',
                              examSessionMonth: row.price.examSessionMonth ?? null,
                              examSessionYear: row.price.examSessionYear ?? null,
                              durationDays: row.price.durationDays ?? null,
                            })}
                          </td>
                          <td className="py-1">{row.price.isDefault ? 'Yes' : 'No'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input
                      type="checkbox"
                      checked={importValidOnly}
                      onChange={e => setImportValidOnly(e.target.checked)}
                    />
                    Import valid rows only (skip rows with errors)
                  </label>
                  <button
                    className="btn-primary text-xs"
                    disabled={importing || (preview.errors.length > 0 && !importValidOnly)}
                    onClick={() => void runCommit()}
                  >
                    {importing ? 'Importing…' : 'Confirm import'}
                  </button>
                </div>
              </div>
            )}

            {importResult && (
              <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Created: <strong>{importResult.created}</strong> · Updated: <strong>{importResult.updated}</strong>
                {importResult.deactivated > 0 && <> · Deactivated duplicates: <strong>{importResult.deactivated}</strong></>}
                {importResult.skipped > 0 && <> · Skipped: <strong>{importResult.skipped}</strong></>}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (view === 'manage' && selectedCourseId) {
    const previewDiscounted = calcDiscountedPrice(draft.amount, draft.discountPercent);

    return (
      <div className={shellClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Manage Prices</h1>
            <p className="text-sm text-slate-500">{courseTitle}</p>
          </div>
          <button className="btn-ghost text-xs" onClick={() => { setView('list'); setSelectedCourseId(null); }}>
            Back to courses
          </button>
        </div>

        {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="section-label">{editingId ? 'Edit price' : 'Add price'}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs text-slate-600">
              Price name
              <input className="input mt-1" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-600">
              List price (USD)
              <input className="input mt-1" type="number" min="0" step="0.01" value={draft.amount} onChange={e => setDraft(d => ({ ...d, amount: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-600">
              Discount (%)
              <input
                className="input mt-1"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={draft.discountPercent}
                onChange={e => setDraft(d => ({ ...d, discountPercent: e.target.value }))}
              />
            </label>
            <label className="text-xs text-slate-600">
              Final price (USD)
              <input
                className="input mt-1 bg-slate-50"
                type="text"
                readOnly
                value={previewDiscounted != null ? formatMoney(previewDiscounted, 'USD') : (draft.amount ? formatMoney(Number(draft.amount), 'USD') : '—')}
              />
            </label>
            <label className="text-xs text-slate-600">
              Compare-at amount (USD)
              <input className="input mt-1" type="number" min="0" step="0.01" value={draft.compareAtAmount} onChange={e => setDraft(d => ({ ...d, compareAtAmount: e.target.value }))} />
            </label>
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="mb-1 text-xs text-slate-600">Pricing type</p>
              <div className="flex gap-4 text-xs text-slate-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={draft.pricingMode === 'session'}
                    onChange={() => setDraft(d => ({ ...d, pricingMode: 'session' }))}
                  />
                  Session based
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={draft.pricingMode === 'duration'}
                    onChange={() => setDraft(d => ({ ...d, pricingMode: 'duration' }))}
                  />
                  Duration based
                </label>
              </div>
            </div>
            {draft.pricingMode === 'session' ? (
              <>
                <label className="text-xs text-slate-600">
                  Exam session month
                  <select
                    className="input mt-1"
                    value={draft.examSessionMonth}
                    onChange={e => setDraft(d => ({ ...d, examSessionMonth: e.target.value }))}
                  >
                    {MONTH_OPTIONS.map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Exam session year
                  <select
                    className="input mt-1"
                    value={draft.examSessionYear}
                    onChange={e => setDraft(d => ({ ...d, examSessionYear: e.target.value }))}
                  >
                    {YEAR_OPTIONS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </label>
              </>
            ) : (
              <label className="text-xs text-slate-600">
                Duration (Days)
                <input
                  className="input mt-1"
                  type="number"
                  min="1"
                  step="1"
                  value={draft.durationDays}
                  onChange={e => setDraft(d => ({ ...d, durationDays: e.target.value.replace(/[^0-9]/g, '') }))}
                />
              </label>
            )}
            <label className="text-xs text-slate-600">
              Stripe price ID
              <input className="input mt-1" value={draft.stripePriceId} onChange={e => setDraft(d => ({ ...d, stripePriceId: e.target.value }))} />
            </label>
            <label className="text-xs text-slate-600">
              Evendeals
              <select
                className="input mt-1"
                value={draft.evenDeals}
                onChange={e => setDraft(d => ({ ...d, evenDeals: e.target.value }))}
              >
                <option value="">Default (env product)</option>
                {EVENDEALS_PRODUCT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-4 pb-2 text-xs text-slate-700">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.isActive} onChange={e => setDraft(d => ({ ...d, isActive: e.target.checked }))} />
                Active
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={draft.isDefault} onChange={e => setDraft(d => ({ ...d, isDefault: e.target.checked }))} />
                Default
              </label>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary text-xs" disabled={saving} onClick={() => void savePrice()}>
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add price'}
            </button>
            {editingId && (
              <button
                className="btn-ghost text-xs"
                onClick={() => { setEditingId(null); setDraft(emptyDraft()); }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2">Price name</th>
                <th className="px-3 py-2">List price</th>
                <th className="px-3 py-2">Discount</th>
                <th className="px-3 py-2">Final price</th>
                <th className="px-3 py-2">Pricing</th>
                <th className="px-3 py-2">Evendeals</th>
                <th className="px-3 py-2">Compare-at</th>
                <th className="px-3 py-2">Active</th>
                <th className="px-3 py-2">Default</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {prices.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">No prices yet. Add a default price to start.</td>
                </tr>
              )}
              {prices.map(price => (
                <tr key={price.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-800">{price.name}</td>
                  <td className="px-3 py-2">{formatMoney(price.amount, 'USD')}</td>
                  <td className="px-3 py-2">{price.discountPercent != null && price.discountPercent > 0 ? `${price.discountPercent}%` : '—'}</td>
                  <td className="px-3 py-2 font-medium text-emerald-800">{formatMoney(price.effectiveAmount, 'USD')}</td>
                  <td className="px-3 py-2">{formatPricingMode(price)}</td>
                  <td className="px-3 py-2">{evenDealsProductLabel(price.evenDeals) ?? 'Default'}</td>
                  <td className="px-3 py-2">{formatMoney(price.compareAtAmount, 'USD')}</td>
                  <td className="px-3 py-2">{price.isActive ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">{price.isDefault ? 'Yes' : 'No'}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      <button className="btn-ghost text-[11px]" onClick={() => { setEditingId(price.id); setDraft(priceToDraft(price)); }}>Edit</button>
                      {!price.isDefault && price.isActive && (
                        <button className="btn-ghost text-[11px]" onClick={() => void setDefault(price.id)}>Set default</button>
                      )}
                      {price.isActive && (
                        <button className="btn-ghost text-[11px]" onClick={() => void deactivatePrice(price.id)}>Deactivate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!embedded && <h1 className="text-xl font-semibold text-slate-900">Course Pricing</h1>}
          {embedded && <h2 className="text-sm font-bold text-slate-700">Course Pricing</h2>}
          <p className="text-sm text-slate-500">
            Manage USD prices per course and duration. Regional discounts are handled by Evendeals (per price).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost text-xs" onClick={() => void downloadTemplate()}>
            Download Template
          </button>
          <button className="btn-ghost text-xs" onClick={() => { setView('import'); setError(''); setMessage(''); }}>
            Bulk Upload Prices
          </button>
          <button className="btn-primary text-xs" onClick={() => void loadSummaries()}>
            Refresh
          </button>
        </div>
      </div>

      {validationMissing.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>{validationMissing.length}</strong> active course(s) missing an active default price:{' '}
          {validationMissing.slice(0, 5).map(c => c.name).join(', ')}
          {validationMissing.length > 5 ? '…' : ''}
        </div>
      )}

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div>}

      <div className="flex items-center gap-3">
        <input
          className="input max-w-sm"
          placeholder="Search by course title, slug, or Zenler ID"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void loadSummaries(); }}
        />
        <button className="btn-ghost text-xs" onClick={() => void loadSummaries()}>Search</button>
        <span className="text-xs text-slate-500">{filteredCount} courses</span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[900px] text-left text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2">Course title</th>
              <th className="px-3 py-2">Zenler course ID</th>
              <th className="px-3 py-2">Default final price</th>
              <th className="px-3 py-2">Active prices</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Last updated</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">Loading…</td>
              </tr>
            )}
            {!loading && summaries.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-slate-500">No courses found. Sync courses from Zenler in Settings first.</td>
              </tr>
            )}
            {!loading && summaries.map(row => (
              <tr key={row.courseId} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-800">{row.courseTitle}</td>
                <td className="px-3 py-2 font-mono text-[11px]">{row.zenlerCourseId}</td>
                <td className="px-3 py-2">
                  {row.defaultPrice
                    ? formatMoney(row.defaultPrice.effectiveAmount, 'USD')
                    : <span className="text-amber-700">Missing default</span>}
                </td>
                <td className="px-3 py-2">{row.activePriceCount}</td>
                <td className="px-3 py-2">
                  <span className={row.isActive ? 'text-emerald-700' : 'text-slate-400'}>
                    {row.isActive ? 'Active' : 'Inactive'}
                  </span>
                  {!row.hasActiveDefault && row.isActive && (
                    <span className="ml-1 text-amber-700">· no default</span>
                  )}
                </td>
                <td className="px-3 py-2">{formatDate(row.updatedAt)}</td>
                <td className="px-3 py-2">
                  <button
                    className="btn-primary text-[11px]"
                    onClick={() => void openManage(row.courseId, row.courseTitle)}
                  >
                    Manage Prices
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
