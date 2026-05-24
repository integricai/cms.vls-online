import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type {
  PageDescWithMenuState,
  PageDescWithMenuComponent,
  PageDescWithMenuContent,
  PageDescMenuItem,
  CourseDescBlock,
  CourseDescBlockType,
  TextValue,
} from '../../types/cms';
import { normalize } from '../../utils/text';
import { generatePageDescWithMenuHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

function makeDefault(): PageDescWithMenuState {
  return {
    menuTitle: 'In this guide',
    menuBg: '#f9fafb',
    menuItemTc: '#374151',
    menuActiveBg: '#204280',
    menuActiveTc: '#ffffff',
    menuItems: [
      { title: 'Course Overview', scrollTarget: '#course-overview' },
      { title: 'Features', scrollTarget: '#course-features' },
      { title: 'Tutor', scrollTarget: '#course-tutor' },
      { title: 'FAQ', scrollTarget: '#course-faq' },
      { title: 'Curriculum', scrollTarget: '#course-curriculum' },
      { title: 'Pricing', scrollTarget: '#course-pricing' },
    ],
    bannerHeading: 'Start your ACCA journey with VLS',
    bannerSubheading: 'Study with structured lessons, expert tutors, revision support and exam-focused resources.',
    bannerCtaText: 'Enrol Now',
    bannerCtaUrl: '#course-pricing',
    bannerCtaNewTab: false,
    icon: '📖',
    title: '',
    titleTc: '#1a1a1a',
    titleSize: 14,
    introBold: normalize('', 'cdescIntroBold'),
    introP1:   normalize('', 'cdescDesc'),
    introP2:   normalize('', 'cdescDesc'),
    blocks: [],
  };
}

function withDefaults(data?: Partial<PageDescWithMenuState>): PageDescWithMenuState {
  const defaults = makeDefault();
  return {
    ...defaults,
    ...(data || {}),
    menuItems: data?.menuItems?.length ? data.menuItems : defaults.menuItems,
    introBold: data?.introBold ?? defaults.introBold,
    introP1: data?.introP1 ?? defaults.introP1,
    introP2: data?.introP2 ?? defaults.introP2,
    blocks: data?.blocks ?? defaults.blocks,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function newBlock(type: CourseDescBlockType): CourseDescBlock {
  switch (type) {
    case 'paragraph':         return { type, p: normalize('', 'cdescDesc') };
    case 'heading-paragraph': return { type, h: normalize('', 'cdescHeading'), p: normalize('', 'cdescDesc') };
    case 'heading-bullets':   return { type, h: normalize('', 'cdescHeading'), bullets: [normalize('', 'cdescBullet')] };
    case 'bullets':           return { type, bullets: [normalize('', 'cdescBullet')] };
    case 'items':             return { type, h: normalize('', 'cdescHeading'), items: [{ h: normalize('', 'cdescItemHeading'), p: normalize('', 'cdescDesc') }] };
    case 'note':              return { type, p: normalize('', 'cdescNote') };
  }
}

const BLOCK_LABELS: Record<CourseDescBlockType, string> = {
  paragraph: 'Paragraph',
  'heading-paragraph': 'Heading + Paragraph',
  'heading-bullets': 'Heading + Bullets',
  bullets: 'Bullets only',
  items: 'Item list (heading per item)',
  note: 'Note / callout',
};

function BlockEditor({ block, onUpdate, onRemove }: {
  block: CourseDescBlock;
  onUpdate: (b: CourseDescBlock) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  return (
    <div className="rounded border border-slate-200 bg-white mb-2">
      <div className="flex items-center justify-between px-3 py-2 bg-slate-50 cursor-pointer" onClick={() => setOpen(o => !o)}>
        <span className="text-xs font-semibold text-slate-600">{BLOCK_LABELS[block.type]}</span>
        <div className="flex gap-2 items-center">
          <button onClick={e => { e.stopPropagation(); onRemove(); }} className="btn-danger text-xs">✕</button>
          <svg viewBox="0 0 20 20" fill="currentColor" className={`h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>
      </div>
      {open && (
        <div className="px-3 py-2">
          {(block.type === 'heading-paragraph' || block.type === 'heading-bullets' || block.type === 'items') && (
            <RichTextField label="Heading" value={asTV(block.h ?? '', 'cdescHeading')}
              defaultKey="cdescHeading" onChange={v => onUpdate({ ...block, h: v })} />
          )}
          {(block.type === 'paragraph' || block.type === 'heading-paragraph') && (
            <RichTextField label="Paragraph text" multiline value={asTV(block.p ?? '', 'cdescDesc')}
              defaultKey="cdescDesc" onChange={v => onUpdate({ ...block, p: v })} />
          )}
          {block.type === 'note' && (
            <RichTextField label="Note text" multiline value={asTV(block.p ?? '', 'cdescNote')}
              defaultKey="cdescNote" onChange={v => onUpdate({ ...block, p: v })} />
          )}
          {(block.type === 'heading-bullets' || block.type === 'bullets') && (
            <div>
              <span className="text-xs font-medium text-slate-500">Bullet items</span>
              <div className="space-y-1 mt-1">
                {(block.bullets ?? []).map((b, bi) => (
                  <div key={bi} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <RichTextField label={`Bullet ${bi + 1}`} value={asTV(b, 'cdescBullet')}
                        defaultKey="cdescBullet"
                        onChange={v => { const bullets = [...(block.bullets ?? [])]; bullets[bi] = v; onUpdate({ ...block, bullets }); }} />
                    </div>
                    <button onClick={() => { const bullets = (block.bullets ?? []).filter((_, idx) => idx !== bi); onUpdate({ ...block, bullets }); }}
                      className="btn-danger mt-5">✕</button>
                  </div>
                ))}
              </div>
              <button onClick={() => onUpdate({ ...block, bullets: [...(block.bullets ?? []), normalize('', 'cdescBullet')] })}
                className="btn-ghost text-xs w-full mt-1">+ Add bullet</button>
            </div>
          )}
          {block.type === 'items' && (
            <div>
              <span className="text-xs font-medium text-slate-500">Items</span>
              <div className="space-y-2 mt-1">
                {(block.items ?? []).map((item, ii) => (
                  <div key={ii} className="rounded border border-slate-100 bg-slate-50 p-2 relative">
                    <button onClick={() => { const items = (block.items ?? []).filter((_, idx) => idx !== ii); onUpdate({ ...block, items }); }}
                      className="btn-danger absolute right-2 top-2">✕</button>
                    <RichTextField label="Item heading" value={asTV(item.h, 'cdescItemHeading')} defaultKey="cdescItemHeading"
                      onChange={v => { const items = [...(block.items ?? [])]; items[ii] = { ...items[ii], h: v }; onUpdate({ ...block, items }); }} />
                    <RichTextField label="Item text" multiline value={asTV(item.p, 'cdescDesc')} defaultKey="cdescDesc"
                      onChange={v => { const items = [...(block.items ?? [])]; items[ii] = { ...items[ii], p: v }; onUpdate({ ...block, items }); }} />
                  </div>
                ))}
              </div>
              <button onClick={() => onUpdate({ ...block, items: [...(block.items ?? []), { h: normalize('', 'cdescItemHeading'), p: normalize('', 'cdescDesc') }] })}
                className="btn-ghost text-xs w-full mt-1">+ Add item</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PageDescWithMenuScreen() {
  const [components, setComponents] = useState<PageDescWithMenuComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<PageDescWithMenuState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');
  const [addBlockType, setAddBlockType] = useState<CourseDescBlockType>('paragraph');

  useEffect(() => {
    api.get<{ data: PageDescWithMenuContent }>('/content/vls-page-desc-menu-components')
      .then(row => {
        const comps = (row?.data as PageDescWithMenuContent)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(withDefaults(comps[0].data)); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<PageDescWithMenuState>) => {
    setState(prev => ({ ...prev, ...patch })); setSaved(false);
  }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(withDefaults(c.data)); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }

  function duplicateComponent() {
    setActiveId(`pdm-${Date.now().toString(36)}`);
    setName(`Copy of ${name || 'Page Description'}`);
    setState(clone(state));
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `pdm-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `pdm-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-page-desc-menu-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-page-desc-menu-components', { components: comps });
    setComponents(comps); newComponent();
  }

  function generate() {
    const html = wrapGeneratedHtml('Page Description with Menu', generatePageDescWithMenuHtml(state));
    setPreviewHtml(html);
    setActiveTab('preview');
  }

  function updateBlock(i: number, b: CourseDescBlock) {
    const blocks = [...state.blocks]; blocks[i] = b; upd({ blocks });
  }
  function removeBlock(i: number) { upd({ blocks: state.blocks.filter((_, idx) => idx !== i) }); }
  function addBlock() { upd({ blocks: [...state.blocks, newBlock(addBlockType)] }); }

  function patchMenuItem(i: number, patch: Partial<PageDescMenuItem>) {
    const menuItems = [...state.menuItems];
    menuItems[i] = { ...menuItems[i], ...patch };
    upd({ menuItems });
  }
  function removeMenuItem(i: number) { upd({ menuItems: state.menuItems.filter((_, idx) => idx !== i) }); }
  function addMenuItem() { upd({ menuItems: [...state.menuItems, { title: '', scrollTarget: '' }] }); }
  function applyDefaultMenuItems() {
    upd({
      menuItems: [
        { title: 'Course Overview', scrollTarget: '#course-overview' },
        { title: 'Features', scrollTarget: '#course-features' },
        { title: 'Tutor', scrollTarget: '#course-tutor' },
        { title: 'FAQ', scrollTarget: '#course-faq' },
        { title: 'Curriculum', scrollTarget: '#course-curriculum' },
        { title: 'Pricing', scrollTarget: '#course-pricing' },
      ],
    });
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Page Desc with Menu</h1>
          <p className="text-xs text-slate-400 mt-0.5">Sticky course navigation with compact enrolment banner</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
            <p className="section-label mt-0">Saved Components</p>
            <div className="flex gap-2 mb-3">
              <select className="input flex-1" value={activeId || ''} onChange={e => loadComponent(e.target.value)}>
                <option value="">— select to load —</option>
                {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={newComponent} className="btn-ghost text-xs px-3">+ New</button>
              <button onClick={duplicateComponent} disabled={!name && state.blocks.length === 0} className="btn-ghost text-xs px-3">Duplicate</button>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. FA1 Course Guide"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          <p className="section-label">Section Header</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Icon (emoji)">
              <input className="input" value={state.icon} placeholder="📖"
                onChange={e => upd({ icon: e.target.value })} />
            </Field>
            <Field label="Title size (px)">
              <input type="number" className="input" min={10} max={36} value={state.titleSize}
                onChange={e => upd({ titleSize: Number(e.target.value) })} />
            </Field>
          </div>
          <Field label="Title text">
            <input className="input" value={state.title} placeholder="About This Course"
              onChange={e => upd({ title: e.target.value })} />
          </Field>
          <Field label="Title colour">
            <div className="flex gap-2 items-center">
              <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(state.titleTc) ? state.titleTc : '#1a1a1a'}
                onChange={e => upd({ titleTc: e.target.value })}
                className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
              <input type="text" value={state.titleTc} className="input"
                onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) upd({ titleTc: e.target.value }); }} />
            </div>
          </Field>

          <p className="section-label">Sidebar Menu</p>
          <Field label="Menu section title" hint="Shown above nav items, e.g. 'In this guide'">
            <input className="input" value={state.menuTitle} placeholder="In this guide"
              onChange={e => upd({ menuTitle: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Menu background">
              <div className="flex gap-2 items-center">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(state.menuBg) ? state.menuBg : '#f9fafb'}
                  onChange={e => upd({ menuBg: e.target.value })}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                <input type="text" value={state.menuBg} className="input"
                  onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) upd({ menuBg: e.target.value }); }} />
              </div>
            </Field>
            <Field label="Item hover colour">
              <div className="flex gap-2 items-center">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(state.menuActiveBg) ? state.menuActiveBg : '#204280'}
                  onChange={e => upd({ menuActiveBg: e.target.value })}
                  className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                <input type="text" value={state.menuActiveBg} className="input"
                  onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) upd({ menuActiveBg: e.target.value }); }} />
              </div>
            </Field>
          </div>

          <p className="section-label mt-4">Banner</p>
          <Field label="Banner heading">
            <input className="input" value={state.bannerHeading ?? ''} placeholder="Start your ACCA journey with VLS"
              onChange={e => upd({ bannerHeading: e.target.value })} />
          </Field>
          <Field label="Banner subheading">
            <textarea className="input min-h-[72px]" value={state.bannerSubheading ?? ''} placeholder="Study with structured lessons, expert tutors, revision support and exam-focused resources."
              onChange={e => upd({ bannerSubheading: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="CTA text">
              <input className="input" value={state.bannerCtaText ?? ''} placeholder="Enrol Now"
                onChange={e => upd({ bannerCtaText: e.target.value })} />
            </Field>
            <Field label="CTA URL" hint="Leave as #course-pricing to scroll to pricing">
              <input className="input" value={state.bannerCtaUrl ?? ''} placeholder="#course-pricing"
                onChange={e => upd({ bannerCtaUrl: e.target.value })} />
            </Field>
          </div>
          <label className="mb-4 flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={!!state.bannerCtaNewTab}
              onChange={e => upd({ bannerCtaNewTab: e.target.checked })} />
            Open CTA in a new tab
          </label>

          <p className="section-label mt-4">Menu Items</p>
          <p className="text-xs text-slate-400 mb-3">Each item scrolls to a same-page anchor. The generated HTML adds these stable IDs to the matching course page sections when missing.</p>
          {state.menuItems.map((item, i) => (
            <div key={i} className="rounded border border-slate-200 bg-white p-3 mb-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">Item {i + 1}</span>
                <button onClick={() => removeMenuItem(i)} className="btn-danger text-xs">✕</button>
              </div>
              <Field label="Link title">
                <input className="input" value={item.title} placeholder="Overview"
                  onChange={e => patchMenuItem(i, { title: e.target.value })} />
              </Field>
              <Field label="Scroll target" hint="CSS selector — e.g. .section-overview or #overview">
                <input className="input" value={item.scrollTarget} placeholder=".section-overview or #overview"
                  onChange={e => patchMenuItem(i, { scrollTarget: e.target.value })} />
              </Field>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={addMenuItem} className="btn-ghost text-xs w-full">+ Add menu item</button>
            <button onClick={applyDefaultMenuItems} className="btn-ghost text-xs w-full">Use course defaults</button>
          </div>

          <p className="section-label">Legacy Description Fields</p>
          <p className="text-xs text-slate-400 mb-3">Kept for older saved data, but no longer rendered by this component.</p>
          <RichTextField label="Bold intro paragraph" multiline value={asTV(state.introBold, 'cdescIntroBold')}
            defaultKey="cdescIntroBold" onChange={v => upd({ introBold: v })} />
          <RichTextField label="Intro paragraph 1" multiline value={asTV(state.introP1, 'cdescDesc')}
            defaultKey="cdescDesc" onChange={v => upd({ introP1: v })} />
          <RichTextField label="Intro paragraph 2" multiline value={asTV(state.introP2, 'cdescDesc')}
            defaultKey="cdescDesc" onChange={v => upd({ introP2: v })} />

          <p className="section-label">Expandable Blocks</p>
          <p className="text-xs text-slate-400 mb-3">These blocks are hidden behind "Read more".</p>

          {state.blocks.map((block, i) => (
            <BlockEditor key={i} block={block}
              onUpdate={b => updateBlock(i, b)}
              onRemove={() => removeBlock(i)} />
          ))}

          <div className="flex gap-2 mt-2">
            <select className="input flex-1" value={addBlockType} onChange={e => setAddBlockType(e.target.value as CourseDescBlockType)}>
              {(Object.keys(BLOCK_LABELS) as CourseDescBlockType[]).map(t => (
                <option key={t} value={t}>{BLOCK_LABELS[t]}</option>
              ))}
            </select>
            <button onClick={addBlock} className="btn-ghost text-xs px-4">+ Add block</button>
          </div>
        </div>
      </div>

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
              ? `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
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
