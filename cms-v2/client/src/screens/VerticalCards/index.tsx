import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { Fc3State, Fc3Component, Fc3Content, Fc3Card, Fc3Tag } from '../../types/cms';
import { generateVerticalCardsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeTag(): Fc3Tag { return { code: '', name: '' }; }
function makeCard(): Fc3Card { return { headerBg: '#204280', number: '01', title: '', subtitle: '', tags: [] }; }
function makeDefault(): Fc3State {
  return {
    bg: '#f8faff', padTop: 60, padBottom: 60, padLeft: 80, padRight: 80, cols: 3, gap: 24,
    eyebrow: '', eyebrowColor: '#4a90d9', headingText: '', headingColor: '#1a1a1a',
    descText: '', descColor: '#4a5568',
    cardTitleStyle: normalize('', 'vc3CardTitle'),
    cardSubStyle:   normalize('', 'vc3CardSub'),
    cardItemStyle:  normalize('', 'vc3CardItem'),
    cards: [],
  };
}
function tv(v: Fc3State['cardTitleStyle'], k: 'vc3CardTitle' | 'vc3CardSub' | 'vc3CardItem') {
  return normalize(v as any, k);
}

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

export default function VerticalCardsScreen() {
  const [components, setComponents] = useState<Fc3Component[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<Fc3State>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: Fc3Content & { sections?: any[] } }>('/content/vls-vertical-cards')
      .then(row => {
        const raw = row?.data as any;
        let comps: Fc3Component[] = [];
        if (raw?.components) {
          comps = raw.components;
        } else if (raw?.sections) {
          comps = (raw.sections as any[]).map((s: any, i: number) => ({
            id: s.id || `vc-${i}`,
            name: s.name || `Section ${i + 1}`,
            data: { bg: s.bg ?? '#f8faff', padTop: s.padTop ?? 60, padBottom: s.padBottom ?? 60, padLeft: s.padLeft ?? 80, padRight: s.padRight ?? 80, cols: s.cols ?? 3, gap: s.gap ?? 24, eyebrow: s.eyebrow ?? '', eyebrowColor: s.eyebrowColor ?? '#4a90d9', headingText: s.headingText ?? '', headingColor: s.headingColor ?? '#1a1a1a', descText: s.descText ?? '', descColor: s.descColor ?? '#4a5568', cardTitleStyle: s.cardTitleStyle ?? normalize('', 'vc3CardTitle'), cardSubStyle: s.cardSubStyle ?? normalize('', 'vc3CardSub'), cardItemStyle: s.cardItemStyle ?? normalize('', 'vc3CardItem'), cards: s.cards || [] },
          }));
        }
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<Fc3State>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

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
        if (!comps.find(c => c.id === id)) { id = `vc-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `vc-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-vertical-cards', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-vertical-cards', { components: comps });
    setComponents(comps); newComponent();
  }

  async function duplicateComponent() {
    if (!activeId) return;
    const newId   = `vc-${Date.now().toString(36)}`;
    const newName = `${name} (copy)`;
    const comps   = [...components, { id: newId, name: newName, data: state }];
    await api.put('/content/vls-vertical-cards', { components: comps });
    setComponents(comps); setActiveId(newId); setName(newName); setSaved(true);
  }

  function updateCard(i: number, patch: Partial<Fc3Card>) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
  function addCard()             { upd({ cards: [...state.cards, makeCard()] }); }
  function removeCard(i: number) { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }
  function updateTag(ci: number, ti: number, patch: Partial<Fc3Tag>) { const cards = [...state.cards]; const tags = [...cards[ci].tags]; tags[ti] = { ...tags[ti], ...patch }; cards[ci] = { ...cards[ci], tags }; upd({ cards }); }
  function addTag(ci: number)    { const cards = [...state.cards]; cards[ci] = { ...cards[ci], tags: [...cards[ci].tags, makeTag()] }; upd({ cards }); }
  function removeTag(ci: number, ti: number) { const cards = [...state.cards]; cards[ci] = { ...cards[ci], tags: cards[ci].tags.filter((_, idx) => idx !== ti) }; upd({ cards }); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Vertical Cards</h1>
          <p className="text-xs text-slate-400 mt-0.5">Cards with coloured header, number badge, and item rows</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Vertical Cards', generateVerticalCardsHtml(state))); setActiveTab('preview'); }}
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
              {activeId && <button onClick={duplicateComponent} className="btn-ghost text-xs px-3">⧉ Dupe</button>}
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. ACCA Qualification Structure"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Layout */}
          <p className="section-label">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
            <Field label="Columns">
              <select className="input" value={state.cols} onChange={e => upd({ cols: Number(e.target.value) })}>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns</option>
              </select>
            </Field>
            <Field label="Gap (px)">
              <input type="number" className="input" min={0} max={80} value={state.gap} onChange={e => upd({ gap: Number(e.target.value) })} />
            </Field>
            <Field label="Pad top (px)">
              <input type="number" className="input" min={0} max={200} value={state.padTop} onChange={e => upd({ padTop: Number(e.target.value) })} />
            </Field>
            <Field label="Pad bottom (px)">
              <input type="number" className="input" min={0} max={200} value={state.padBottom} onChange={e => upd({ padBottom: Number(e.target.value) })} />
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
          <div className="grid grid-cols-2 gap-2">
            <Field label="Eyebrow text">
              <input className="input" value={state.eyebrow} placeholder="HOW ACCA IS STRUCTURED"
                onChange={e => upd({ eyebrow: e.target.value })} />
            </Field>
            <ColorRow label="Eyebrow colour" value={state.eyebrowColor} onChange={v => upd({ eyebrowColor: v })} />
            <Field label="Heading text">
              <input className="input" value={state.headingText} placeholder="ACCA Qualification Structure"
                onChange={e => upd({ headingText: e.target.value })} />
            </Field>
            <ColorRow label="Heading colour" value={state.headingColor} onChange={v => upd({ headingColor: v })} />
          </div>
          <Field label="Description">
            <textarea className="input" rows={2} value={state.descText} placeholder="Brief description…"
              onChange={e => upd({ descText: e.target.value })} />
          </Field>
          <ColorRow label="Description colour" value={state.descColor} onChange={v => upd({ descColor: v })} />

          {/* Card text styles */}
          <p className="section-label">Card Text Styles</p>
          <RichTextField label="Heading" value={tv(state.cardTitleStyle, 'vc3CardTitle')} defaultKey="vc3CardTitle"
            onChange={v => upd({ cardTitleStyle: v })} />
          <RichTextField label="Sub heading" value={tv(state.cardSubStyle, 'vc3CardSub')} defaultKey="vc3CardSub"
            onChange={v => upd({ cardSubStyle: v })} />
          <RichTextField label="Item text" value={tv(state.cardItemStyle, 'vc3CardItem')} defaultKey="vc3CardItem"
            onChange={v => upd({ cardItemStyle: v })} />

          {/* Cards */}
          <p className="section-label">Cards</p>
          <div className="space-y-3 mb-2">
            {state.cards.map((card, ci) => (
              <div key={ci} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeCard(ci)} className="btn-danger absolute right-2 top-2">✕</button>
                <ColorRow label="Header background" value={card.headerBg} onChange={v => updateCard(ci, { headerBg: v })} />
                <div className="grid grid-cols-3 gap-2">
                  <Field label="Number badge">
                    <input className="input" value={card.number} placeholder="01"
                      onChange={e => updateCard(ci, { number: e.target.value })} />
                  </Field>
                  <Field label="Title" className="col-span-2">
                    <input className="input" value={card.title} placeholder="Applied Knowledge"
                      onChange={e => updateCard(ci, { title: e.target.value })} />
                  </Field>
                </div>
                <Field label="Subtitle">
                  <input className="input" value={card.subtitle} placeholder="Foundations of accounting & business"
                    onChange={e => updateCard(ci, { subtitle: e.target.value })} />
                </Field>
                <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Items</p>
                <div className="space-y-1.5 mb-1">
                  {card.tags.map((tag, ti) => (
                    <div key={ti} className="flex gap-2 items-center">
                      <input className="input w-24 shrink-0" value={tag.code} placeholder="BT"
                        onChange={e => updateTag(ci, ti, { code: e.target.value })} />
                      <input className="input flex-1" value={tag.name} placeholder="Business and Technology"
                        onChange={e => updateTag(ci, ti, { name: e.target.value })} />
                      <button onClick={() => removeTag(ci, ti)} className="btn-danger">✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => addTag(ci)} className="btn-ghost text-xs w-full">+ Add item</button>
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
