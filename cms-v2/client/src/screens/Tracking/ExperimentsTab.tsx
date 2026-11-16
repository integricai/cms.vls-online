import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import ExperimentResults from './ExperimentResults';
import {
  parseExperimentInput,
  type ExperimentInput,
  type ExperimentRecord,
  type ExperimentStatus,
} from '../../../../shared/experiments';

type VariantDraft = {
  key: string;
  label: string;
  path: string;
  weight: string;
};

type EditorDraft = {
  name: string;
  entryPath: string;
  variants: VariantDraft[];
};

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F'];

let variantKey = 0;

function nextKey(): string {
  variantKey += 1;
  return `variant-${variantKey}`;
}

function emptyDraft(): EditorDraft {
  return {
    name: '',
    entryPath: '',
    variants: [
      { key: nextKey(), label: 'A', path: '', weight: '50' },
      { key: nextKey(), label: 'B', path: '', weight: '50' },
    ],
  };
}

function draftFromRecord(record: ExperimentRecord): EditorDraft {
  return {
    name: record.name,
    entryPath: record.entryPath,
    variants: record.variants
      .slice()
      .sort((left, right) => left.position - right.position)
      .map(variant => ({
        key: `saved-${variant.id}`,
        label: variant.label,
        path: variant.path,
        weight: String(variant.weight),
      })),
  };
}

function nextLabel(variants: VariantDraft[]): string {
  const used = new Set(variants.map(variant => variant.label.trim().toUpperCase()));
  return LABELS.find(label => !used.has(label)) ?? 'Page';
}

function statusLabel(status: ExperimentStatus): string {
  if (status === 'running') return 'Running';
  if (status === 'ended') return 'Ended';
  return 'Draft';
}

function statusClass(status: ExperimentStatus): string {
  if (status === 'running') return 'bg-green-100 text-green-800';
  if (status === 'ended') return 'bg-slate-200 text-slate-600';
  return 'bg-amber-100 text-amber-800';
}

