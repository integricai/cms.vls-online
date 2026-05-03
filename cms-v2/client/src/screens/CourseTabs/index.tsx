import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type {
  CourseTabsState, CourseTabsComponent, CourseTabsContent,
  CourseTab, CourseTabBlock, CourseTabBlockType, CourseTabBlockData,
  CourseTabCard, CourseTabStep, CourseTabSupportRow, TextValue,
} from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateCourseTabsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeDefault(): CourseTabsState {
  return { tabs: [] };
}

function makeCard(): CourseTabCard {
  return { icon: '📚', title: normalize('', 'ctabsCardTitle'), desc: normalize('', 'ctabsCardDesc') };
}
function makeStep(): CourseTabStep {
  return { icon: '', title: normalize('', 'ctabsStepTitle'), desc: normalize('', 'ctabsStepDesc') };
}
function makeSupportRow(): CourseTabSupportRow {
  return { cols: 2, cards: [makeCard(), makeCard()] };
}

function makeBlock(type: CourseTabBlockType): CourseTabBlock {
  const base: CourseTabBlockData = {};
  if (type === 'paragraph') return { type, data: { para: normalize('', 'ctabsPara') } };
  if (type === 'heading-para') return { type, data: { headingRich: normalize('', 'ctabsHeading'), para: normalize('', 'ctabsPara') } };
  if (type === 'bullets') return { type, data: { headingRich: normalize('', 'ctabsHeading'), items: [] } };
  if (type === 'panel-intro') return { type, data: { eyebrow: '', heading: '', desc: '' } };
  if (type === 'assurance') return { type, data: { icon: '🛡️', eyebrow: '', heading: '', desc: '' } };
  if (type === 'inc-cards') return { type, data: { cards: [makeCard(), makeCard()] } };
  if (type === 'steps') return { type, data: { steps: [makeStep()] } };
  if (type === 'support-cards') return { type, data: { rows: [makeSupportRow()] } };
  if (type === 'more-cards') return { type, data: { cards: [makeCard(), makeCard(), makeCard()] } };
  if (type === 'banner') return { type, data: { bg: '#204280', eyebrow: '', title: '', desc: '', cta: '', url: '#' } };
  return { type, data: base };
}

function makeTab(): CourseTab {
  return { id: 'tab-' + Date.now().toString(36), icon: '', label: 'New Tab', blocks: [] };
}

const BLOCK_LABELS: Record<CourseTabBlockType, string> = {
  'panel-intro':    'Panel Intro (dark header)',
  'paragraph':      'Paragraph',
  'heading-para':   'Heading + Paragraph',
  'bullets':        'Bullet List',
  'assurance':      'Assurance Card',
  'inc-cards':      'Included Cards (2-col)',
  'steps':          'Steps / Timeline',
  'support-cards':  'Support Cards',
  'more-cards':     'More Cards (3-col)',
  'banner':         'CTA Banner',
};

function asTV(v: TextValue | undefined, key: Parameters<typeof normalize>[1]) {
  return normalize(v, key);
}

// ── Card editor ───────────────────────────────────────────────────────────────
function CardEditor({ card, onChange, showSubtitle = false }: {
  card: CourseTabCard;
  onChange: (c: CourseTabCard) => void;
  showSubtitle?: boolean;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-2 space-y-1">
      <Field label="Icon (emoji)">
        <input className="input" value={card.icon} onChange={e => onChange({ ...card, icon: e.target.value })} />
      </Field>
      {showSubtitle && (
        <Field label="Subtitle (italic, optional)">
          <input className="input" value={card.subtitle ?? ''} onChange={e => onChange({ ...card, subtitle: e.target.value })} />
        </Field>
      )}
      <RichTextField label="Title" value={asTV(card.title, 'ctabsCardTitle')} defaultKey="ctabsCardTitle"
        onChange={v => onChange({ ...card, title: v })} />
      <RichTextField label="Description" multiline value={asTV(card.desc, 'ctabsCardDesc')} defaultKey="ctabsCardDesc"
        onChange={v => onChange({ ...card, desc: v })} />
      <Field label="Badge (optional)">
        <input className="input" value={card.badge ?? ''} placeholder="e.g. 46 hours" onChange={e => onChange({ ...card, badge: e.target.value })} />
      </Field>
      <Field label="CTA text (optional)">
        <input className="input" value={card.cta ?? ''} placeholder="Learn more" onChange={e => onChange({ ...card, cta: e.target.value })} />
      </Field>
      <Field label="CTA URL">
        <input className="input" value={card.url ?? ''} placeholder="https://..." onChange={e => onChange({ ...card, url: e.target.value })} />
      </Field>
    </div>
  );
}

