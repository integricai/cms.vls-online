import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { HeroV2State, HeroV2Component, HeroV2Content, HeroV2Cta, HeroV2Stat, HeroV2RCard, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateHeroV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeDefault(): HeroV2State {
  return {
    bg: '#0d1f3c', leftW: 55,
    padTop: 80, padBot: 80, padLeft: 60, padRight: 60,
    dotColor: '#4a90d9', hlColor: '#4a90d9', tagBg: '#1e3550', tagTc: '#94a3b8', cardBg: '#1e3550',
    eyebrow:   normalize('', 'h2Eyebrow'),
    heading:   normalize('', 'h2Heading'),
    highlight: normalize('', 'h2Highlight'),
    body:      normalize('', 'h2Body'),
    tags: [], ctas: [], stats: [], rcards: [],
  };
}

function makeCta(): HeroV2Cta {
  return { text: '', url: '#', scroll: '', style: 'solid', bg: '#1e3a5f', tc: '#ffffff', bc: '#ffffff' };
}
function makeStat(): HeroV2Stat { return { value: '', label: '' }; }
function makeRCard(): HeroV2RCard { return { type: 'info', icon: '1', iconBg: '#1a56a3', title: '', subtitle: '', count: '', url: '#', tags: [] }; }

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

function asTV(v: TextValue | undefined, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

export default function HeroSectionV2Screen() {
  const [components, setComponents] = useState<HeroV2Component[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<HeroV2State>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: HeroV2Content }>('/content/vls-hero2-components')
      .then(row => {
        const comps = (row?.data as HeroV2Content)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<HeroV2State>) => {
    setState(prev => ({ ...prev, ...patch })); setSaved(false);
  }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }
  function duplicateComponent() {
    setActiveId(null);
    setName(name ? `${name} (Copy)` : 'Hero Section V2 Copy');
    setState(JSON.parse(JSON.stringify(state)) as HeroV2State);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `h2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `h2-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-hero2-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-hero2-components', { components: comps });
    setComponents(comps); newComponent();
  }

  // CTAs
  function updateCta(i: number, patch: Partial<HeroV2Cta>) { const a = [...state.ctas]; a[i] = { ...a[i], ...patch }; upd({ ctas: a }); }
  function addCta()           { upd({ ctas: [...state.ctas, makeCta()] }); }
  function removeCta(i: number) { upd({ ctas: state.ctas.filter((_, idx) => idx !== i) }); }

  // Stats
  function updateStat(i: number, patch: Partial<HeroV2Stat>) { const a = [...state.stats]; a[i] = { ...a[i], ...patch }; upd({ stats: a }); }
  function addStat()            { upd({ stats: [...state.stats, makeStat()] }); }
  function removeStat(i: number) { upd({ stats: state.stats.filter((_, idx) => idx !== i) }); }

  // RCards
  function updateRCard(i: number, patch: Partial<HeroV2RCard>) { const a = [...state.rcards]; a[i] = { ...a[i], ...patch }; upd({ rcards: a }); }
  function addRCard()              { upd({ rcards: [...state.rcards, makeRCard()] }); }
  function removeRCard(i: number)  { upd({ rcards: state.rcards.filter((_, idx) => idx !== i) }); }
  function updateRCardTags(i: number, value: string) {
    updateRCard(i, { tags: value.split('\n').map(tag => tag.trim()).filter(Boolean) });
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Hero Section V2</h1>
          <p className="text-xs text-slate-400 mt-0.5">Two-column hero — left content, right course cards</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Hero Section V2', generateHeroV2Html(state))); setActiveTab('preview'); }}
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
              <button onClick={duplicateComponent} disabled={!name && state.rcards.length === 0 && state.ctas.length === 0} className="btn-ghost text-xs px-3">Duplicate</button>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. Home Hero V2"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Background & Layout */}
          <p className="section-label">Background & Layout</p>
          <ColorRow label="Background colour" value={state.bg} onChange={v => upd({ bg: v })} />
          <div className="grid grid-cols-2 gap-2">
            <Field label="Left column width (%)">
              <input type="number" className="input" min={35} max={70} value={state.leftW}
                onChange={e => upd({ leftW: Number(e.target.value) })} />
            </Field>
            {(['padTop','padBot','padLeft','padRight'] as const).map(k => (
              <Field key={k} label={k.replace('pad','Pad ').replace('Top',' top').replace('Bot',' bottom').replace('Left',' left').replace('Right',' right') + ' (px)'}>
                <input type="number" className="input" min={0} max={300} value={state[k]}
                  onChange={e => upd({ [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>

          {/* Colours */}
          <p className="section-label">Accent Colours</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Eyebrow dot"   value={state.dotColor} onChange={v => upd({ dotColor: v })} />
            <ColorRow label="Highlight text" value={state.hlColor}  onChange={v => upd({ hlColor: v })} />
            <ColorRow label="Tag background" value={state.tagBg}   onChange={v => upd({ tagBg: v })} />
            <ColorRow label="Tag text"       value={state.tagTc}   onChange={v => upd({ tagTc: v })} />
            <ColorRow label="Card background" value={state.cardBg}  onChange={v => upd({ cardBg: v })} />
          </div>

          {/* Content */}
          <p className="section-label">Content</p>
          <RichTextField label="Eyebrow" value={asTV(state.eyebrow, 'h2Eyebrow')} defaultKey="h2Eyebrow"
            onChange={v => upd({ eyebrow: v })} />
          <RichTextField label="Heading (use ↵ newline before last line for highlight)" value={asTV(state.heading, 'h2Heading')} defaultKey="h2Heading"
            onChange={v => upd({ heading: v })} multiline />
          <RichTextField label="Heading highlight (appended to last line)" value={asTV(state.highlight, 'h2Highlight')} defaultKey="h2Highlight"
            onChange={v => upd({ highlight: v })} />
          <RichTextField label="Body text" value={asTV(state.body, 'h2Body')} defaultKey="h2Body"
            onChange={v => upd({ body: v })} multiline />

          {/* Tags */}
          <p className="section-label">Eyebrow Tags</p>
          <div className="space-y-1.5 mb-2">
            {state.tags.map((tag, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className="input flex-1" value={tag} placeholder="e.g. ACCA tuition"
                  onChange={e => { const t = [...state.tags]; t[i] = e.target.value; upd({ tags: t }); }} />
                <button onClick={() => upd({ tags: state.tags.filter((_, idx) => idx !== i) })} className="btn-danger">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => upd({ tags: [...state.tags, ''] })} className="btn-ghost text-xs w-full mb-1">+ Add tag</button>

          {/* CTAs */}
          <p className="section-label">CTA Buttons</p>
          <div className="space-y-2 mb-2">
            {state.ctas.map((cta, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeCta(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <Field label="Button text">
                  <input className="input" value={cta.text} placeholder="Browse all courses ↓"
                    onChange={e => updateCta(i, { text: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Style">
                    <select className="input" value={cta.style} onChange={e => updateCta(i, { style: e.target.value as 'solid' | 'outlined' })}>
                      <option value="solid">Solid</option>
                      <option value="outlined">Outlined</option>
                    </select>
                  </Field>
                  <Field label="URL">
                    <input className="input" value={cta.url} placeholder="https://..."
                      onChange={e => updateCta(i, { url: e.target.value })} />
                  </Field>
                </div>
                <Field label="Scroll target (optional — overrides URL)" hint="CSS selector or ID">
                  <input className="input" value={cta.scroll} placeholder="#courses or .section-id"
                    onChange={e => updateCta(i, { scroll: e.target.value })} />
                </Field>
                <div className="grid grid-cols-3 gap-2">
                  <ColorRow label="Background" value={cta.bg} onChange={v => updateCta(i, { bg: v })} />
                  <ColorRow label="Text" value={cta.tc} onChange={v => updateCta(i, { tc: v })} />
                  <ColorRow label="Border" value={cta.bc} onChange={v => updateCta(i, { bc: v })} />
                </div>
              </div>
            ))}
          </div>
          <button onClick={addCta} className="btn-ghost text-xs w-full mb-1">+ Add CTA</button>

          {/* Stats */}
          <p className="section-label">Stats Row</p>
          <div className="space-y-1.5 mb-2">
            {state.stats.map((stat, i) => (
              <div key={i} className="flex gap-2 items-end">
                <Field label="Value">
                  <input className="input" value={stat.value} placeholder="2,400+"
                    onChange={e => updateStat(i, { value: e.target.value })} />
                </Field>
                <Field label="Label">
                  <input className="input" value={stat.label} placeholder="STUDENTS ENROLLED"
                    onChange={e => updateStat(i, { label: e.target.value })} />
                </Field>
                <button onClick={() => removeStat(i)} className="btn-danger mb-0.5">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addStat} className="btn-ghost text-xs w-full mb-1">+ Add stat</button>

          {/* Right column cards */}
          <p className="section-label">Right Column Cards</p>
          <div className="space-y-2 mb-2">
            {state.rcards.map((card, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeRCard(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <Field label="Box type">
                  <select className="input" value={card.type || 'info'} onChange={e => updateRCard(i, { type: e.target.value as HeroV2RCard['type'] })}>
                    <option value="info">Info</option>
                    <option value="stat">Stat</option>
                    <option value="tags">Tags</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Icon (emoji)">
                    <input className="input" value={card.icon} placeholder="📚"
                      onChange={e => updateRCard(i, { icon: e.target.value })} />
                  </Field>
                  <ColorRow label="Icon background" value={card.iconBg} onChange={v => updateRCard(i, { iconBg: v })} />
                </div>
                <Field label="Title">
                  <input className="input" value={card.title} placeholder="ACCA Courses"
                    onChange={e => updateRCard(i, { title: e.target.value })} />
                </Field>
                <Field label="Subtitle">
                  <input className="input" value={card.subtitle} placeholder="Foundation · Applied Knowledge · Skills"
                    onChange={e => updateRCard(i, { subtitle: e.target.value })} />
                </Field>
                {(card.type || 'info') === 'tags' && (
                  <Field label="Tags" hint="One per line">
                    <textarea className="input" rows={4} value={(card.tags || []).join('\n')} placeholder={'Leadership\nGovernance\nStrategy'}
                      onChange={e => updateRCardTags(i, e.target.value)} />
                  </Field>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Count badge (optional)">
                    <input className="input" value={card.count} placeholder="75 courses"
                      onChange={e => updateRCard(i, { count: e.target.value })} />
                  </Field>
                  <Field label="Link URL">
                    <input className="input" value={card.url} placeholder="https://..."
                      onChange={e => updateRCard(i, { url: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addRCard} className="btn-ghost text-xs w-full mb-4">+ Add card</button>
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
