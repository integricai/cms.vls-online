import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { getCurrentUser } from '../../api/client';
import Field from '../../components/Field';
import type { Course, CoursePaymentCard, CourseSyncResult } from '../../../../shared/types';

// ── Sync panel ────────────────────────────────────────────────────

function SyncPanel({ onSynced }: { onSynced: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<CourseSyncResult | null>(null);
  const [error, setError] = useState('');

  async function handleSync() {
    setSyncing(true);
    setError('');
    setResult(null);
    try {
      const data = await api.post<CourseSyncResult>('/courses/sync', {});
      setResult(data);
      onSynced();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-800">Sync Courses from Zenler</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fetches all courses from Zenler and updates the local database. Runs server-side only.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="btn-primary ml-4 shrink-0 text-xs"
        >
          {syncing ? 'Syncing…' : '↻ Sync Now'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <p className="font-semibold">Sync complete</p>
          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-4">
            <span>Fetched: <strong>{result.fetched}</strong></span>
            <span>Inserted: <strong>{result.inserted}</strong></span>
            <span>Updated: <strong>{result.updated}</strong></span>
            <span>Deactivated: <strong>{result.deactivated}</strong></span>
          </div>
          <p className="mt-1 text-emerald-700">
            Last sync: {new Date(result.syncedAt).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Empty form state ──────────────────────────────────────────────

function emptyForm() {
  return {
    courseId: 0,
    title: '',
    description: '',
    optionType: 'Full Course',
    normalPrice: '',
    discountPrice: '',
    isDiscountActive: true,
    currency: 'GBP',
    ctaButtonText: 'Pay Now',
    isActive: true,
  };
}

type CardForm = ReturnType<typeof emptyForm>;

// ── Payment card form ─────────────────────────────────────────────

function CardForm({
  form,
  courses,
  onChange,
}: {
  form: CardForm;
  courses: Course[];
  onChange: (patch: Partial<CardForm>) => void;
}) {
  return (
    <div className="space-y-0">
      <p className="section-label">Course</p>
      <Field label="Zenler Course" hint="Courses are fetched server-side from Zenler and synced locally">
        {courses.length === 0 ? (
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            No active courses found. Refresh Zenler courses first.
          </p>
        ) : (
          <select
            className="input"
            value={form.courseId}
            onChange={e => onChange({ courseId: Number(e.target.value) })}
          >
            <option value={0} disabled>— select a course —</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </Field>

      <p className="section-label">Card Content</p>
      <Field label="Title">
        <input
          className="input"
          value={form.title}
          placeholder="e.g. ACCA FA1 — Full Course Access"
          onChange={e => onChange({ title: e.target.value })}
        />
      </Field>
      <Field label="Description">
        <textarea
          className="input min-h-[80px] resize-y"
          value={form.description}
          placeholder="Optional short description shown on the card"
          onChange={e => onChange({ description: e.target.value })}
        />
      </Field>
      <Field label="Option type">
        <select
          className="input"
          value={form.optionType}
          onChange={e => onChange({ optionType: e.target.value })}
        >
          <option value="Full Course">Full Course</option>
          <option value="Revision Course">Revision Course</option>
          <option value="Mock Exam">Mock Exam</option>
          <option value="Other">Other</option>
        </select>
      </Field>

      <p className="section-label">Pricing</p>
      <div className="grid grid-cols-3 gap-2">
        <Field label="Currency">
          <input
            className="input"
            value={form.currency}
            onChange={e => onChange({ currency: e.target.value })}
          />
        </Field>
        <Field label="Normal price">
          <input
            type="number"
            min={0}
            step="0.01"
            className="input"
            value={form.normalPrice}
            onChange={e => onChange({ normalPrice: e.target.value })}
          />
        </Field>
        <Field label="Discount price" hint="Leave blank for no discount">
          <input
            type="number"
            min={0}
            step="0.01"
            className="input"
            value={form.discountPrice}
            placeholder="—"
            onChange={e => onChange({ discountPrice: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Discount active">
        <select
          className="input"
          value={String(form.isDiscountActive)}
          onChange={e => onChange({ isDiscountActive: e.target.value === 'true' })}
        >
          <option value="true">Active - use discounted price at checkout</option>
          <option value="false">Inactive - use normal price at checkout</option>
        </select>
      </Field>

      <p className="section-label">CTA</p>
      <Field label="Button text">
        <input
          className="input"
          value={form.ctaButtonText}
          onChange={e => onChange({ ctaButtonText: e.target.value })}
        />
      </Field>

      <p className="section-label">Status</p>
      <Field label="Visibility">
        <select
          className="input"
          value={String(form.isActive)}
          onChange={e => onChange({ isActive: e.target.value === 'true' })}
        >
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </Field>
    </div>
  );
}

function cardToForm(card: CoursePaymentCard): CardForm {
  return {
    courseId: card.courseId,
    title: card.title,
    description: card.description,
    optionType: card.optionType ?? 'Full Course',
    normalPrice: String(card.normalPrice),
    discountPrice: card.discountPrice != null ? String(card.discountPrice) : '',
    isDiscountActive: card.isDiscountActive,
    currency: card.currency,
    ctaButtonText: card.ctaButtonText,
    isActive: card.isActive,
  };
}

function formToPayload(form: CardForm) {
  return {
    courseId: form.courseId,
    title: form.title.trim(),
    description: form.description.trim(),
    optionType: form.optionType.trim() || null,
    normalPrice: Number(form.normalPrice),
    discountPrice: form.discountPrice !== '' ? Number(form.discountPrice) : null,
    isDiscountActive: form.isDiscountActive,
    currency: form.currency.trim() || 'GBP',
    ctaButtonText: form.ctaButtonText.trim() || 'Pay Now',
    isActive: form.isActive,
  };
}

// ── Main screen ───────────────────────────────────────────────────

export default function PaymentCardsScreen() {
  const [cards, setCards] = useState<CoursePaymentCard[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState<CardForm>(emptyForm());
  const [mode, setMode] = useState<'idle' | 'create' | 'edit'>('idle');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = getCurrentUser()?.role === 'admin';

  async function loadData() {
    try {
      if (isAdmin) await api.get<{ courses: Array<{ zenlerCourseId: string }> }>('/admin/zenler/courses').catch(() => null);
      const [cardsData, coursesData] = await Promise.all([
        api.get<CoursePaymentCard[]>('/courses/payment-cards'),
        api.get<Course[]>('/courses/active'),
      ]);
      setCards(cardsData);
      setCourses(coursesData);
    } catch {
      // errors will surface in empty states
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  function startCreate() {
    setSelectedId(null);
    setForm(emptyForm());
    setMode('create');
    setSaveError('');
  }

  function startEdit(card: CoursePaymentCard) {
    setSelectedId(card.id);
    setForm(cardToForm(card));
    setMode('edit');
    setSaveError('');
  }

  function duplicateCard(card: CoursePaymentCard) {
    setSelectedId(null);
    setForm({
      ...cardToForm(card),
      title: `${card.title} (Copy)`,
    });
    setMode('create');
    setSaveError('');
  }

  function cancelEdit() {
    setMode('idle');
    setSelectedId(null);
    setSaveError('');
  }

  async function handleSave() {
    const payload = formToPayload(form);
    if (!payload.courseId) {
      setSaveError('Please select a course.');
      return;
    }
    if (!payload.title) {
      setSaveError('Title is required.');
      return;
    }
    if (!payload.normalPrice || payload.normalPrice <= 0) {
      setSaveError('Normal price must be greater than 0.');
      return;
    }
    if (payload.isDiscountActive && (!payload.discountPrice || payload.discountPrice <= 0)) {
      setSaveError('Discounted price must be greater than 0 when the discount is active.');
      return;
    }
    if (payload.discountPrice != null && payload.discountPrice > payload.normalPrice) {
      setSaveError('Discounted price cannot be greater than the normal price.');
      return;
    }
    const selectedCourse = courses.find(course => course.id === payload.courseId);
    if (!selectedCourse) {
      setSaveError('Selected course could not be found.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const adminPayload = {
        id: mode === 'edit' ? selectedId : undefined,
        zenlerCourseId: selectedCourse.zenlerCourseId,
        courseTitle: selectedCourse.name,
        courseSlug: selectedCourse.slug,
        paymentCardTitle: payload.title,
        description: payload.description,
        optionType: payload.optionType,
        normalPrice: payload.normalPrice,
        discountedPrice: payload.discountPrice,
        isDiscountActive: payload.isDiscountActive,
        currency: payload.currency,
        buttonText: payload.ctaButtonText,
        isActive: payload.isActive,
      };
      if (mode === 'create') {
        const created = await api.post<CoursePaymentCard>('/admin/payment-options', adminPayload);
        setCards(prev => [created, ...prev]);
        setSelectedId(created.id);
        setMode('edit');
        setForm(cardToForm(created));
      } else if (mode === 'edit' && selectedId != null) {
        const updated = await api.post<CoursePaymentCard>('/admin/payment-options', adminPayload);
        setCards(prev => prev.map(c => c.id === selectedId ? updated : c));
        setForm(cardToForm(updated));
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this payment card? This cannot be undone.')) return;
    try {
      await api.delete(`/courses/payment-cards/${id}`);
      setCards(prev => prev.filter(c => c.id !== id));
      if (selectedId === id) cancelEdit();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-4">
        <h1 className="text-base font-bold text-slate-900">Payment Cards</h1>
        <p className="mt-0.5 text-xs text-slate-400">
          Database-backed payment options linked to Zenler courses. Checkout uses saved trusted prices only.
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel ── */}
        <div className="flex w-[460px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">

          {/* Sync panel (admin only) */}
          {isAdmin && (
            <div className="shrink-0 border-b border-slate-100 px-5 py-4">
              <SyncPanel onSynced={loadData} />
            </div>
          )}

          {/* Card list */}
          <div className="shrink-0 border-b border-slate-100 px-5 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Payment cards ({cards.length})
              </span>
              <button onClick={startCreate} className="btn-ghost px-2 py-1 text-xs">
                + New card
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3">
            {cards.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">
                No payment cards yet. Click "+ New card" to create one.
              </p>
            ) : (
              <div className="space-y-1">
                {cards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => startEdit(card)}
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm transition ${
                      card.id === selectedId
                        ? 'bg-brand text-white'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-brand/40'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs ${card.id === selectedId ? 'text-white/70' : 'text-slate-400'}`}
                        >
                          {card.isActive ? '●' : '○'}
                        </span>
                        <span className="truncate font-medium">{card.title}</span>
                      </div>
                      <p
                        className={`mt-0.5 truncate text-xs ${card.id === selectedId ? 'text-white/70' : 'text-slate-400'}`}
                      >
                        {card.courseName ?? `Course #${card.courseId}`} · {card.currency}{' '}
                        {card.discountPrice != null ? card.discountPrice : card.normalPrice}
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="ml-2 flex shrink-0 items-center gap-2">
                        <button
                          title="Duplicate"
                          onClick={e => { e.stopPropagation(); duplicateCard(card); }}
                          className={card.id === selectedId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-brand'}
                        >
                          ⧉
                        </button>
                        <button
                          title="Delete"
                          onClick={e => { e.stopPropagation(); handleDelete(card.id); }}
                          className={card.id === selectedId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {mode === 'idle' ? (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              Select a card to edit, or click "+ New card".
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="shrink-0 border-b border-slate-200 bg-white px-5 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-slate-900">
                    {mode === 'create' ? 'New Payment Card' : 'Edit Payment Card'}
                  </h2>
                  <div className="flex items-center gap-2">
                    <button onClick={cancelEdit} className="btn-ghost text-xs">Cancel</button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="btn-primary text-xs"
                    >
                      {saving ? 'Saving…' : mode === 'create' ? 'Create card' : 'Save changes'}
                    </button>
                  </div>
                </div>
                {saveError && (
                  <p className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">
                    {saveError}
                  </p>
                )}
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-4">
                <CardForm
                  form={form}
                  courses={courses}
                  onChange={patch => setForm(prev => ({ ...prev, ...patch }))}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