// ── Step editor ───────────────────────────────────────────────────────────────
function StepEditor({ step, index, onChange }: {
  step: CourseTabStep;
  index: number;
  onChange: (s: CourseTabStep) => void;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-2 space-y-1">
      <Field label={`Step ${index + 1} icon (emoji/number)`}>
        <input className="input" value={step.icon ?? ''} placeholder={String(index + 1)} onChange={e => onChange({ ...step, icon: e.target.value })} />
      </Field>
      <RichTextField label="Title" value={asTV(step.title, 'ctabsStepTitle')} defaultKey="ctabsStepTitle"
        onChange={v => onChange({ ...step, title: v })} />
      <RichTextField label="Description" multiline value={asTV(step.desc, 'ctabsStepDesc')} defaultKey="ctabsStepDesc"
        onChange={v => onChange({ ...step, desc: v })} />
      <Field label="CTA text (optional)">
        <input className="input" value={step.cta ?? ''} placeholder="Get started" onChange={e => onChange({ ...step, cta: e.target.value })} />
      </Field>
      <Field label="CTA URL">
        <input className="input" value={step.url ?? ''} placeholder="https://..." onChange={e => onChange({ ...step, url: e.target.value })} />
      </Field>
    </div>
  );
}

// ── Block editor ─────────────────────────────────────────────────────────────
function BlockEditor({ block, onUpdate, onRemove, onMoveUp, onMoveDown }: {
  block: CourseTabBlock;
  onUpdate: (d: CourseTabBlockData) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);
  const d = block.data;

  function updCards(cards: CourseTabCard[]) { onUpdate({ ...d, cards }); }
  function updSteps(steps: CourseTabStep[]) { onUpdate({ ...d, steps }); }
  function updRows(rows: CourseTabSupportRow[]) { onUpdate({ ...d, rows }); }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 mb-2">
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          <button onClick={onMoveUp}   className="text-slate-400 hover:text-slate-700 text-[10px] leading-none">▲</button>
          <button onClick={onMoveDown} className="text-slate-400 hover:text-slate-700 text-[10px] leading-none">▼</button>
        </div>
        <button onClick={() => setOpen(o => !o)} className="flex-1 text-left text-xs font-semibold text-slate-700">
          {open ? '▾' : '▸'} {BLOCK_LABELS[block.type]}
        </button>
        <button onClick={onRemove} className="btn-danger text-xs">✕</button>
      </div>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* panel-intro */}
          {block.type === 'panel-intro' && (<>
            <Field label="Eyebrow text">
              <input className="input" value={d.eyebrow ?? ''} onChange={e => onUpdate({ ...d, eyebrow: e.target.value })} />
            </Field>
            <Field label="Heading">
              <input className="input" value={d.heading ?? ''} onChange={e => onUpdate({ ...d, heading: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[72px]" value={d.desc ?? ''} onChange={e => onUpdate({ ...d, desc: e.target.value })} />
            </Field>
          </>)}

          {/* paragraph */}
          {block.type === 'paragraph' && (
            <RichTextField label="Paragraph" multiline value={asTV(d.para, 'ctabsPara')} defaultKey="ctabsPara"
              onChange={v => onUpdate({ ...d, para: v })} />
          )}

          {/* heading-para */}
          {block.type === 'heading-para' && (<>
            <RichTextField label="Heading" value={asTV(d.headingRich, 'ctabsHeading')} defaultKey="ctabsHeading"
              onChange={v => onUpdate({ ...d, headingRich: v })} />
            <RichTextField label="Paragraph" multiline value={asTV(d.para, 'ctabsPara')} defaultKey="ctabsPara"
              onChange={v => onUpdate({ ...d, para: v })} />
          </>)}

          {/* bullets */}
          {block.type === 'bullets' && (<>
            <RichTextField label="Heading (optional)" value={asTV(d.headingRich, 'ctabsHeading')} defaultKey="ctabsHeading"
              onChange={v => onUpdate({ ...d, headingRich: v })} />
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Bullet items</p>
            <div className="space-y-1">
              {(d.items ?? []).map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1">
                    <RichTextField label={`Item ${i + 1}`} value={asTV(item, 'ctabsBullet')} defaultKey="ctabsBullet"
                      onChange={v => { const items = [...(d.items ?? [])]; items[i] = v; onUpdate({ ...d, items }); }} />
                  </div>
                  <button onClick={() => { const items = (d.items ?? []).filter((_, idx) => idx !== i); onUpdate({ ...d, items }); }}
                    className="btn-danger mt-5 text-xs">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => onUpdate({ ...d, items: [...(d.items ?? []), normalize('', 'ctabsBullet')] })}
              className="btn-ghost text-xs w-full">+ Add bullet</button>
          </>)}

          {/* assurance */}
          {block.type === 'assurance' && (<>
            <Field label="Icon (emoji)">
              <input className="input" value={d.icon ?? ''} onChange={e => onUpdate({ ...d, icon: e.target.value })} />
            </Field>
            <Field label="Eyebrow text">
              <input className="input" value={d.eyebrow ?? ''} onChange={e => onUpdate({ ...d, eyebrow: e.target.value })} />
            </Field>
            <Field label="Heading">
              <input className="input" value={d.heading ?? ''} onChange={e => onUpdate({ ...d, heading: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[72px]" value={d.desc ?? ''} onChange={e => onUpdate({ ...d, desc: e.target.value })} />
            </Field>
          </>)}

          {/* inc-cards */}
          {block.type === 'inc-cards' && (<>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Cards (2-column grid)</p>
            <div className="space-y-2">
              {(d.cards ?? []).map((card, i) => (
                <div key={i} className="relative">
                  <button onClick={() => updCards((d.cards ?? []).filter((_, idx) => idx !== i))}
                    className="btn-danger absolute right-1 top-1 z-10 text-xs">✕</button>
                  <CardEditor card={card} onChange={c => { const cards = [...(d.cards ?? [])]; cards[i] = c; updCards(cards); }} />
                </div>
              ))}
            </div>
            <button onClick={() => updCards([...(d.cards ?? []), makeCard()])} className="btn-ghost text-xs w-full">+ Add card</button>
          </>)}

          {/* steps */}
          {block.type === 'steps' && (<>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Steps</p>
            <div className="space-y-2">
              {(d.steps ?? []).map((step, i) => (
                <div key={i} className="relative">
                  <button onClick={() => updSteps((d.steps ?? []).filter((_, idx) => idx !== i))}
                    className="btn-danger absolute right-1 top-1 z-10 text-xs">✕</button>
                  <StepEditor step={step} index={i} onChange={s => { const steps = [...(d.steps ?? [])]; steps[i] = s; updSteps(steps); }} />
                </div>
              ))}
            </div>
            <button onClick={() => updSteps([...(d.steps ?? []), makeStep()])} className="btn-ghost text-xs w-full">+ Add step</button>
          </>)}

          {/* support-cards */}
          {block.type === 'support-cards' && (<>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Rows</p>
            <div className="space-y-3">
              {(d.rows ?? []).map((row, ri) => (
                <div key={ri} className="rounded border border-slate-300 bg-white p-2">
                  <div className="flex items-center justify-between mb-2">
                    <Field label="Columns">
                      <select className="input" value={row.cols}
                        onChange={e => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cols: Number(e.target.value) as 1 | 2 }; updRows(rows); }}>
                        <option value={1}>1 column (full width)</option>
                        <option value={2}>2 columns</option>
                      </select>
                    </Field>
                    <button onClick={() => updRows((d.rows ?? []).filter((_, idx) => idx !== ri))}
                      className="btn-danger text-xs ml-2 mt-4">✕ Row</button>
                  </div>
                  <div className="space-y-2">
                    {row.cards.map((card, ci) => (
                      <div key={ci} className="relative">
                        <button onClick={() => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cards: row.cards.filter((_, idx) => idx !== ci) }; updRows(rows); }}
                          className="btn-danger absolute right-1 top-1 z-10 text-xs">✕</button>
                        <CardEditor card={card} showSubtitle onChange={c => { const rows = [...(d.rows ?? [])]; const cards = [...row.cards]; cards[ci] = c; rows[ri] = { ...row, cards }; updRows(rows); }} />
                      </div>
                    ))}
                  </div>
                  <button onClick={() => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cards: [...row.cards, makeCard()] }; updRows(rows); }}
                    className="btn-ghost text-xs w-full mt-1">+ Add card to row</button>
                </div>
              ))}
            </div>
            <button onClick={() => updRows([...(d.rows ?? []), makeSupportRow()])} className="btn-ghost text-xs w-full">+ Add row</button>
          </>)}

          {/* more-cards */}
          {block.type === 'more-cards' && (<>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Cards (3-column grid)</p>
            <div className="space-y-2">
              {(d.cards ?? []).map((card, i) => (
                <div key={i} className="relative">
                  <button onClick={() => updCards((d.cards ?? []).filter((_, idx) => idx !== i))}
                    className="btn-danger absolute right-1 top-1 z-10 text-xs">✕</button>
                  <CardEditor card={card} onChange={c => { const cards = [...(d.cards ?? [])]; cards[i] = c; updCards(cards); }} />
                </div>
              ))}
            </div>
            <button onClick={() => updCards([...(d.cards ?? []), makeCard()])} className="btn-ghost text-xs w-full">+ Add card</button>
          </>)}

          {/* banner */}
          {block.type === 'banner' && (<>
            <Field label="Background colour">
              <div className="flex gap-2 items-center">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(d.bg ?? '') ? d.bg! : '#204280'}
                  onChange={e => onUpdate({ ...d, bg: e.target.value })}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                <input type="text" className="input" value={d.bg ?? '#204280'}
                  onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onUpdate({ ...d, bg: e.target.value }); }} />
              </div>
            </Field>
            <Field label="Eyebrow text">
              <input className="input" value={d.eyebrow ?? ''} onChange={e => onUpdate({ ...d, eyebrow: e.target.value })} />
            </Field>
            <Field label="Title">
              <input className="input" value={d.title ?? ''} onChange={e => onUpdate({ ...d, title: e.target.value })} />
            </Field>
            <Field label="Description">
              <textarea className="input min-h-[72px]" value={d.desc ?? ''} onChange={e => onUpdate({ ...d, desc: e.target.value })} />
            </Field>
            <Field label="CTA text (optional)">
              <input className="input" value={d.cta ?? ''} placeholder="Enrol Now" onChange={e => onUpdate({ ...d, cta: e.target.value })} />
            </Field>
            <Field label="CTA URL">
              <input className="input" value={d.url ?? ''} placeholder="https://..." onChange={e => onUpdate({ ...d, url: e.target.value })} />
            </Field>
          </>)}
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────
export default function CourseTabsScreen() {
  const [components, setComponents] = useState<CourseTabsComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<CourseTabsState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [newBlockType, setNewBlockType] = useState<CourseTabBlockType>('paragraph');

  useEffect(() => {
    api.get<{ data: CourseTabsContent }>('/content/vls-course-tabs-components')
      .then(row => {
        const comps = (row?.data as CourseTabsContent)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<CourseTabsState>) => {
    setState(prev => ({ ...prev, ...patch })); setSaved(false);
  }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setActiveTabIdx(0); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setActiveTabIdx(0); setSaved(false); }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `ctb-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `ctb-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-course-tabs-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-course-tabs-components', { components: comps });
    setComponents(comps); newComponent();
  }

  // Tab management
  function addTab() {
    const tabs = [...state.tabs, makeTab()];
    upd({ tabs }); setActiveTabIdx(tabs.length - 1);
  }
  function removeTab(i: number) {
    const tabs = state.tabs.filter((_, idx) => idx !== i);
    upd({ tabs }); setActiveTabIdx(Math.min(activeTabIdx, tabs.length - 1));
  }
  function updateTab(i: number, patch: Partial<CourseTab>) {
    const tabs = [...state.tabs]; tabs[i] = { ...tabs[i], ...patch }; upd({ tabs });
  }

  // Block management for active tab
  const currentTab = state.tabs[activeTabIdx];
  function updateBlocks(blocks: CourseTabBlock[]) {
    const tabs = [...state.tabs]; tabs[activeTabIdx] = { ...tabs[activeTabIdx], blocks }; upd({ tabs });
  }
  function addBlock() {
    if (!currentTab) return;
    updateBlocks([...currentTab.blocks, makeBlock(newBlockType)]);
  }
  function updateBlock(bi: number, data: CourseTabBlockData) {
    const blocks = [...currentTab.blocks]; blocks[bi] = { ...blocks[bi], data }; updateBlocks(blocks);
  }
  function removeBlock(bi: number) { updateBlocks(currentTab.blocks.filter((_, i) => i !== bi)); }
  function moveBlock(bi: number, dir: -1 | 1) {
    const blocks = [...currentTab.blocks];
    const ni = bi + dir;
    if (ni < 0 || ni >= blocks.length) return;
    [blocks[bi], blocks[ni]] = [blocks[ni], blocks[bi]]; updateBlocks(blocks);
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Course Tabs</h1>
          <p className="text-xs text-slate-400 mt-0.5">Tab panel content for course pages</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(wrapGeneratedHtml('Course Tabs', generateCourseTabsHtml(state))); setActiveTab('preview'); }}
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
              <input className="input" value={name} placeholder="e.g. FA1 Course Tabs"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Tab list */}
          <p className="section-label">Tabs</p>
          <div className="space-y-1.5 mb-2">
            {state.tabs.map((tab, i) => (
              <div key={tab.id} className={`flex gap-2 items-center rounded-lg px-2 py-1.5 cursor-pointer transition ${activeTabIdx === i ? 'bg-brand/10 border border-brand/30' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}`}
                onClick={() => setActiveTabIdx(i)}>
                <input className="input w-10 text-center p-1" value={tab.icon} placeholder="📚"
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); updateTab(i, { icon: e.target.value }); }} />
                <input className="input flex-1 py-1" value={tab.label} placeholder={`Tab ${i + 1}`}
                  onClick={e => e.stopPropagation()}
                  onChange={e => { e.stopPropagation(); updateTab(i, { label: e.target.value }); }} />
                <span className="text-xs text-slate-400 shrink-0">{tab.blocks.length} blocks</span>
                <button onClick={e => { e.stopPropagation(); removeTab(i); }} className="btn-danger text-xs shrink-0">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addTab} className="btn-ghost text-xs w-full mb-4">+ Add tab</button>

          {/* Block editor for active tab */}
          {currentTab ? (<>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label mb-0">Blocks — <span className="font-normal text-brand">{currentTab.label || `Tab ${activeTabIdx + 1}`}</span></p>
            </div>
            <div>
              {currentTab.blocks.map((blk, bi) => (
                <BlockEditor key={bi} block={blk}
                  onUpdate={d => updateBlock(bi, d)}
                  onRemove={() => removeBlock(bi)}
                  onMoveUp={() => moveBlock(bi, -1)}
                  onMoveDown={() => moveBlock(bi, 1)} />
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <select className="input flex-1 text-xs" value={newBlockType} onChange={e => setNewBlockType(e.target.value as CourseTabBlockType)}>
                {(Object.keys(BLOCK_LABELS) as CourseTabBlockType[]).map(t => (
                  <option key={t} value={t}>{BLOCK_LABELS[t]}</option>
                ))}
              </select>
              <button onClick={addBlock} className="btn-ghost text-xs px-4">+ Add block</button>
            </div>
          </>) : (
            <p className="text-xs text-slate-400 text-center py-6">Add a tab above to start editing blocks.</p>
          )}
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
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
