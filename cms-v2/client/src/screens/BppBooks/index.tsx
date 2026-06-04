import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import PaddingControl from '../../components/PaddingControl';
import RichTextField from '../../components/RichTextField';
import type { BppBooksComponent, BppBooksContent, BppBooksState, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateBppBooksHtml } from './generateHtml';

type ContentResponse<T> = {
  key: string;
  data: T;
  updated_at: string;
  updated_by: number | null;
};

function makeDefault(): BppBooksState {
  return {
    bg: '#ffffff',
    padTop: 28,
    padBot: 36,
    padLeft: 24,
    padRight: 24,
    maxWidth: 1180,
    gap: 24,
    cardBg: '#ffffff',
    cardBorder: '#dfe8f7',
    topTintA: '#f7faff',
    topTintB: '#e0edff',
    imageBg: '#f3f7ff',
    filterActiveBg: '#edf4ff',
    filterActiveText: '#17335f',
    filterBorder: '#dce7f7',
    searchPlaceholder: 'Search a paper - e.g. SBR or Taxation',
    ctaText: 'Buy now',
    badgeText: '50% off',
    filterStyle: normalize('All papers', 'bppFilter'),
    metaStyle: normalize('ACCA · BT', 'bppMeta'),
    titleStyle: normalize('Business & Technology', 'bppTitle'),
    descStyle: normalize('Foundations of business, the role of the accountant and the modern organisation.', 'bppDesc'),
    priceStyle: normalize('£22.50', 'bppPrice'),
    ctaStyle: normalize('Buy now', 'bppCta'),
  };
}

function norm(raw: Partial<BppBooksState> | undefined): BppBooksState {
  const d = makeDefault();
  const r = raw || {};
  return {
    ...d,
    ...r,
    filterStyle: normalize(r.filterStyle, 'bppFilter'),
    metaStyle: normalize(r.metaStyle, 'bppMeta'),
    titleStyle: normalize(r.titleStyle, 'bppTitle'),
    descStyle: normalize(r.descStyle, 'bppDesc'),
    priceStyle: normalize(r.priceStyle, 'bppPrice'),
    ctaStyle: normalize(r.ctaStyle, 'bppCta'),
  };
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={event => onChange(event.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5"
        />
        <input
          className="input"
          value={value}
          maxLength={7}
          onChange={event => onChange(event.target.value)}
        />
      </div>
    </Field>
  );
}

function FontFormatter({ label, value, defaultKey, onChange }: {
  label: string;
  value: TextValue;
  defaultKey: Parameters<typeof normalize>[1];
  onChange: (value: TextData) => void;
}) {
  const td = normalize(value, defaultKey);
  function patch(partial: Partial<TextData>) {
    onChange({ ...td, ...partial });
  }
  return (
    <div className="mb-3">
      <label className="field-label">{label}</label>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-2">
        <div className="grid grid-cols-[70px_1fr_92px_84px] gap-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Size</span>
          <span>Color</span>
          <span>Weight</span>
          <span>Spacing</span>
        </div>
        <div className="grid grid-cols-[70px_1fr_92px_84px] gap-1.5">
          <input
            type="number"
            value={td.size}
            min={8}
            max={72}
            onChange={event => patch({ size: Number(event.target.value) })}
            className="input text-xs"
            title="Font size"
          />
          <div className="flex min-w-0 gap-1.5">
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(td.color) ? td.color : '#000000'}
              onChange={event => patch({ color: event.target.value })}
              className="h-8 w-9 shrink-0 cursor-pointer rounded border border-slate-200 p-0"
              title="Text colour"
            />
            <input
              value={td.color}
              maxLength={7}
              onChange={event => patch({ color: event.target.value })}
              className="input min-w-0 text-xs"
            />
          </div>
          <select value={td.weight} onChange={event => patch({ weight: event.target.value })} className="input text-xs">
            <option value="400">Regular</option>
            <option value="500">Medium</option>
            <option value="600">Semi</option>
            <option value="700">Bold</option>
            <option value="800">Extra</option>
          </select>
          <input
            type="number"
            value={td.letterSpacing}
            min={0}
            max={0.3}
            step={0.01}
            onChange={event => patch({ letterSpacing: Number(event.target.value) })}
            className="input text-xs"
            title="Letter spacing"
          />
        </div>
      </div>
    </div>
  );
}

