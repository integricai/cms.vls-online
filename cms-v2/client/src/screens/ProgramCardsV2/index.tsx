import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { Pcv2State, Pcv2Component, Pcv2Content, Pcv2Card, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateProgramCardsV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeCard(): Pcv2Card {
  return { id: `pcv2c-${Date.now().toString(36)}`, imageUrl: '', imageAlt: '', accent: '#1f73b7', ctaBg: '#0d1f3c', tagBg: '#e4f2ff', cardBg: '#ffffff', eyebrow: normalize('', 'pcv2Eyebrow'), title: normalize('', 'pcv2Title'), desc: normalize('', 'pcv2Desc'), chips: '', meta: normalize('', 'pcv2Meta'), cta: normalize('Learn More →', 'pcv2Cta'), url: '#' };
}
function makeDefault(): Pcv2State {
  return { bg: '#ffffff', maxWidth: 930, gap: 16, cards: [] };
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

export default function ProgramCardsV2Screen() {
  const [components, setComponents] = useState<Pcv2Component[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<Pcv2State>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: Pcv2Content & { collections?: any[] } }>('/content/vls-program-cards-v2')
      .then(row => {
        const raw = row?.data as any;
        let comps: Pcv2Component[] = [];
        if (raw?.components) {
          comps = raw.components;
        } else if (raw?.collections) {
          comps = (raw.collections as any[]).map((col: any, i: number) => ({
            id: col.id || `pcv2-${i}`,
            name: col.name || `Collection ${i + 1}`,
            data: { bg: col.bg ?? '#ffffff', maxWidth: col.maxWidth ?? 930, gap: col.gap ?? 16, cards: col.cards || [] },
          }));
        }
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<Pcv2State>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }
  function duplicateComponent() {
    setActiveId(null);
    setName(name ? `${name} (Copy)` : 'Program Cards V2 Copy');
    setState(JSON.parse(JSON.stringify(state)) as Pcv2State);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `pcv2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `pcv2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-program-cards-v2', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-program-cards-v2', { components: comps });
    setComponents(comps); newComponent();
  }

  function updateCard(i: number, patch: Partial<Pcv2Card>) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
  function addCard()           { upd({ cards: [...state.cards, makeCard()] }); }
  function removeCard(i: number) { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Program Cards v2</h1>
          <p className="text-xs text-slate-400 mt-0.5">Horizontal cards — image left, content right, chips &amp; CTA</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Program Cards V2', generateProgramCardsV2Html(state))); setActiveTab('preview'); }}
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
              <input className="input" value={name} placeholder="e.g. ACCA Programs"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Layout */}
          <p className="section-label">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
            <Field label="Max width (px)">
              <input type="number" className="input" min={520} max={1400} value={state.maxWidth} onChange={e => upd({ maxWidth: Number(e.target.value) })} />
            </Field>
            <Field label="Card gap (px)">
              <input type="number" className="input" min={0} max={60} value={state.gap} onChange={e => upd({ gap: Number(e.target.value) })} />
            </Field>
          </div>

          {/* Cards */}
          <p className="section-label">Cards</p>
          <div className="space-y-3 mb-2">
            {state.cards.map((card, i) => (
              <div key={card.id || i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeCard(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <Field label="Image URL">
                  <input className="input" value={card.imageUrl} placeholder="https://…"
                    onChange={e => updateCard(i, { imageUrl: e.target.value })} />
                </Field>
                <Field label="Image alt text">
                  <input className="input" value={card.imageAlt} placeholder="Descriptive alt text"
                    onChange={e => updateCard(i, { imageAlt: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <ColorRow label="Accent" value={card.accent} onChange={v => updateCard(i, { accent: v })} />
                  <ColorRow label="CTA background" value={card.ctaBg} onChange={v => updateCard(i, { ctaBg: v })} />
                  <ColorRow label="Tag background" value={card.tagBg} onChange={v => updateCard(i, { tagBg: v })} />
                  <ColorRow label="Card background" value={card.cardBg} onChange={v => updateCard(i, { cardBg: v })} />
                </div>
                <RichTextField label="Eyebrow badge" value={asTV(card.eyebrow, 'pcv2Eyebrow')} defaultKey="pcv2Eyebrow"
                  onChange={v => updateCard(i, { eyebrow: v })} />
                <RichTextField label="Title" value={asTV(card.title, 'pcv2Title')} defaultKey="pcv2Title"
                  onChange={v => updateCard(i, { title: v })} />
                <RichTextField label="Description" value={asTV(card.desc, 'pcv2Desc')} defaultKey="pcv2Desc"
                  onChange={v => updateCard(i, { desc: v })} multiline />
                <Field label="Feature chips (one per line)">
                  <textarea className="input" rows={3} value={card.chips} placeholder={'Full syllabus videos\nPractice kit\nMock exam'}
                    onChange={e => updateCard(i, { chips: e.target.value })} />
                </Field>
                <RichTextField label="Meta line" value={asTV(card.meta, 'pcv2Meta')} defaultKey="pcv2Meta"
                  onChange={v => updateCard(i, { meta: v })} />
                <RichTextField label="CTA text" value={asTV(card.cta, 'pcv2Cta')} defaultKey="pcv2Cta"
                  onChange={v => updateCard(i, { cta: v })} />
                <Field label="Card URL">
                  <input className="input" value={card.url} placeholder="https://…"
                    onChange={e => updateCard(i, { url: e.target.value })} />
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
