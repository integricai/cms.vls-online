import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import type { BookDiscountCode, BookDiscountCodeBulkInput, BookDiscountCodeInput, BookRecord } from '../../../../shared/types';

type DraftCode = BookDiscountCodeInput & {
  clientId: string;
};

type ViewMode = 'single' | 'all';

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

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some(value => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some(value => value.trim())) rows.push(row);
  return rows;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export default function DiscountCodesScreen() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [allCodes, setAllCodes] = useState<BookDiscountCode[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('single');
  const [rows, setRows] = useState<DraftCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCodes, setLoadingCodes] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const selectedBook = useMemo(
    () => books.find(book => book.id === selectedBookId) ?? null,
    [books, selectedBookId],
  );

  useEffect(() => {
    Promise.all([
      api.get<BookRecord[]>('/books'),
      api.get<BookDiscountCode[]>('/book-discount-codes'),
    ])
      .then(([data, codes]) => {
        setBooks(data);
        setAllCodes(codes);
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

  async function refreshAllCodes() {
    const codes = await api.get<BookDiscountCode[]>('/book-discount-codes');
    setAllCodes(codes);
    return codes;
  }

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
      await refreshAllCodes();
      setDirty(false);
      setSaved(true);
      setMessage('Discount codes saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save discount codes.');
    } finally {
      setSaving(false);
    }
  }

  function allRows() {
    return books.flatMap(book => {
      const codes = allCodes.filter(code => code.bookId === book.id);
      if (!codes.length) {
        return [{
          book,
          code: null as BookDiscountCode | null,
        }];
      }
      return codes.map(code => ({ book, code }));
    });
  }

  function downloadCsv() {
    const header = ['Book ID', 'Book Name', 'Code', 'Insert Date', 'Issue Date', 'Customer Email'];
    const lines = [
      header.map(csvEscape).join(','),
      ...allRows().map(({ book, code }) => [
        book.id,
        book.title,
        code?.code ?? '',
        code?.insertDate ?? '',
        code?.issueDate ?? '',
        code?.customerEmail ?? '',
      ].map(csvEscape).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `book-discount-codes-${today()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File) {
    setImporting(true);
    setError('');
    setMessage('');
    try {
      const text = await file.text();
      const csvRows = parseCsv(text);
      const [header, ...body] = csvRows;
      if (!header?.length) throw new Error('CSV file is empty.');

      const headerMap = new Map(header.map((value, index) => [normalizeHeader(value), index]));
      const bookIdIndex = headerMap.get('bookid');
      const bookNameIndex = headerMap.get('bookname');
      const codeIndex = headerMap.get('code');
      const insertDateIndex = headerMap.get('insertdate');
      const issueDateIndex = headerMap.get('issuedate');
      const emailIndex = headerMap.get('customeremail');
      if (bookIdIndex == null && bookNameIndex == null) throw new Error('CSV must include Book ID or Book Name.');

      const bookById = new Map(books.map(book => [String(book.id), book]));
      const bookByName = new Map(books.map(book => [book.title.trim().toLowerCase(), book]));
      const grouped = new Map<number, BookDiscountCodeInput[]>();

      for (const row of body) {
        const rawId = bookIdIndex == null ? '' : row[bookIdIndex]?.trim();
        const rawName = bookNameIndex == null ? '' : row[bookNameIndex]?.trim();
        const book = (rawId ? bookById.get(rawId) : null) ?? (rawName ? bookByName.get(rawName.toLowerCase()) : null);
        if (!book) continue;
        const existing = grouped.get(book.id) ?? [];
        const code = codeIndex == null ? '' : (row[codeIndex] ?? '').trim();
        if (code) {
          existing.push({
            code,
            insertDate: insertDateIndex == null ? today() : (row[insertDateIndex] || today()).trim(),
            issueDate: issueDateIndex == null ? null : ((row[issueDateIndex] || '').trim() || null),
            customerEmail: emailIndex == null ? '' : (row[emailIndex] || '').trim(),
          });
        }
        grouped.set(book.id, existing);
      }

      if (!grouped.size) throw new Error('No matching books were found in the CSV.');
      const payload: BookDiscountCodeBulkInput[] = Array.from(grouped.entries()).map(([bookId, codes]) => ({ bookId, codes }));
      const updated = await api.put<BookDiscountCode[]>('/book-discount-codes/bulk/all-books', { books: payload });
      setAllCodes(updated);
      if (selectedBookId && grouped.has(selectedBookId)) {
        setRows(updated.filter(code => code.bookId === selectedBookId).map(recordToDraft));
        setDirty(false);
      }
      setMessage(`Imported discount codes for ${payload.length} book${payload.length === 1 ? '' : 's'}.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setImporting(false);
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
            <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
              {(['single', 'all'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded px-3 py-2 text-xs font-semibold ${viewMode === mode ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  {mode === 'single' ? 'Selected book' : 'All books'}
                </button>
              ))}
            </div>
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
            {viewMode === 'all' && (
              <>
                <button onClick={downloadCsv} disabled={books.length === 0} className="btn-ghost shrink-0 text-xs">
                  Download CSV
                </button>
                <label className={`btn-ghost shrink-0 cursor-pointer text-xs ${importing ? 'opacity-60' : ''}`}>
                  {importing ? 'Importing...' : 'Upload CSV'}
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    disabled={importing}
                    onChange={event => {
                      const file = event.target.files?.[0];
                      if (file) importCsv(file);
                      event.currentTarget.value = '';
                    }}
                  />
                </label>
              </>
            )}
            {viewMode === 'single' && <button onClick={addRow} disabled={!selectedBookId} className="btn-ghost shrink-0 text-xs">
              + Add row
            </button>}
            {viewMode === 'single' && <button onClick={saveRows} disabled={!selectedBookId || saving || !dirty} className="btn-primary shrink-0 text-xs">
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save codes'}
            </button>}
          </div>
        </div>
        {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        {message && <p className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{message}</p>}
      </div>

      <div className="flex-1 overflow-auto px-5 py-4">
        {viewMode === 'all' ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">All books and discount codes</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Export includes every book, even when no code has been added yet.
                </p>
              </div>
              <div className="text-xs text-slate-500">{books.length} books · {allCodes.length} codes</div>
            </div>
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="grid min-w-[980px] grid-cols-[1.4fr_1fr_130px_130px_1.2fr] gap-3 border-b border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <span>Book Name</span>
                <span>Code</span>
                <span>Insert Date</span>
                <span>Issue Date</span>
                <span>Customer Email</span>
              </div>
              <div className="divide-y divide-slate-100">
                {allRows().map(({ book, code }, index) => {
                  const used = Boolean(code?.issueDate);
                  return (
                    <div
                      key={`${book.id}-${code?.id ?? `empty-${index}`}`}
                      className={`grid min-w-[980px] grid-cols-[1.4fr_1fr_130px_130px_1.2fr] gap-3 px-3 py-3 text-sm ${used ? 'bg-amber-50' : 'bg-white'}`}
                    >
                      <span className="font-semibold text-slate-800">{book.title}</span>
                      <span className={code?.code ? 'text-slate-700' : 'text-slate-300'}>{code?.code || 'No code'}</span>
                      <span className="text-slate-500">{code?.insertDate || '-'}</span>
                      <span className="text-slate-500">{code?.issueDate || '-'}</span>
                      <span className="text-slate-500">{code?.customerEmail || '-'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </div>
  );
}
