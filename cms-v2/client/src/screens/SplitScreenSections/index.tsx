import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import type {
  GenericSectionComponent,
  GenericSectionState,
  LeftHeroPathwayItem,
  LeftHeroStatItem,
  LeftHeroTrustItem,
  PageLeftHeroComponent,
  PageLeftHeroState,
  SplitContentSection,
  SplitSectionCard,
  TextData,
} from '../../types/cms';
import { normalize } from '../../utils/text';
import { makeGenericSection, makeLeftGeneric, makeLeftHero, makeRightPane } from './defaults';
import { generateGenericSectionHtml, generateLeftHeroHtml, generatePanelHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

type SplitType = 'left-hero' | 'left-generic' | 'right-pane' | 'generic-section';
type Tab = 'preview' | 'html';

const CONFIG = {
  'left-hero': {
    title: 'Left Hero Section',
    key: 'vls-page-left-hero-components',
    dataKey: 'components',
    mode: 'hero',
  },
  'left-generic': {
    title: 'Left Generic Section',
    key: 'vls-left-generic-section',
    dataKey: 'sections',
    mode: 'panel',
    panelMode: 'left',
  },
  'right-pane': {
    title: 'Right Pane Section',
    key: 'vls-right-pane-section',
    dataKey: 'sections',
    mode: 'panel',
    panelMode: 'right',
  },
  'generic-section': {
    title: 'Generic Section',
    key: 'vls-generic-section-components',
    dataKey: 'components',
    mode: 'generic',
  },
} as const;

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} className="h-9 w-10 shrink-0 rounded border border-slate-200 p-0.5" />
        <input className="input" value={value} onChange={e => onChange(e.target.value)} />
      </div>
    </Field>
  );
}

function NumberInput({ label, value, min = 0, max = 240, onChange }: { label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <Field label={label}>
      <input type="number" className="input" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))} />
    </Field>
  );
}

function LinesField({ label, value, onChange, placeholder }: { label: string; value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <Field label={label} hint="one per line">
      <textarea className="input min-h-24 resize-y" value={(value || []).join('\n')} placeholder={placeholder} onChange={e => onChange(e.target.value.split('\n'))} />
    </Field>
  );
}

