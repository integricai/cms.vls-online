import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { StepsState, StepsComponent, StepsContent, StepCard } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateStepCardsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeCard(): StepCard {
  return { title: normalize('', 'stepsCardTitle'), desc: normalize('', 'stepsCard') };
}
function makeDefault(): StepsState {
  return { bg: '#f7f6f1', padLeft: 32, padRight: 32, cols: 4, eyebrow: normalize('', 'stepsEyebrow'), title: normalize('', 'stepsTitle'), desc: normalize('', 'stepsSection'), cards: [] };
}
function asTV<K extends Parameters<typeof normalize>[1]>(v: Parameters<typeof normalize>[0], key: K) { return normalize(v, key); }

export default function StepCardsScreen() {
  const [components, setComponents] = useState<StepsComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<StepsState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: StepsContent & { sections?: any[] } }>('/content/vls-steps-sections')
      .then(row => {
        const raw = row?.data as any;
        let comps: StepsComponent[] = [];
        if (raw?.components) {
          comps = raw.components;
        } else if (raw?.sections) {
          comps = (raw.sections as any[]).map((s: any, i: number) => ({
            id: s.id || `steps-${i}`,
            name: s.name || `Section ${i + 1}`,
            data: { bg: s.bg ?? '#f7f6f1', padLeft: s.padLeft ?? 32, padRight: s.padRight ?? 32, cols: s.cols ?? 4, eyebrow: s.eyebrow ?? '', title: s.title ?? '', desc: s.desc ?? '', cards: s.cards || [] },
          }));
        }
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<StepsState>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `steps-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `steps-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-steps-sections', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-steps-sections', { components: comps });
    setComponents(comps); newComponent();
  }

  function updateCard(i: number, patch: Partial<StepCard>) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
  function addCard()              { upd({ cards: [...state.cards, makeCard()] }); }
  function removeCard(i: number)  { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Step Cards</h1>
          <p className="text-xs text-slate-400 mt-0.5">Numbered step cards in a configurable grid</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Step Cards', generateStepCardsHtml(state))); setActiveTab('preview'); }}
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
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. How It Works"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Layout */}
          <p className="section-label">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Background colour">
              <div className="flex gap-2 items-center">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(state.bg) ? state.bg : '#f7f6f1'} onChange={e => upd({ bg: e.target.value })}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                <input type="text" value={state.bg} className="input"
                  onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) upd({ bg: e.target.value }); }} />
              </div>
            </Field>
            <Field label="Columns (1–6)">
              <select className="input" value={state.cols} onChange={e => upd({ cols: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} column{n > 1 ? 's' : ''}</option>)}
              </select>
            </Field>
            <Field label="Pad left (px)">
              <input type="number" className="input" min={0} max={200} value={state.padLeft} onChange={e => upd({ padLeft: Number(e.target.value) })} />
            </Field>
            <Field label="Pad right (px)">
              <input type="number" className="input" min={0} max={200} value={state.padRight} onChange={e => upd({ padRight: Number(e.target.value) })} />
            </Field>
          </div>

          {/* Section header */}
          <p className="section-label">Section Header (optional)</p>
          <RichTextField label="Eyebrow" value={asTV(state.eyebrow, 'stepsEyebrow')} defaultKey="stepsEyebrow"
            onChange={v => upd({ eyebrow: v })} />
          <RichTextField label="Title" value={asTV(state.title, 'stepsTitle')} defaultKey="stepsTitle"
            onChange={v => upd({ title: v })} />
          <RichTextField label="Description" value={asTV(state.desc, 'stepsSection')} defaultKey="stepsSection"
            onChange={v => upd({ desc: v })} multiline />

          {/* Cards */}
          <p className="section-label">Steps</p>
          <div className="space-y-3 mb-2">
            {state.cards.map((card, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white shrink-0">{i + 1}</span>
                  <span className="text-xs font-semibold text-slate-500">Step {i + 1}</span>
                  <button onClick={() => removeCard(i)} className="btn-danger ml-auto">✕</button>
                </div>
                <RichTextField label="Title" value={asTV(card.title, 'stepsCardTitle')} defaultKey="stepsCardTitle"
                  onChange={v => updateCard(i, { title: v })} />
                <RichTextField label="Description" value={asTV(card.desc, 'stepsCard')} defaultKey="stepsCard"
                  onChange={v => updateCard(i, { desc: v })} multiline />
              </div>
            ))}
          </div>
          <button onClick={addCard} className="btn-ghost text-xs w-full mb-4">+ Add step</button>
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
