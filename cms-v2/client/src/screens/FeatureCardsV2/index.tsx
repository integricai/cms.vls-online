import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { Fc2State, Fc2Component, Fc2Content, Fc2Card, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateFeatureCardsV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeCard(): Fc2Card {
  return { lineColor: '#204280', title: normalize('', 'fc2Title'), desc: normalize('', 'fc2Desc'), ctaText: normalize('', 'fc2Cta'), ctaUrl: '#' };
}
function makeDefault(): Fc2State {
  return { bg: '#f0f4f8', sepColor: '#204280', padTop: 60, padBottom: 60, padLeft: 0, padRight: 0, cols: 3, cards: [] };
}
function asTV(v: TextValue | undefined, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
        <input type="text" value={value} className="input"
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

export default function FeatureCardsV2Screen() {
  const [components, setComponents] = useState<Fc2Component[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<Fc2State>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: Fc2Content & { sections?: any[] } }>('/content/vls-feature-cards-2')
      .then(row => {
        const raw = row?.data as any;
        let comps: Fc2Component[] = [];
        if (raw?.components) {
          comps = raw.components;
        } else if (raw?.sections) {
          comps = (raw.sections as any[]).map((s: any, i: number) => ({
            id: s.id || `fc2-${i}`,
            name: s.name || `Section ${i + 1}`,
            data: { bg: s.bg ?? '#f0f4f8', sepColor: s.sepColor ?? '#204280', padTop: s.padTop ?? 60, padBottom: s.padBottom ?? 60, padLeft: s.padLeft ?? 0, padRight: s.padRight ?? 0, cols: s.cols ?? 3, cards: s.cards || [] },
          }));
        }
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<Fc2State>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }
  function duplicateComponent() {
    setActiveId(null);
    setName(name ? `${name} (Copy)` : 'Feature Cards V2 Copy');
    setState(JSON.parse(JSON.stringify(state)) as Fc2State);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `fc2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `fc2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-feature-cards-2', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-feature-cards-2', { components: comps });
    setComponents(comps); newComponent();
  }

  function updateCard(i: number, patch: Partial<Fc2Card>) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
  function addCard()           { upd({ cards: [...state.cards, makeCard()] }); }
  function removeCard(i: number) { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Feature Card v2</h1>
          <p className="text-xs text-slate-400 mt-0.5">Centered grid with dotted dividers, uppercase titles &amp; bordered CTAs</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Feature Cards V2', generateFeatureCardsV2Html(state))); setActiveTab('preview'); }}
            className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4">
          {/* Component manager */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
            <p className="section-label mt-0">Saved Components</p>
            <div className="flex gap-2 mb-3">
              <select className="input flex-1" value={activeId || ''} onChange={e => loadComponent(e.target.value)}>
                <option value="">— select to load —</option>
                {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={newComponent} className="btn-ghost text-xs px-3">+ New</button>
              <button onClick={duplicateComponent} disabled={!name && state.cards.length === 0} className="btn-ghost text-xs px-3">Duplicate</button>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. Course Features"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Layout */}
          <p className="section-label">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
            <ColorRow label="Separator colour" value={state.sepColor} onChange={v => upd({ sepColor: v })} />
            <Field label="Padding top (px)">
              <input type="number" className="input" min={0} max={200} value={state.padTop} onChange={e => upd({ padTop: Number(e.target.value) })} />
            </Field>
            <Field label="Padding bottom (px)">
              <input type="number" className="input" min={0} max={200} value={state.padBottom} onChange={e => upd({ padBottom: Number(e.target.value) })} />
            </Field>
            <Field label="Padding left (px)">
              <input type="number" className="input" min={0} max={200} value={state.padLeft} onChange={e => upd({ padLeft: Number(e.target.value) })} />
            </Field>
            <Field label="Padding right (px)">
              <input type="number" className="input" min={0} max={200} value={state.padRight} onChange={e => upd({ padRight: Number(e.target.value) })} />
            </Field>
            <Field label="Columns">
              <select className="input" value={state.cols} onChange={e => upd({ cols: Number(e.target.value) })}>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns</option>
              </select>
            </Field>
          </div>

          {/* Cards */}
          <p className="section-label">Cards</p>
          <div className="space-y-2 mb-2">
            {state.cards.map((card, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeCard(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <ColorRow label="Accent line colour" value={card.lineColor} onChange={v => updateCard(i, { lineColor: v })} />
                <RichTextField label="Title" value={asTV(card.title, 'fc2Title')} defaultKey="fc2Title"
                  onChange={v => updateCard(i, { title: v })} />
                <RichTextField label="Description" value={asTV(card.desc, 'fc2Desc')} defaultKey="fc2Desc"
                  onChange={v => updateCard(i, { desc: v })} multiline />
                <RichTextField label="CTA text" value={asTV(card.ctaText, 'fc2Cta')} defaultKey="fc2Cta"
                  onChange={v => updateCard(i, { ctaText: v })} />
                <Field label="CTA URL">
                  <input className="input" value={card.ctaUrl} placeholder="https://…"
                    onChange={e => updateCard(i, { ctaUrl: e.target.value })} />
                </Field>
              </div>
            ))}
          </div>
          <button onClick={addCard} className="btn-ghost text-xs w-full mb-4">+ Add card</button>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'}
            className="flex-1 w-full border-0 bg-slate-50" sandbox="allow-same-origin allow-scripts" />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click ⚡ Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