function OutputPane({ html, tab, setTab }: { html: string; tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex border-b border-slate-200 bg-white px-4">
        {(['preview', 'html'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
            {t === 'html' ? 'HTML' : 'Preview'}
          </button>
        ))}
      </div>
      {tab === 'preview' ? (
        <iframe
          title="Split screen preview"
          srcDoc={html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview this section.</p>'}
          className="h-full w-full flex-1 border-0 bg-slate-50"
          sandbox="allow-same-origin"
        />
      ) : (
        <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
          <button onClick={() => navigator.clipboard.writeText(html)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">{html || '// Generate HTML first'}</pre>
        </div>
      )}
    </div>
  );
}

function SavedSelector<T extends { id: string; name: string }>({
  title,
  items,
  activeId,
  name,
  saving,
  saved,
  onSelect,
  onNew,
  onDuplicate,
  onDelete,
  onName,
  onSave,
  onGenerate,
}: {
  title: string;
  items: T[];
  activeId: string | null;
  name: string;
  saving: boolean;
  saved: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onName: (name: string) => void;
  onSave: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
      <h1 className="text-base font-bold text-slate-900">{title}</h1>
      <p className="mt-0.5 text-xs text-slate-400">Page Builder / Split Screen</p>
      <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
        <p className="section-label mt-0">Saved Items</p>
        <div className="mb-2 flex gap-2">
          <select className="input flex-1" value={activeId || ''} onChange={e => onSelect(e.target.value)}>
            <option value="">- select -</option>
            {items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button onClick={onNew} className="btn-ghost text-xs">+ New</button>
          {activeId && <button onClick={onDuplicate} className="btn-ghost text-xs">Duplicate</button>}
          {activeId && <button onClick={onDelete} className="btn-danger text-xs">Delete</button>}
        </div>
        <Field label="Name">
          <input className="input" value={name} onChange={e => onName(e.target.value)} placeholder="Saved item name" />
        </Field>
        <div className="flex gap-2">
          <button onClick={onSave} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : saved ? 'Saved' : 'Save'}</button>
          <button onClick={onGenerate} className="btn-success flex-1 justify-center">Generate HTML</button>
        </div>
      </div>
    </div>
  );
}

function addId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function HeroEditor() {
  const [items, setItems] = useState<PageLeftHeroComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<PageLeftHeroState>(makeLeftHero());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [html, setHtml] = useState('');
  const [tab, setTab] = useState<Tab>('preview');

  useEffect(() => {
    api.get<any>('/content/vls-page-left-hero-components')
      .then(row => {
        const next = ((row?.data?.components || []) as PageLeftHeroComponent[]).map(c => ({ ...c, data: { ...makeLeftHero(), ...(c.data || {}) } }));
        setItems(next);
        if (next[0]) {
          setActiveId(next[0].id);
          setName(next[0].name);
          setState(next[0].data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(p: Partial<PageLeftHeroState>) {
    setState(prev => ({ ...prev, ...p }));
    setSaved(false);
  }

  function updatePathway(index: number, partial: Partial<LeftHeroPathwayItem>) {
    const next = [...state.pathwayItems];
    next[index] = { ...next[index], ...partial };
    patch({ pathwayItems: next });
  }

  function updateStat(index: number, partial: Partial<LeftHeroStatItem>) {
    const next = [...state.statsItems];
    next[index] = { ...next[index], ...partial };
    patch({ statsItems: next });
  }

  function updateTrust(index: number, partial: Partial<LeftHeroTrustItem>) {
    const next = [...state.trustItems];
    next[index] = { ...next[index], ...partial };
    patch({ trustItems: next });
  }

  function load(id: string) {
    if (!id) return;
    const item = items.find(i => i.id === id);
    if (!item) return;
    setActiveId(item.id);
    setName(item.name);
    setState({ ...makeLeftHero(), ...(item.data || {}) });
    setSaved(false);
  }

  function newItem() {
    setActiveId(null);
    setName('');
    setState(makeLeftHero());
    setSaved(false);
  }

  function duplicate() {
    const id = addId('plh');
    const nextName = name ? `Copy of ${name}` : 'Copy of Left Hero Section';
    const next = [...items, { id, name: nextName, data: structuredClone(state) }];
    setItems(next);
    setActiveId(id);
    setName(nextName);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a name before saving.'); return; }
    setSaving(true);
    const id = activeId || addId('plh');
    const next = activeId
      ? items.map(item => item.id === id ? { id, name, data: state } : item)
      : [...items, { id, name, data: state }];
    if (!next.some(item => item.id === id)) next.push({ id, name, data: state });
    await api.put('/content/vls-page-left-hero-components', { components: next });
    setItems(next);
    setActiveId(id);
    setSaved(true);
    setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete this left hero section?')) return;
    const next = items.filter(item => item.id !== activeId);
    await api.put('/content/vls-page-left-hero-components', { components: next });
    setItems(next);
    newItem();
  }

  if (loading) return <div className="p-5 text-xs text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <SavedSelector title="Left Hero Section" items={items} activeId={activeId} name={name} saving={saving} saved={saved} onSelect={load} onNew={newItem} onDuplicate={duplicate} onDelete={del} onName={setName} onSave={save} onGenerate={() => { setHtml(wrapGeneratedHtml('Left Hero', generateLeftHeroHtml(state))); setTab('preview'); }} />
        <div className="px-5 py-4">
          <p className="section-label mt-0">Layout</p>
          <ColorInput label="Background" value={state.bg} onChange={bg => patch({ bg })} />
          <div className="grid grid-cols-4 gap-2">
            <NumberInput label="Top" value={state.padTop} onChange={padTop => patch({ padTop })} />
            <NumberInput label="Bottom" value={state.padBot} onChange={padBot => patch({ padBot })} />
            <NumberInput label="Left" value={state.padLeft} onChange={padLeft => patch({ padLeft })} />
            <NumberInput label="Right" value={state.padRight} onChange={padRight => patch({ padRight })} />
          </div>
          <p className="section-label">Content</p>
          <Field label="Breadcrumb"><input className="input" value={state.breadcrumb} onChange={e => patch({ breadcrumb: e.target.value })} /></Field>
          <RichTextField label="Heading" value={normalize(state.heading, 'plhHeading')} defaultKey="plhHeading" onChange={heading => patch({ heading })} />
          <Field label="Heading accent"><input className="input" value={state.headingAccent} onChange={e => patch({ headingAccent: e.target.value })} /></Field>
          <LinesField label="Eyebrow labels" value={state.eyebrowLabels} onChange={eyebrowLabels => patch({ eyebrowLabels })} />
          <LinesField label="Descriptions" value={state.descs} onChange={descs => patch({ descs })} />
          <p className="section-label">Calls to Action</p>
          <Field label="Primary CTA title"><input className="input" value={state.primaryCta} onChange={e => patch({ primaryCta: e.target.value })} /></Field>
          <Field label="Primary CTA URL"><input className="input" value={state.primaryCtaUrl} onChange={e => patch({ primaryCtaUrl: e.target.value })} /></Field>
          <Field label="Primary CTA scroll target" hint="CSS selector or class — overrides URL, e.g. .section-faq or #my-id"><input className="input" value={state.primaryCtaScroll} placeholder=".section-name or #section-id" onChange={e => patch({ primaryCtaScroll: e.target.value })} /></Field>
          <Field label="Secondary CTA title"><input className="input" value={state.secondaryCta} onChange={e => patch({ secondaryCta: e.target.value })} /></Field>
          <Field label="Secondary CTA URL"><input className="input" value={state.secondaryCtaUrl} onChange={e => patch({ secondaryCtaUrl: e.target.value })} /></Field>
          <Field label="Secondary CTA scroll target" hint="CSS selector or class — overrides URL, e.g. .section-faq or #my-id"><input className="input" value={state.secondaryCtaScroll} placeholder=".section-name or #section-id" onChange={e => patch({ secondaryCtaScroll: e.target.value })} /></Field>
          <p className="section-label">Pathway</p>
          {state.pathwayItems.map((item, i) => (
            <div key={i} className="mb-2 grid grid-cols-[70px_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
              <input className="input" value={item.icon} placeholder="icon" onChange={e => updatePathway(i, { icon: e.target.value })} />
              <input className="input" value={item.text} placeholder="Text" onChange={e => updatePathway(i, { text: e.target.value })} />
              <button className="btn-danger" onClick={() => patch({ pathwayItems: state.pathwayItems.filter((_, idx) => idx !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost mb-3 w-full justify-center" onClick={() => patch({ pathwayItems: [...state.pathwayItems, { icon: '', text: '' }] })}>+ Add pathway item</button>
          <p className="section-label">Stats</p>
          {state.statsItems.map((item, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
              <input className="input" value={item.value} placeholder="Value" onChange={e => updateStat(i, { value: e.target.value })} />
              <input className="input" value={item.label1} placeholder="Label 1" onChange={e => updateStat(i, { label1: e.target.value })} />
              <input className="input" value={item.label2} placeholder="Label 2" onChange={e => updateStat(i, { label2: e.target.value })} />
              <button className="btn-danger" onClick={() => patch({ statsItems: state.statsItems.filter((_, idx) => idx !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost mb-3 w-full justify-center" onClick={() => patch({ statsItems: [...state.statsItems, { value: '', label1: '', label2: '' }] })}>+ Add stat</button>
          <p className="section-label">Trust Strip</p>
          {state.trustItems.map((item, i) => (
            <div key={i} className="mb-2 grid grid-cols-[70px_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
              <input className="input" value={item.icon} placeholder="icon" onChange={e => updateTrust(i, { icon: e.target.value })} />
              <input className="input" value={item.text} placeholder="Text" onChange={e => updateTrust(i, { text: e.target.value })} />
              <button className="btn-danger" onClick={() => patch({ trustItems: state.trustItems.filter((_, idx) => idx !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost mb-6 w-full justify-center" onClick={() => patch({ trustItems: [...state.trustItems, { icon: '', text: '' }] })}>+ Add trust item</button>
        </div>
      </div>
      <OutputPane html={html} tab={tab} setTab={setTab} />
    </div>
  );
}

function CardEditor({ card, mode, onChange, onRemove }: { card: SplitSectionCard; mode: 'left' | 'right'; onChange: (p: Partial<SplitSectionCard>) => void; onRemove: () => void }) {
  const titleKey = mode === 'left' ? 'lgsCardTitle' : 'rpsCardTitle';
  const descKey = mode === 'left' ? 'lgsCardDesc' : 'rpsCardDesc';
  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center gap-2">
        <select className="input" value={card.type || 'card'} onChange={e => onChange({ type: e.target.value as SplitSectionCard['type'] })}>
          <option value="card">Card</option>
          <option value="card-image">Card + Image</option>
          <option value="image">Image</option>
        </select>
        <button className="btn-danger shrink-0" onClick={onRemove}>Remove</button>
      </div>
      {mode === 'left' && (
        <Field label="Row width">
          <select className="input" value={card.halfWidth ? 'half' : 'full'} onChange={e => onChange({ halfWidth: e.target.value === 'half' })}>
            <option value="full">Full width (1 per row)</option>
            <option value="half">Half width (2 per row)</option>
          </select>
        </Field>
      )}
      {card.type === 'image' ? (
        <>
          <Field label="Image URL"><input className="input" value={card.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })} /></Field>
          <Field label="Alt text"><input className="input" value={card.imageAlt || ''} onChange={e => onChange({ imageAlt: e.target.value })} /></Field>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <ColorInput label="Card background" value={card.cardBg || (mode === 'left' ? '#f8f9fa' : '#1a2d4a')} onChange={cardBg => onChange({ cardBg })} />
            <ColorInput label="Card border" value={card.cardBorder || (mode === 'left' ? '#e5e7eb' : '#1e3a5f')} onChange={cardBorder => onChange({ cardBorder })} />
          </div>
          {card.type === 'card-image' && (
            <>
              <Field label="Image URL"><input className="input" value={card.imageUrl || ''} onChange={e => onChange({ imageUrl: e.target.value })} /></Field>
              <Field label="Alt text"><input className="input" value={card.imageAlt || ''} onChange={e => onChange({ imageAlt: e.target.value })} /></Field>
            </>
          )}
          {card.type !== 'card-image' && (
            <div className="grid grid-cols-3 gap-2">
              <Field label="Icon"><input className="input" value={card.icon || ''} onChange={e => onChange({ icon: e.target.value })} /></Field>
              <ColorInput label="Icon bg" value={card.iconBg || (mode === 'left' ? '#e8edf5' : '#1e3a5f')} onChange={iconBg => onChange({ iconBg })} />
              <ColorInput label="Icon color" value={card.iconColor || (mode === 'left' ? '#204280' : '#f59e0b')} onChange={iconColor => onChange({ iconColor })} />
            </div>
          )}
          <RichTextField label="Title" value={normalize(card.title, titleKey)} defaultKey={titleKey} onChange={title => onChange({ title })} />
          <RichTextField label="Description" multiline value={normalize(card.desc, descKey)} defaultKey={descKey} onChange={desc => onChange({ desc })} />
          {card.type === 'card-image' && (
            <>
              <RichTextField label="CTA text" value={normalize(card.ctaText, mode === 'left' ? 'lgsCardCta' : 'rpsCardCta')} defaultKey={mode === 'left' ? 'lgsCardCta' : 'rpsCardCta'} onChange={ctaText => onChange({ ctaText })} />
              <Field label="CTA URL"><input className="input" value={card.ctaUrl || ''} onChange={e => onChange({ ctaUrl: e.target.value })} /></Field>
            </>
          )}
          {mode === 'right' && card.type !== 'card-image' && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="Stat value"><input className="input" value={card.statValue || ''} onChange={e => onChange({ statValue: e.target.value })} /></Field>
              <Field label="Stat label"><input className="input" value={card.statLabel || ''} onChange={e => onChange({ statLabel: e.target.value })} /></Field>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GenericEditor() {
  const [items, setItems] = useState<GenericSectionComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<GenericSectionState>(makeGenericSection());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [html, setHtml] = useState('');
  const [tab, setTab] = useState<Tab>('preview');

  useEffect(() => {
    api.get<any>('/content/vls-generic-section-components')
      .then(row => {
        const next = ((row?.data?.components || []) as GenericSectionComponent[]).map(c => ({ ...c, data: { ...makeGenericSection(), ...(c.data || {}) } }));
        setItems(next);
        if (next[0]) {
          setActiveId(next[0].id);
          setName(next[0].name);
          setState(next[0].data);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(p: Partial<GenericSectionState>) {
    setState(prev => ({ ...prev, ...p }));
    setSaved(false);
  }

  function load(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setActiveId(item.id);
    setName(item.name);
    setState({ ...makeGenericSection(), ...(item.data || {}) });
    setSaved(false);
  }

  function newItem() {
    setActiveId(null);
    setName('');
    setState(makeGenericSection());
    setSaved(false);
  }

  function duplicate() {
    const id = addId('gs');
    const nextName = name ? `Copy of ${name}` : 'Copy of Generic Section';
    const nextItem = { id, name: nextName, data: structuredClone(state) };
    setItems(prev => [...prev, nextItem]);
    setActiveId(id);
    setName(nextName);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a name before saving.'); return; }
    setSaving(true);
    const id = activeId || addId('gs');
    const item = { id, name, data: state };
    const next = activeId ? items.map(i => i.id === id ? item : i) : [...items, item];
    if (!next.some(i => i.id === id)) next.push(item);
    await api.put('/content/vls-generic-section-components', { components: next });
    setItems(next);
    setActiveId(id);
    setSaved(true);
    setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm('Delete this generic section?')) return;
    const next = items.filter(item => item.id !== activeId);
    await api.put('/content/vls-generic-section-components', { components: next });
    setItems(next);
    newItem();
  }

  if (loading) return <div className="p-5 text-xs text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <SavedSelector title="Generic Section" items={items} activeId={activeId} name={name} saving={saving} saved={saved} onSelect={load} onNew={newItem} onDuplicate={duplicate} onDelete={del} onName={setName} onSave={save} onGenerate={() => { setHtml(wrapGeneratedHtml('Generic Section', generateGenericSectionHtml(state))); setTab('preview'); }} />
        <div className="px-5 py-4">
          <p className="section-label mt-0">Layout</p>
          <ColorInput label="Background" value={state.bg} onChange={bg => patch({ bg })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Max width" value={state.maxWidth} min={320} max={1400} onChange={maxWidth => patch({ maxWidth })} />
            <NumberInput label="Top" value={state.padTop} onChange={padTop => patch({ padTop })} />
            <NumberInput label="Bottom" value={state.padBot} onChange={padBot => patch({ padBot })} />
            <NumberInput label="Left" value={state.padLeft} onChange={padLeft => patch({ padLeft })} />
            <NumberInput label="Right" value={state.padRight} onChange={padRight => patch({ padRight })} />
          </div>
          <p className="section-label">Content</p>
          <RichTextField label="Eyebrow" value={normalize(state.eyebrow, 'lgsEyebrow')} defaultKey="lgsEyebrow" onChange={eyebrow => patch({ eyebrow })} />
          <RichTextField label="Heading" value={normalize(state.heading, 'lgsHeading')} defaultKey="lgsHeading" onChange={heading => patch({ heading })} />
          <RichTextField label="Body" multiline value={normalize(state.body, 'lgsDesc')} defaultKey="lgsDesc" onChange={body => patch({ body })} />
          <p className="section-label">Callout</p>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={state.calloutShow} onChange={e => patch({ calloutShow: e.target.checked })} />
            Show callout
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon"><input className="input" value={state.calloutIcon} onChange={e => patch({ calloutIcon: e.target.value })} /></Field>
            <ColorInput label="Callout bg" value={state.calloutBg} onChange={calloutBg => patch({ calloutBg })} />
            <ColorInput label="Callout border" value={state.calloutBorder} onChange={calloutBorder => patch({ calloutBorder })} />
          </div>
          <RichTextField label="Callout text" multiline value={normalize(state.calloutText, 'lgsCardDesc')} defaultKey="lgsCardDesc" onChange={calloutText => patch({ calloutText })} />
        </div>
      </div>
      <OutputPane html={html} tab={tab} setTab={setTab} />
    </div>
  );
}

function PanelEditor({ type }: { type: Extract<SplitType, 'left-generic' | 'right-pane'> }) {
  const config = CONFIG[type];
  const mode = config.panelMode;
  const [items, setItems] = useState<SplitContentSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<SplitContentSection>(() => mode === 'left' ? makeLeftGeneric() : makeRightPane());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [html, setHtml] = useState('');
  const [tab, setTab] = useState<Tab>('preview');

  const blank = useMemo(() => mode === 'left' ? makeLeftGeneric(items.length + 1) : makeRightPane(items.length + 1), [items.length, mode]);

  useEffect(() => {
    api.get<any>(`/content/${config.key}`)
      .then(row => {
        const next = ((row?.data?.sections || []) as SplitContentSection[]).map(s => ({
          ...blank,
          ...s,
          imageBoxWidth: Number(s.imageBoxWidth ?? blank.imageBoxWidth ?? 100),
          imageBoxHeight: Number(s.imageBoxHeight ?? blank.imageBoxHeight ?? 180),
          cards: (s.cards || []).map(card => ({ ...card, type: card.type || 'card' })),
        }));
        setItems(next);
        if (next[0]) {
          setActiveId(next[0].id);
          setName(next[0].name);
          setState(next[0]);
        }
      })
      .finally(() => setLoading(false));
  }, [blank, config.key]);

  function patch(p: Partial<SplitContentSection>) {
    setState(prev => ({ ...prev, ...p }));
    setSaved(false);
  }

  function patchCard(index: number, partial: Partial<SplitSectionCard>) {
    const next = [...(state.cards || [])];
    next[index] = { ...next[index], ...partial };
    patch({ cards: next });
  }

  function load(id: string) {
    const item = items.find(i => i.id === id);
    if (!item) return;
    setActiveId(item.id);
    setName(item.name);
    setState(item);
    setSaved(false);
  }

  function newItem() {
    const next = mode === 'left' ? makeLeftGeneric(items.length + 1) : makeRightPane(items.length + 1);
    setActiveId(null);
    setName(next.name);
    setState(next);
    setSaved(false);
  }

  function duplicate() {
    const id = addId(mode === 'left' ? 'lgs' : 'rps');
    const nextName = name ? `Copy of ${name}` : `Copy of ${config.title}`;
    const nextItem = { ...structuredClone(state), id, name: nextName };
    setItems(prev => [...prev, nextItem]);
    setActiveId(id);
    setName(nextName);
    setState(nextItem);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a name before saving.'); return; }
    setSaving(true);
    const id = activeId || state.id || addId(mode === 'left' ? 'lgs' : 'rps');
    const item = { ...state, id, name };
    const next = activeId ? items.map(s => s.id === id ? item : s) : [...items, item];
    if (!next.some(s => s.id === id)) next.push(item);
    await api.put(`/content/${config.key}`, { sections: next });
    setItems(next);
    setActiveId(id);
    setState(item);
    setSaved(true);
    setSaving(false);
  }

  async function del() {
    if (!activeId || !confirm(`Delete this ${config.title.toLowerCase()}?`)) return;
    const next = items.filter(item => item.id !== activeId);
    await api.put(`/content/${config.key}`, { sections: next });
    setItems(next);
    newItem();
  }

  if (loading) return <div className="p-5 text-xs text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <SavedSelector title={config.title} items={items} activeId={activeId} name={name} saving={saving} saved={saved} onSelect={load} onNew={newItem} onDuplicate={duplicate} onDelete={del} onName={setName} onSave={save} onGenerate={() => { setHtml(wrapGeneratedHtml(config.title, generatePanelHtml(state, mode))); setTab('preview'); }} />
        <div className="px-5 py-4">
          <p className="section-label mt-0">Section</p>
          <ColorInput label="Background" value={state.bg} onChange={bg => patch({ bg })} />
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Image width (%)" value={state.imageBoxWidth ?? 100} min={10} max={100} onChange={imageBoxWidth => patch({ imageBoxWidth })} />
            <NumberInput label="Image height (px)" value={state.imageBoxHeight ?? 180} min={40} max={800} onChange={imageBoxHeight => patch({ imageBoxHeight })} />
          </div>
          <RichTextField label="Eyebrow" value={normalize(state.eyebrow, mode === 'left' ? 'lgsEyebrow' : 'rpsEyebrow')} defaultKey={mode === 'left' ? 'lgsEyebrow' : 'rpsEyebrow'} onChange={(eyebrow: TextData) => patch({ eyebrow })} />
          <RichTextField label="Heading" value={normalize(state.heading, mode === 'left' ? 'lgsHeading' : 'rpsHeading')} defaultKey={mode === 'left' ? 'lgsHeading' : 'rpsHeading'} onChange={(heading: TextData) => patch({ heading })} />
          <RichTextField label="Description" multiline value={normalize(state.desc, mode === 'left' ? 'lgsDesc' : 'rpsDesc')} defaultKey={mode === 'left' ? 'lgsDesc' : 'rpsDesc'} onChange={(desc: TextData) => patch({ desc })} />
          <p className="section-label">Cards and Blocks</p>
          {(state.cards || []).map((card, i) => (
            <CardEditor key={i} card={card} mode={mode} onChange={partial => patchCard(i, partial)} onRemove={() => patch({ cards: state.cards.filter((_, idx) => idx !== i) })} />
          ))}
          <button className="btn-ghost mb-6 w-full justify-center" onClick={() => patch({ cards: [...(state.cards || []), { type: 'card', cardBg: mode === 'left' ? '#f8f9fa' : '#1a2d4a', cardBorder: mode === 'left' ? '#e5e7eb' : '#1e3a5f', title: normalize('', mode === 'left' ? 'lgsCardTitle' : 'rpsCardTitle'), desc: normalize('', mode === 'left' ? 'lgsCardDesc' : 'rpsCardDesc') }] })}>+ Add card</button>
        </div>
      </div>
      <OutputPane html={html} tab={tab} setTab={setTab} />
    </div>
  );
}

export default function SplitScreenSections() {
  const params = useParams();
  const type = params.type as SplitType | undefined;

  if (!type || !(type in CONFIG)) return <Navigate to="/split-screen/left-hero" replace />;
  if (type === 'left-hero') return <HeroEditor />;
  if (type === 'generic-section') return <GenericEditor />;
  return <PanelEditor type={type} />;
}