function formatWhen(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function draftMatches(record: ExperimentRecord, value: ExperimentInput): boolean {
  const variants = record.variants.slice().sort((left, right) => left.position - right.position);
  return value.name === record.name
    && value.entryPath === record.entryPath
    && value.variants.length === variants.length
    && value.variants.every((variant, index) => (
      variant.label === variants[index]?.label
      && variant.path === variants[index]?.path
      && variant.weight === variants[index]?.weight
    ));
}

function payload(draft: EditorDraft) {
  return {
    name: draft.name,
    entryPath: draft.entryPath,
    variants: draft.variants.map(variant => ({
      label: variant.label,
      path: indexPath(draft, variant),
      weight: variant.weight.trim(),
    })),
  };
}

function indexPath(draft: EditorDraft, variant: VariantDraft): string {
  return draft.variants[0]?.key === variant.key ? draft.entryPath : variant.path;
}

export default function ExperimentsTab() {
  const [experiments, setExperiments] = useState<ExperimentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedId, setSelectedId] = useState<number | 'new' | null>(null);
  const [draft, setDraft] = useState<EditorDraft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const selected = selectedId === 'new'
    ? null
    : experiments.find(experiment => experiment.id === selectedId) ?? null;
  const locked = selected != null && selected.status !== 'draft';

  useEffect(() => {
    let cancelled = false;
    api.get<ExperimentRecord[]>('/experiments')
      .then(rows => {
        if (!cancelled) setExperiments(rows);
      })
      .catch(err => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Could not load experiments');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function openNew() {
    setFormError('');
    setSelectedId('new');
    setDraft(emptyDraft());
  }

  function openRecord(record: ExperimentRecord) {
    setFormError('');
    setSelectedId(record.id);
    setDraft(draftFromRecord(record));
  }

  function replaceRecord(record: ExperimentRecord) {
    setExperiments(current => {
      const rest = current.filter(item => item.id !== record.id);
      return [record, ...rest].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });
    setSelectedId(record.id);
    setDraft(draftFromRecord(record));
  }

  function setEntryPath(value: string) {
    setDraft(current => ({
      ...current,
      entryPath: value,
      variants: current.variants.map((variant, index) => (
        index === 0 ? { ...variant, path: value } : variant
      )),
    }));
  }

  function updateVariant(key: string, patch: Partial<VariantDraft>) {
    setDraft(current => ({
      ...current,
      variants: current.variants.map(variant => (
        variant.key === key ? { ...variant, ...patch } : variant
      )),
    }));
  }

  function addVariant() {
    setDraft(current => {
      if (current.variants.length >= LABELS.length) return current;
      return {
        ...current,
        variants: [
          ...current.variants,
          { key: nextKey(), label: nextLabel(current.variants), path: '', weight: '' },
        ],
      };
    });
  }

  function removeVariant(key: string) {
    setDraft(current => ({
      ...current,
      variants: current.variants.filter(variant => variant.key !== key),
    }));
  }

  async function save() {
    const parsed = parseExperimentInput(payload(draft));
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const saved = selected
        ? await api.put<ExperimentRecord>(`/experiments/${selected.id}`, parsed.value)
        : await api.post<ExperimentRecord>('/experiments', parsed.value);
      replaceRecord(saved);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save the experiment');
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!selected || selected.status !== 'draft') return;
    const parsed = parseExperimentInput(payload(draft));
    if (!parsed.ok) {
      setFormError(parsed.error);
      return;
    }
    if (!window.confirm('Activate this test? New visitors to the entry URL will be split across these pages.')) return;
    setSaving(true);
    setFormError('');
    try {
      const saved = draftMatches(selected, parsed.value)
        ? selected
        : await api.put<ExperimentRecord>(`/experiments/${selected.id}`, parsed.value);
      replaceRecord(saved);
      replaceRecord(await api.post<ExperimentRecord>(`/experiments/${saved.id}/activate`, {}));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not activate the experiment');
    } finally {
      setSaving(false);
    }
  }

  async function endTest() {
    if (!selected || selected.status !== 'running') return;
    if (!window.confirm('End this test? The entry URL will stop splitting traffic.')) return;
    setSaving(true);
    setFormError('');
    try {
      replaceRecord(await api.post<ExperimentRecord>(`/experiments/${selected.id}/end`, {}));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not end the experiment');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selected || selected.status !== 'draft') return;
    if (!window.confirm('Delete this draft?')) return;
    setSaving(true);
    setFormError('');
    try {
      await api.delete<{ id: number }>(`/experiments/${selected.id}`);
      setExperiments(current => current.filter(item => item.id !== selected.id));
      setSelectedId(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete the experiment');
    } finally {
      setSaving(false);
    }
  }

  const weightTotal = draft.variants.reduce((sum, variant) => sum + (Number(variant.weight) || 0), 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(16rem,22rem)_minmax(0,1fr)]">
      <section className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Tests</h2>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={openNew}>
            New test
          </button>
        </div>
        {loading ? <p className="px-4 py-6 text-sm text-slate-500">Loading experiments…</p> : null}
        {loadError ? <p className="px-4 py-6 text-sm text-red-600">{loadError}</p> : null}
        {!loading && !loadError && experiments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No experiments yet.</p>
        ) : null}
        <ul className="divide-y divide-slate-100">
          {experiments.map(experiment => (
            <li key={experiment.id}>
              <button
                type="button"
                onClick={() => openRecord(experiment)}
                className={`block w-full px-4 py-3 text-left transition hover:bg-slate-50 ${
                  selectedId === experiment.id ? 'bg-blue-50' : ''
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">{experiment.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(experiment.status)}`}>
                    {statusLabel(experiment.status)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-xs text-slate-500">{experiment.entryPath}</span>
                <span className="mt-1 block text-xs text-slate-500">
                  {experiment.variants.map(variant => `${variant.label} ${variant.weight}%`).join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedId == null ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-sm text-slate-500">
          Create a test or open one from the list. The first page uses the entry URL. The other pages are the variants visitors can be sent to.
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {selected ? selected.name : 'New test'}
              </h2>
              {selected ? (
                <p className="mt-1 text-xs text-slate-500">
                  {selected.startedAt ? `Started ${formatWhen(selected.startedAt)}` : 'Not started'}
                  {selected.endedAt ? ` · Ended ${formatWhen(selected.endedAt)}` : ''}
                </p>
              ) : null}
            </div>
            {selected ? (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass(selected.status)}`}>
                {statusLabel(selected.status)}
              </span>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-slate-500">
              Name
              <input
                className="input mt-1"
                value={draft.name}
                disabled={locked}
                maxLength={80}
                onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Entry URL
              <input
                className="input mt-1"
                value={draft.entryPath}
                disabled={locked}
                placeholder="/acca"
                onChange={event => setEntryPath(event.target.value)}
              />
            </label>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Use a path such as /acca, or paste a vls-online.com URL. The first page stays on the entry URL.
          </p>

          <div className="mt-5 space-y-2">
            <div className="grid grid-cols-[5rem_minmax(0,1fr)_5.5rem_2rem] gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span>Label</span>
              <span>Page URL</span>
              <span>Traffic</span>
              <span />
            </div>
            {draft.variants.map((variant, index) => (
              <div key={variant.key} className="grid grid-cols-[5rem_minmax(0,1fr)_5.5rem_2rem] items-center gap-2">
                <input
                  className="input"
                  value={variant.label}
                  disabled={locked}
                  aria-label={`Label for page ${index + 1}`}
                  onChange={event => updateVariant(variant.key, { label: event.target.value })}
                />
                <input
                  className="input"
                  value={index === 0 ? draft.entryPath : variant.path}
                  disabled={locked || index === 0}
                  placeholder={index === 0 ? '/acca' : '/acca-v2'}
                  aria-label={`URL for page ${index + 1}`}
                  onChange={event => updateVariant(variant.key, { path: event.target.value })}
                />
                <input
                  className="input"
                  inputMode="numeric"
                  value={variant.weight}
                  disabled={locked}
                  aria-label={`Traffic percentage for page ${index + 1}`}
                  onChange={event => updateVariant(variant.key, { weight: event.target.value })}
                />
                {index > 0 && !locked && draft.variants.length > 2 ? (
                  <button
                    type="button"
                    className="btn-danger justify-center px-0"
                    aria-label={`Remove page ${variant.label || index + 1}`}
                    onClick={() => removeVariant(variant.key)}
                  >
                    ✕
                  </button>
                ) : <span />}
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            {!locked && draft.variants.length < LABELS.length ? (
              <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={addVariant}>
                Add page
              </button>
            ) : <span />}
            <p className={`text-xs font-semibold ${weightTotal === 100 ? 'text-slate-500' : 'text-red-600'}`}>
              Total {weightTotal}%
            </p>
          </div>

          {formError ? <p className="mt-4 text-sm text-red-600">{formError}</p> : null}

          <div className="mt-5 flex flex-wrap gap-2">
            {!locked ? (
              <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? 'Saving…' : 'Save draft'}
              </button>
            ) : null}
            {selected?.status === 'draft' ? (
              <button type="button" className="btn-success" disabled={saving} onClick={() => void activate()}>
                Activate
              </button>
            ) : null}
            {selected?.status === 'running' ? (
              <button type="button" className="btn-ghost" disabled={saving} onClick={() => void endTest()}>
                End test
              </button>
            ) : null}
            {selected?.status === 'draft' ? (
              <button type="button" className="btn-danger text-sm" disabled={saving} onClick={() => void remove()}>
                Delete draft
              </button>
            ) : null}
          </div>
          {selected && selected.status !== 'draft' ? (
            <ExperimentResults key={`${selected.id}-${selected.status}`} experimentId={selected.id} />
          ) : null}
          <p className="mt-4 text-xs text-slate-500">
            {selected?.status === 'running'
              ? 'Pages and weights stay fixed while the test is running.'
              : selected?.status === 'ended'
                ? 'This test has ended. Create a new test to run another split.'
                : 'Traffic splits after the Cloudflare worker is connected. Until then, activating stores the test.'}
          </p>
        </section>
      )}
    </div>
  );
}
