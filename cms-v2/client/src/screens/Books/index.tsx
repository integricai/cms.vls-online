import { useEffect, useState } from 'react';
import { api, getCurrentUser } from '../../api/client';
import Field from '../../components/Field';
import type { BookRecord } from '../../../../shared/types';

function emptyForm() {
  return {
    title: '',
    description: '',
    imageUrl: '',
    imageAltText: '',
    price: '',
    discountedPrice: '',
    currency: 'GBP',
    stripeUrl: '',
    isActive: true,
  };
}

type BookForm = ReturnType<typeof emptyForm>;

function bookToForm(book: BookRecord): BookForm {
  return {
    title: book.title,
    description: book.description,
    imageUrl: book.imageUrl,
    imageAltText: book.imageAltText,
    price: String(book.price),
    discountedPrice: book.discountedPrice != null ? String(book.discountedPrice) : '',
    currency: book.currency,
    stripeUrl: book.stripeUrl,
    isActive: book.isActive,
  };
}

function formToPayload(form: BookForm) {
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    imageUrl: form.imageUrl.trim(),
    imageAltText: form.imageAltText.trim(),
    price: Number(form.price),
    discountedPrice: form.discountedPrice === '' ? null : Number(form.discountedPrice),
    currency: form.currency.trim() || 'GBP',
    stripeUrl: form.stripeUrl.trim(),
    isActive: form.isActive,
  };
}

function money(book: BookRecord): string {
  const symbol = book.currency === 'USD' ? '$' : book.currency === 'EUR' ? '€' : '£';
  const value = book.discountedPrice ?? book.price;
  return `${symbol}${Number(value || 0).toFixed(2)}`;
}

