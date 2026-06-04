import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { BookDiscountCode, BookDiscountCodeInput, BookRecord } from '../../../../shared/types';

type DraftCode = BookDiscountCodeInput & {
  clientId: string;
};

let draftCounter = 0;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function newDraft(): DraftCode {
  draftCounter += 1;
  return {
    clientId: `discount-code-${Date.now()}-${draftCounter}`,
    code: '',
    insertDate: today(),
    issueDate: null,
    customerEmail: '',
  };
}

function recordToDraft(record: BookDiscountCode): DraftCode {
  return {
    clientId: `discount-code-${record.id}`,
    id: record.id,
    code: record.code,
    insertDate: record.insertDate || today(),
    issueDate: record.issueDate,
    customerEmail: record.customerEmail,
  };
}

function cleanDrafts(rows: DraftCode[]): BookDiscountCodeInput[] {
  return rows
    .map(row => ({
      id: row.id,
      code: row.code.trim(),
      insertDate: row.insertDate || today(),
      issueDate: row.issueDate || null,
      customerEmail: row.customerEmail.trim(),
    }))
    .filter(row => row.code);
}

export default function DiscountCodesScreen() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [rows, setRows] = useState<DraftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');

  const selectedBook = useMemo(
    () => books.find(book => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  useEffect(() => {
    api.get<BookRecord[]>('/books')
      .then(data => {
        setBooks(data);
        setSelectedBookId(data[0]?.id ?? null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load books.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBookId) {
      setRows([]);
      return;
    }

    setLoadingCodes(true);
    setError('');
    setSaved(false);
    setDirty(false);
    api.get<BookDiscountCode[]>(`/book-discount-codes?bookId=${selectedBookId}`)
      .then(data => setRows(data.map(recordToDraft)))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Could not load discount codes.'))
      .finally(() => setLoadingCodes(false));
  }, [selectedBookId]);

  function updateRow(clientId: string, patch: Partial<DraftCode>) {
    setRows(prev => prev.map(row => row.clientId === clientId ? { ...row, ...patch } : row));
    setDirty(true);
    setSaved(false);
  }

  function addRow() {
    setRows(prev => [...prev, newDraft()]);
    setDirty(true);
    setSaved(false);
  }

  function removeRow(clientId: string) {
    setRows(prev => prev.filter(row => row.clientId !== clientId));
    setDirty(true);
    setSaved(false);
  }

  async function saveRows() {
    if (!selectedBookId) return;
    setSaving(true);
    setError('');
    try {
      const updated = await api.put<BookDiscountCode[]>(`/book-discount-codes/${selectedBookId}`, {
        codes: cleanDrafts(rows),
      });
      setRows(updated.map(recordToDraft));
      setDirty(false);
      setSaved(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save discount codes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Discount Codes</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Manage book-specific discount codes from the books database.
            </p>
          </div>
          <div className="flex items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-400">Book</span>
              <select
                className="input min-w-[320px]"
                value={selectedBookId ?? ''}
                onChange={event => setSelectedBookId(Number(event.target.value) || null)}
              >
                {books.length === 0 ? <option value="">No books available</option> : null}
                {books.map(book => <option key={book.id} value={book.id}>{book.title}</option>)}
              </select>
            </label>
            <button onClick={addRow} disabled={!selectedBookId} className="btn-ghost shrink-0 text-xs">
              + Add row
            </button>
            <button onClick={saveRows} disabled={!selectedBookId || saving || !dirty} className="btn-primary shrink-0 text-xs">
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save codes'}
            </button>
          </div>
        </div>
        {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">{selectedBook?.title ?? 'No book selected'}</p>
            <p className="mt-0.5 text-xs text-slate-400">
              {rows.length} code row{rows.length === 1 ? '' : 's'} for this book
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="h-3 w-3 rounded border border-slate-200 bg-white" />
              Available
            </span>
            <span className="inline-flex items-center gap-1 text-slate-500">
              <span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" />
              Used
            </span>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="grid grid-cols-[1.2fr_150px_150px_1.4fr_80px] gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
            <span>Code</span>
            <span>Insert Date</span>
            <span>Issue Date</span>
            <span>Customer Email</span>
            <span className="text-right">Action</span>
          </div>

          {loadingCodes ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">Loading codes...</div>
          ) : rows.length === 0 ? (
            <div className="px-3 py-10 text-center text-sm text-slate-400">
              No discount codes saved for this book yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {rows.map(row => {
                const used = Boolean(row.issueDate);
                return (
                  <div
                    key={row.clientId}
                    className={`grid grid-cols-[1.2fr_150px_150px_1.4fr_80px] gap-3 px-3 py-3 transition ${
                      used ? 'bg-amber-50' : 'bg-white'
                    }`}
                  >
                    <input
                      className="input"
                      value={row.code}
                      placeholder="Discount code"
                      onChange={event => updateRow(row.clientId, { code: event.target.value })}
                    />
                    <input
                      type="date"
                      className="input"
                      value={row.insertDate}
                      onChange={event => updateRow(row.clientId, { insertDate: event.target.value })}
                    />
                    <input
                      type="date"
                      className="input"
                      value={row.issueDate ?? ''}
                      onChange={event => updateRow(row.clientId, { issueDate: event.target.value || null })}
                    />
                    <input
                      type="email"
                      className="input"
                      value={row.customerEmail}
                      placeholder="customer@example.com"
                      onChange={event => updateRow(row.clientId, { customerEmail: event.target.value })}
                    />
                    <button
                      onClick={() => removeRow(row.clientId)}
                      className="justify-self-end rounded border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {dirty && (
          <p className="mt-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Unsaved changes for this book. Click Save codes to update the table.
          </p>
        )}
      </div>
    </div>
  );
}