export default function BppBooks() {
  const [components, setComponents] = useState<BppBooksComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('BPP Books');
  const [state, setState] = useState<BppBooksState>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<ContentResponse<BppBooksContent>>('/content/vls-bpp-books-components')
      .then(row => {
        const comps = Array.isArray(row?.data?.components)
          ? row.data.components.map(component => ({ ...component, data: norm(component.data) }))
          : [];
        setComponents(comps);
        if (comps[0]) {
          setActiveId(comps[0].id);
          setName(comps[0].name);
          setState(comps[0].data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<BppBooksState>) => {
    setState(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  function load(id: string) {
    if (!id) {
      setActiveId(null);
      setName('BPP Books');
      setState(makeDefault());
      setSaved(false);
      return;
    }
    const component = components.find(item => item.id === id);
    if (!component) return;
    setActiveId(component.id);
    setName(component.name);
    setState(norm(component.data));
    setSaved(false);
  }

  function duplicate() {
    setActiveId(null);
    setName(`${name || 'BPP Books'} Copy`);
    setState(JSON.parse(JSON.stringify(state)) as BppBooksState);
    setSaved(false);
  }

  async function save(): Promise<string | null> {
    if (!name.trim()) {
      alert('Enter a component name.');
      return null;
    }
    setSaving(true);
    try {
      const id = activeId || `bpp-books-${Date.now().toString(36)}`;
      const next = activeId
        ? components.map(component => component.id === id ? { id, name, data: state } : component)
        : [...components, { id, name, data: state }];
      await api.put('/content/vls-bpp-books-components', { components: next });
      setComponents(next);
      setActiveId(id);
      setSaved(true);
      return id;
    } finally {
      setSaving(false);
    }
  }

  async function deleteComponent() {
    if (!activeId || !window.confirm('Delete this BPP Books component?')) return;
    const next = components.filter(component => component.id !== activeId);
    await api.put('/content/vls-bpp-books-components', { components: next });
    setComponents(next);
    setActiveId(null);
    setName('BPP Books');
    setState(makeDefault());
    setSaved(false);
  }

  async function generate() {
    await save();
    setPreviewHtml(wrapGeneratedHtml('BPP Books', generateBppBooksHtml(state)));
    setActiveTab('preview');
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">BPP Books</h1>
          <p className="mt-0.5 text-xs text-slate-400">Database-backed BPP book cards with filters, search and pagination.</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3">
          <div className="mb-3 flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
            </button>
            <button onClick={generate} className="btn-success flex-1 justify-center">Generate HTML</button>
          </div>
          <div className="flex gap-2">
            <select className="input flex-1" value={activeId || ''} onChange={event => load(event.target.value)}>
              <option value="">New component</option>
              {components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}
            </select>
            <button onClick={duplicate} className="btn-ghost px-3 text-xs">Duplicate</button>
            {activeId && <button onClick={deleteComponent} className="btn-danger px-3 text-xs">Delete</button>}
          </div>
          <Field label="Component name">
            <input className="input" value={name} onChange={event => { setName(event.target.value); setSaved(false); }} />
          </Field>
        </div>

        <div className="px-5 py-4">
          <p className="section-label">Layout</p>
          <PaddingControl value={state} onChange={upd} columns={4} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max width">
              <input type="number" className="input" min={720} max={1800} value={state.maxWidth} onChange={event => upd({ maxWidth: Number(event.target.value) })} />
            </Field>
            <Field label="Card gap">
              <input type="number" className="input" min={12} max={60} value={state.gap} onChange={event => upd({ gap: Number(event.target.value) })} />
            </Field>
          </div>

          <p className="section-label">Colours</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Component background" value={state.bg} onChange={value => upd({ bg: value })} />
            <ColorInput label="Card background" value={state.cardBg} onChange={value => upd({ cardBg: value })} />
            <ColorInput label="Card border" value={state.cardBorder} onChange={value => upd({ cardBorder: value })} />
            <ColorInput label="Image background" value={state.imageBg} onChange={value => upd({ imageBg: value })} />
            <ColorInput label="Card tint 1" value={state.topTintA} onChange={value => upd({ topTintA: value })} />
            <ColorInput label="Card tint 2" value={state.topTintB} onChange={value => upd({ topTintB: value })} />
            <ColorInput label="Active filter bg" value={state.filterActiveBg} onChange={value => upd({ filterActiveBg: value })} />
            <ColorInput label="Active filter text" value={state.filterActiveText} onChange={value => upd({ filterActiveText: value })} />
            <ColorInput label="Control border" value={state.filterBorder} onChange={value => upd({ filterBorder: value })} />
          </div>

          <p className="section-label">Labels</p>
          <Field label="Search placeholder">
            <input className="input" value={state.searchPlaceholder} onChange={event => upd({ searchPlaceholder: event.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Badge text">
              <input className="input" value={state.badgeText} onChange={event => upd({ badgeText: event.target.value })} />
            </Field>
            <RichTextField label="CTA text" value={normalize(state.ctaStyle, 'bppCta')} defaultKey="bppCta" onChange={value => upd({ ctaStyle: value, ctaText: value.text })} />
          </div>

          <p className="section-label">Font Formatters</p>
          <FontFormatter label="Filter and search" value={state.filterStyle} defaultKey="bppFilter" onChange={value => upd({ filterStyle: value })} />
          <FontFormatter label="Meta and level" value={state.metaStyle} defaultKey="bppMeta" onChange={value => upd({ metaStyle: value })} />
          <FontFormatter label="Book title" value={state.titleStyle} defaultKey="bppTitle" onChange={value => upd({ titleStyle: value })} />
          <FontFormatter label="Description" value={state.descStyle} defaultKey="bppDesc" onChange={value => upd({ descStyle: value })} />
          <FontFormatter label="Price" value={state.priceStyle} defaultKey="bppPrice" onChange={value => upd({ priceStyle: value })} />
          <FontFormatter label="CTA" value={state.ctaStyle} defaultKey="bppCta" onChange={value => upd({ ctaStyle: value, ctaText: value.text })} />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            title="bpp-books-preview"
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click Generate HTML to preview.</p>'}
            className="w-full flex-1 border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">{previewHtml || '// Click Generate HTML first'}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