export default function BooksScreen() {
  const [books, setBooks] = useState<BookRecord[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<BookForm>(emptyForm());
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const isAdmin = getCurrentUser()?.role === 'admin';
  const selected = books.find(book => book.id === selectedId) ?? null;
  const showEditor = creating || selected;

  async function loadBooks() {
    setError('');
    try {
      const data = await api.get<BookRecord[]>('/books');
      setBooks(data);
      setOrderDirty(false);
      if (data.length && selectedId == null) {
        setSelectedId(data[0].id);
        setForm(bookToForm(data[0]));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load books.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadBooks(); }, []);

  function selectBook(book: BookRecord) {
    setSelectedId(book.id);
    setForm(bookToForm(book));
    setCreating(false);
    setError('');
  }

  function addBook() {
    setSelectedId(null);
    setForm(emptyForm());
    setCreating(true);
    setError('');
  }

  async function saveBook() {
    const payload = formToPayload(form);
    if (!payload.title) {
      setError('Title is required.');
      return;
    }
    if (!Number.isFinite(payload.price) || payload.price < 0) {
      setError('Price must be a valid number.');
      return;
    }
    if (payload.discountedPrice != null && (!Number.isFinite(payload.discountedPrice) || payload.discountedPrice < 0)) {
      setError('Discounted price must be a valid number.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (creating) {
        const created = await api.post<BookRecord>('/books', payload);
        setBooks(prev => [...prev, created]);
        setSelectedId(created.id);
        setForm(bookToForm(created));
        setCreating(false);
      } else if (selectedId) {
        const updated = await api.put<BookRecord>(`/books/${selectedId}`, payload);
        setBooks(prev => prev.map(book => book.id === selectedId ? updated : book));
        setForm(bookToForm(updated));
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setUploadingImage(true);
    setError('');
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(',')[1] || '';
      const result = await api.post<{ url: string }>('/books/upload-image', {
        filename: file.name,
        contentType: file.type,
        data: base64,
      });
      setForm(prev => ({
        ...prev,
        imageUrl: result.url,
        imageAltText: prev.imageAltText || prev.title,
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function deleteBook() {
    if (!selectedId) return;
    if (!window.confirm('Delete this book from the CMS database?')) return;
    try {
      await api.delete(`/books/${selectedId}`);
      const next = books.filter(book => book.id !== selectedId);
      setBooks(next);
      setSelectedId(next[0]?.id ?? null);
      setForm(next[0] ? bookToForm(next[0]) : emptyForm());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  function moveBook(sourceId: number, targetId: number) {
    if (sourceId === targetId) return;
    setBooks(prev => {
      const from = prev.findIndex(book => book.id === sourceId);
      const to = prev.findIndex(book => book.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setOrderDirty(true);
  }

  async function saveOrder() {
    setSavingOrder(true);
    setError('');
    try {
      const updated = await api.post<BookRecord[]>('/books/reorder', { ids: books.map(book => book.id) });
      setBooks(updated);
      setOrderDirty(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save book order.');
    } finally {
      setSavingOrder(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-slate-900">Books</h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Books are managed directly in the CMS database. This table is the source of truth for the BPP Books component.
            </p>
          </div>
          <button onClick={addBook} className="btn-primary shrink-0 text-xs">+ New book</button>
        </div>
        {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-[560px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="shrink-0 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Books ({books.length})
              </span>
              <button
                onClick={saveOrder}
                disabled={!orderDirty || savingOrder}
                className={`ml-auto rounded px-2 py-1 text-xs font-semibold ${
                  orderDirty
                    ? 'bg-brand text-white hover:bg-brand/90'
                    : 'cursor-default bg-slate-100 text-slate-400'
                }`}
              >
                {savingOrder ? 'Saving...' : orderDirty ? 'Save order' : 'Order saved'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">Drag rows to arrange the live BPP Books component order.</p>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            {books.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">No books saved yet in the CMS database.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="grid grid-cols-[32px_50px_1fr_58px_74px] gap-2 border-b border-slate-200 bg-slate-100 px-2 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                  <span>Order</span>
                  <span>Image</span>
                  <span>Book</span>
                  <span>Qty</span>
                  <span>Price</span>
                </div>
                {books.map((book, index) => (
                  <div
                    key={book.id}
                    draggable
                    onDragStart={event => {
                      setDraggedId(book.id);
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', String(book.id));
                    }}
                    onDragOver={event => {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = 'move';
                    }}
                    onDrop={event => {
                      event.preventDefault();
                      const sourceId = Number(event.dataTransfer.getData('text/plain')) || draggedId;
                      if (sourceId) moveBook(sourceId, book.id);
                      setDraggedId(null);
                    }}
                    onDragEnd={() => setDraggedId(null)}
                    onClick={() => selectBook(book)}
                    className={`grid w-full cursor-grab grid-cols-[32px_50px_1fr_58px_74px] gap-2 border-b px-2 py-2 text-left transition last:border-b-0 active:cursor-grabbing ${
                      book.id === selectedId
                        ? 'border-brand bg-brand text-white'
                        : draggedId === book.id
                          ? 'border-slate-200 bg-blue-50 text-slate-700 opacity-70'
                        : book.isActive
                          ? 'border-slate-200 bg-white text-slate-700 hover:bg-blue-50/60'
                        : 'border-slate-200 bg-slate-50 text-slate-400 opacity-75 hover:bg-blue-50/60'
                    }`}
                  >
                    <div className={`flex h-14 flex-col items-center justify-center rounded text-xs ${book.id === selectedId ? 'text-white/75' : 'text-slate-400'}`}>
                      <span className="leading-none">≡</span>
                      <span className="mt-1 text-[10px] font-semibold">{index + 1}</span>
                    </div>
                    <div className="h-14 w-12 overflow-hidden rounded border border-white/30 bg-slate-100">
                      {book.imageUrl ? <img src={book.imageUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold">{book.title}</p>
                        {!book.isActive && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${book.id === selectedId ? 'bg-white/15 text-white' : 'bg-slate-200 text-slate-500'}`}>
                            Archived
                          </span>
                        )}
                      </div>
                      <p className={`mt-1 line-clamp-2 text-xs ${book.id === selectedId ? 'text-white/75' : 'text-slate-400'}`}>
                        {book.description || book.imageAltText || 'No description'}
                      </p>
                    </div>
                    <div className={`flex h-14 items-center text-sm font-semibold ${book.id === selectedId ? 'text-white' : 'text-slate-700'}`}>
                      {book.quantity}
                    </div>
                    <div className={`flex h-14 items-center text-xs font-semibold ${book.id === selectedId ? 'text-white' : 'text-slate-700'}`}>
                      {money(book)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          {!showEditor ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select a book to edit its saved database fields, or add a new book.
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">{creating ? 'New Book' : 'Edit Book'}</h2>
                  <div className="flex items-center gap-2">
                    {!creating && isAdmin && <button onClick={deleteBook} className="btn-danger">Delete</button>}
                    <button onClick={saveBook} disabled={saving} className="btn-primary text-xs">
                      {saving ? 'Saving…' : creating ? 'Create book' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <div className="grid max-w-4xl grid-cols-[220px_1fr] gap-5">
                  <div className="space-y-3">
                    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      {form.imageUrl ? (
                        <img src={form.imageUrl} alt={form.imageAltText} className="aspect-[3/4] w-full object-cover" />
                      ) : (
                        <div className="flex aspect-[3/4] items-center justify-center text-xs text-slate-400">No image</div>
                      )}
                    </div>
                    <label className={`btn-ghost flex cursor-pointer justify-center text-xs ${uploadingImage ? 'opacity-60' : ''}`}>
                      {uploadingImage ? 'Uploading image...' : 'Upload image'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingImage}
                        onChange={event => {
                          const file = event.target.files?.[0];
                          if (file) uploadImage(file);
                          event.currentTarget.value = '';
                        }}
                      />
                    </label>
                  </div>

                  <div className="space-y-0">
                    <p className="section-label">Content</p>
                    <label className="mb-3 flex items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                      />
                      <span>
                        <strong>Display on website</strong>
                        <span className="ml-2 text-xs text-slate-400">Turn off to archive/disable this book.</span>
                      </span>
                    </label>
                    <Field label="Title">
                      <input className="input" value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} />
                    </Field>
                    <Field label="Description">
                      <textarea className="input min-h-[120px] resize-y" value={form.description} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} />
                    </Field>
                    <Field label="Image URL">
                      <input className="input" value={form.imageUrl} onChange={e => setForm(prev => ({ ...prev, imageUrl: e.target.value }))} />
                    </Field>
                    <Field label="Image text">
                      <input className="input" value={form.imageAltText} onChange={e => setForm(prev => ({ ...prev, imageAltText: e.target.value }))} />
                    </Field>
                    {!creating && selected && (
                      <Field label="Quantity">
                        <input className="input bg-slate-50 text-slate-500" value={selected.quantity} readOnly />
                      </Field>
                    )}

                    <p className="section-label">Pricing</p>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Currency">
                        <input className="input" value={form.currency} onChange={e => setForm(prev => ({ ...prev, currency: e.target.value }))} />
                      </Field>
                      <Field label="Price">
                        <input type="number" min={0} step="0.01" className="input" value={form.price} onChange={e => setForm(prev => ({ ...prev, price: e.target.value }))} />
                      </Field>
                      <Field label="Discounted price">
                        <input type="number" min={0} step="0.01" className="input" value={form.discountedPrice} onChange={e => setForm(prev => ({ ...prev, discountedPrice: e.target.value }))} />
                      </Field>
                    </div>

                    <p className="section-label">Checkout</p>
                    <Field label="Stripe URL">
                      <input className="input" value={form.stripeUrl} onChange={e => setForm(prev => ({ ...prev, stripeUrl: e.target.value }))} />
                    </Field>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
