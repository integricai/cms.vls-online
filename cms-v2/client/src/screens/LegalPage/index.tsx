import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { LegalPageState, LegalPageComponent, PolicySection, PolicyBlock, PolicyBlockType } from '../../types/cms';
import { generateLegalPageHtml } from './generateHtml';
import Field from '../../components/Field';

const BLOCK_TYPES: { value: PolicyBlockType; label: string }[] = [
  { value: 'paragraph',  label: 'Paragraph' },
  { value: 'bullets',    label: 'Bullets' },
  { value: 'table',      label: 'Table' },
  { value: 'cards',      label: 'Info Cards' },
  { value: 'rights',     label: 'Rights Cards' },
  { value: 'definitions', label: 'Definitions' },
  { value: 'alpha-list', label: 'Alpha List (A, B, C…)' },
  { value: 'tags',       label: 'Tag Chips' },
  { value: 'icon-cards', label: 'Icon Cards' },
  { value: 'link-cards', label: 'Link Cards' },
  { value: 'cta-banner', label: 'CTA Banner' },
  { value: 'callout',    label: 'Callout Box' },
];

function makeDefault(): LegalPageState {
  return { hdrBg: '#0d1f3c', eyebrow: '', title: '', navWidth: 220, navBg: '#f8fafc', accent: '#1a56a3', meta: [], sections: [] };
}

function makeSection(): PolicySection {
  return { id: `sec-${Date.now().toString(36)}`, title: 'New Section', bg: '#ffffff', blocks: [] };
}

function makeBlock(type: PolicyBlockType): PolicyBlock {
  const defaults: Partial<Record<PolicyBlockType, Partial<PolicyBlock>>> = {
    bullets:    { items: [''] },
    table:      { headers: 'Column 1|Column 2', rows: 'Row 1 A|Row 1 B' },
    cards:      { cols: 2, items: [{ label: '', text: '' }] },
    rights:     { cols: 2, items: [{ icon: '📋', title: '', text: '' }] },
    definitions:{ items: [{ term: '', desc: '' }] },
    'alpha-list': { items: [''] },
    tags:       { cols: 4, items: [''] },
    'icon-cards':{ cols: 2, items: [{ icon: '🔑', iconBg: '#fef3c7', title: '', desc: '' }] },
    'link-cards':{ cols: 2, items: [{ icon: '📄', title: '', desc: '', linkText: 'Read →', url: '' }] },
    'cta-banner':{ bg: '#0d1f3c', titleColor: '#ffffff', descColor: '#94a3b8', btnBg: '#1a56a3', btnColor: '#ffffff', title: '', desc: '', btnText: 'Contact us →', btnUrl: '#' },
    callout:    { icon: '⚠️', bg: '#fff7ed', color: '#b45309', text: '' },
  };
  return { type, text: '', ...defaults[type] };
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

function BlockEditor({ block, onChange }: { block: PolicyBlock; onChange: (patch: Partial<PolicyBlock>) => void }) {
  const updItems = (idx: number, patch: any) => {
    const items = [...(block.items || [])]; items[idx] = { ...items[idx], ...patch }; onChange({ items });
  };
  const addItem  = (template: any) => onChange({ items: [...(block.items || []), template] });
  const delItem  = (idx: number) => onChange({ items: (block.items || []).filter((_: any, i: number) => i !== idx) });
  const setStrItems = (val: string) => onChange({ items: val.split('\n') });

  if (block.type === 'paragraph') {
    return (
      <textarea className="input" rows={4} value={block.text || ''}
        onChange={e => onChange({ text: e.target.value })} placeholder="Paragraph text…" />
    );
  }

  if (block.type === 'bullets' || block.type === 'tags' || block.type === 'alpha-list') {
    const label = block.type === 'bullets' ? 'Items (one per line)' : block.type === 'tags' ? 'Tags (one per line)' : 'Items A, B, C… (one per line)';
    return (
      <div className="space-y-2">
        <textarea className="input" rows={4} value={(block.items || []).join('\n')}
          onChange={e => setStrItems(e.target.value)} placeholder={label} />
        {block.type === 'tags' && (
          <Field label="Columns">
            <input type="number" className="input" min={1} max={6} value={block.cols || 4}
              onChange={e => onChange({ cols: Number(e.target.value) })} />
          </Field>
        )}
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div className="space-y-2">
        <Field label="Headers (pipe-separated)">
          <input className="input" value={block.headers || ''} placeholder="Name|Role|Details"
            onChange={e => onChange({ headers: e.target.value })} />
        </Field>
        <Field label="Rows (one per line, pipe-separated)">
          <textarea className="input" rows={4} value={block.rows || ''}
            placeholder={"John|Admin|Full access\nJane|Editor|Limited"}
            onChange={e => onChange({ rows: e.target.value })} />
        </Field>
      </div>
    );
  }

  if (block.type === 'cards') {
    return (
      <div className="space-y-2">
        <Field label="Columns"><input type="number" className="input" min={1} max={4} value={block.cols || 2} onChange={e => onChange({ cols: Number(e.target.value) })} /></Field>
        {(block.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded p-2">
            <div className="flex-1 space-y-1">
              <input className="input" value={item.label || ''} placeholder="Label (eyebrow)" onChange={e => updItems(idx, { label: e.target.value })} />
              <textarea className="input" rows={2} value={item.text || ''} placeholder="Card text" onChange={e => updItems(idx, { text: e.target.value })} />
            </div>
            <button onClick={() => delItem(idx)} className="btn-danger mt-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem({ label: '', text: '' })} className="btn-ghost text-xs w-full">+ Add card</button>
      </div>
    );
  }

  if (block.type === 'rights') {
    return (
      <div className="space-y-2">
        <Field label="Columns"><input type="number" className="input" min={1} max={4} value={block.cols || 2} onChange={e => onChange({ cols: Number(e.target.value) })} /></Field>
        {(block.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded p-2">
            <div className="flex-1 space-y-1">
              <div className="flex gap-2">
                <input className="input w-16 text-center" value={item.icon || '📋'} placeholder="Icon" onChange={e => updItems(idx, { icon: e.target.value })} />
                <input className="input flex-1" value={item.title || ''} placeholder="Right title" onChange={e => updItems(idx, { title: e.target.value })} />
              </div>
              <textarea className="input" rows={2} value={item.text || ''} placeholder="Description" onChange={e => updItems(idx, { text: e.target.value })} />
            </div>
            <button onClick={() => delItem(idx)} className="btn-danger mt-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem({ icon: '📋', title: '', text: '' })} className="btn-ghost text-xs w-full">+ Add right</button>
      </div>
    );
  }

  if (block.type === 'definitions') {
    return (
      <div className="space-y-2">
        {(block.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded p-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <input className="input" value={item.term || ''} placeholder="Term" onChange={e => updItems(idx, { term: e.target.value })} />
              <input className="input" value={item.desc || ''} placeholder="Definition" onChange={e => updItems(idx, { desc: e.target.value })} />
            </div>
            <button onClick={() => delItem(idx)} className="btn-danger mt-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem({ term: '', desc: '' })} className="btn-ghost text-xs w-full">+ Add definition</button>
      </div>
    );
  }

  if (block.type === 'icon-cards') {
    return (
      <div className="space-y-2">
        <Field label="Columns"><input type="number" className="input" min={1} max={4} value={block.cols || 2} onChange={e => onChange({ cols: Number(e.target.value) })} /></Field>
        {(block.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded p-2">
            <div className="flex-1 space-y-1">
              <div className="flex gap-2">
                <input className="input w-16 text-center" value={item.icon || '🔑'} placeholder="Icon" onChange={e => updItems(idx, { icon: e.target.value })} />
                <div className="flex gap-1 items-center">
                  <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(item.iconBg || '') ? item.iconBg : '#fef3c7'}
                    onChange={e => updItems(idx, { iconBg: e.target.value })} className="w-8 h-8 p-0.5 border border-slate-300 rounded cursor-pointer" />
                  <span className="text-xs text-slate-400">bg</span>
                </div>
              </div>
              <input className="input" value={item.title || ''} placeholder="Card title" onChange={e => updItems(idx, { title: e.target.value })} />
              <textarea className="input" rows={2} value={item.desc || ''} placeholder="Description" onChange={e => updItems(idx, { desc: e.target.value })} />
            </div>
            <button onClick={() => delItem(idx)} className="btn-danger mt-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem({ icon: '🔑', iconBg: '#fef3c7', title: '', desc: '' })} className="btn-ghost text-xs w-full">+ Add icon card</button>
      </div>
    );
  }

  if (block.type === 'link-cards') {
    return (
      <div className="space-y-2">
        <Field label="Columns"><input type="number" className="input" min={1} max={4} value={block.cols || 2} onChange={e => onChange({ cols: Number(e.target.value) })} /></Field>
        {(block.items || []).map((item: any, idx: number) => (
          <div key={idx} className="flex gap-2 items-start border border-slate-200 rounded p-2">
            <div className="flex-1 space-y-1">
              <div className="flex gap-2">
                <input className="input w-16 text-center" value={item.icon || '📄'} placeholder="Icon" onChange={e => updItems(idx, { icon: e.target.value })} />
                <input className="input flex-1" value={item.title || ''} placeholder="Title" onChange={e => updItems(idx, { title: e.target.value })} />
              </div>
              <textarea className="input" rows={2} value={item.desc || ''} placeholder="Description" onChange={e => updItems(idx, { desc: e.target.value })} />
              <div className="flex gap-2">
                <input className="input flex-1" value={item.linkText || ''} placeholder="Link text (Read →)" onChange={e => updItems(idx, { linkText: e.target.value })} />
                <input className="input flex-1" value={item.url || ''} placeholder="URL" onChange={e => updItems(idx, { url: e.target.value })} />
              </div>
            </div>
            <button onClick={() => delItem(idx)} className="btn-danger mt-1">✕</button>
          </div>
        ))}
        <button onClick={() => addItem({ icon: '📄', title: '', desc: '', linkText: 'Read →', url: '' })} className="btn-ghost text-xs w-full">+ Add link card</button>
      </div>
    );
  }

  if (block.type === 'cta-banner') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <ColorInput label="Banner bg" value={block.bg || '#0d1f3c'} onChange={v => onChange({ bg: v })} />
          <ColorInput label="Title colour" value={block.titleColor || '#ffffff'} onChange={v => onChange({ titleColor: v })} />
          <ColorInput label="Desc colour" value={block.descColor || '#94a3b8'} onChange={v => onChange({ descColor: v })} />
          <ColorInput label="Button bg" value={block.btnBg || '#1a56a3'} onChange={v => onChange({ btnBg: v })} />
        </div>
        <Field label="Title"><input className="input" value={block.title || ''} onChange={e => onChange({ title: e.target.value })} /></Field>
        <Field label="Description"><textarea className="input" rows={2} value={block.desc || ''} onChange={e => onChange({ desc: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Field label="Button text" className="flex-1"><input className="input" value={block.btnText || ''} onChange={e => onChange({ btnText: e.target.value })} /></Field>
          <Field label="Button URL" className="flex-1"><input className="input" value={block.btnUrl || '#'} onChange={e => onChange({ btnUrl: e.target.value })} /></Field>
        </div>
      </div>
    );
  }

  if (block.type === 'callout') {
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <Field label="Icon" className="w-20"><input className="input text-center" value={block.icon || '⚠️'} onChange={e => onChange({ icon: e.target.value })} /></Field>
          <ColorInput label="Background" value={block.bg || '#fff7ed'} onChange={v => onChange({ bg: v })} />
          <ColorInput label="Text colour" value={block.color || '#b45309'} onChange={v => onChange({ color: v })} />
        </div>
        <Field label="Text"><textarea className="input" rows={3} value={block.text || ''} onChange={e => onChange({ text: e.target.value })} /></Field>
      </div>
    );
  }

  return <p className="text-xs text-slate-400">Unknown block type: {block.type}</p>;
}

export default function LegalPageScreen() {
  const [components, setComponents] = useState<LegalPageComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<LegalPageState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<any>('/content/vls-policy-components')
      .then(row => {
        const raw = row?.data as any;
        const comps: LegalPageComponent[] = (raw?.components || []).map((c: any) => ({
          ...c,
          data: c.data ? {
            ...c.data,
            sections: (c.data.sections || []).map((s: any, si: number) =>
              s.id ? s : { ...s, id: `sec-${c.id || si}-${si}` }
            ),
          } : makeDefault(),
        }));
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<LegalPageState>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    const data = c.data ? {
      ...c.data,
      sections: (c.data.sections || []).map((s: any, si: number) =>
        s.id ? s : { ...s, id: `sec-${c.id}-${si}` }
      ),
    } : makeDefault();
    setActiveId(c.id); setName(c.name); setState(data); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `pol-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `pol-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-policy-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-policy-components', { components: comps });
    setComponents(comps); newComponent();
  }

  // Section helpers
  const updSection = (si: number, patch: Partial<PolicySection>) => {
    const sections = [...state.sections]; sections[si] = { ...sections[si], ...patch }; upd({ sections });
  };
  const addSection = () => {
    const s = makeSection();
    upd({ sections: [...state.sections, s] });
    setExpandedSections(prev => new Set([...prev, s.id]));
  };
  const removeSection = (si: number) => upd({ sections: state.sections.filter((_, i) => i !== si) });
  const toggleSection = (id: string) => setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Block helpers
  const updBlock = (si: number, bi: number, patch: Partial<PolicyBlock>) => {
    const sections = [...state.sections];
    const blocks = [...sections[si].blocks];
    blocks[bi] = { ...blocks[bi], ...patch };
    sections[si] = { ...sections[si], blocks };
    upd({ sections });
  };
  const addBlock = (si: number, type: PolicyBlockType) => {
    const sections = [...state.sections];
    sections[si] = { ...sections[si], blocks: [...sections[si].blocks, makeBlock(type)] };
    upd({ sections });
  };
  const removeBlock = (si: number, bi: number) => {
    const sections = [...state.sections];
    sections[si] = { ...sections[si], blocks: sections[si].blocks.filter((_, i) => i !== bi) };
    upd({ sections });
  };

  // Meta helpers
  const updMeta = (idx: number, val: string) => {
    const meta = [...state.meta]; meta[idx] = val; upd({ meta });
  };

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  if (loadError) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-md text-center">
        <p className="text-sm font-semibold text-red-700 mb-1">Failed to load content</p>
        <p className="text-xs text-red-500 font-mono break-all">{loadError}</p>
        <button onClick={() => window.location.reload()} className="mt-4 btn-primary text-xs">Reload page</button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Legal Page</h1>
          <p className="text-xs text-slate-400 mt-0.5">Scrollable legal doc with sticky sidebar nav</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(generateLegalPageHtml(state)); setActiveTab('preview'); }}
            className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Component manager */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="section-label mt-0">Saved Pages</p>
            <div className="flex gap-2 mb-3">
              <select className="input flex-1" value={activeId || ''} onChange={e => loadComponent(e.target.value)}>
                <option value="">— select to load —</option>
                {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={newComponent} className="btn-ghost text-xs px-3">+ New</button>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Page name (e.g. Privacy Policy)">
              <input className="input" value={name} placeholder="Privacy Policy"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {/* Header settings */}
          <div>
            <p className="section-label">Header</p>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Header background" value={state.hdrBg} onChange={v => upd({ hdrBg: v })} />
              <ColorInput label="Accent colour" value={state.accent} onChange={v => upd({ accent: v })} />
            </div>
            <Field label="Eyebrow text">
              <input className="input" value={state.eyebrow} placeholder="LEGAL" onChange={e => upd({ eyebrow: e.target.value })} />
            </Field>
            <Field label="Page title">
              <input className="input" value={state.title} placeholder="Privacy Policy" onChange={e => upd({ title: e.target.value })} />
            </Field>

            <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Meta dots (e.g. "Last updated: 2025")</p>
            <div className="space-y-1.5 mb-1">
              {state.meta.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <input className="input flex-1" value={m} placeholder="Last updated: 2025"
                    onChange={e => updMeta(idx, e.target.value)} />
                  <button onClick={() => upd({ meta: state.meta.filter((_, i) => i !== idx) })} className="btn-danger">✕</button>
                </div>
              ))}
            </div>
            <button onClick={() => upd({ meta: [...state.meta, ''] })} className="btn-ghost text-xs w-full">+ Add meta dot</button>
          </div>

          {/* Navigation settings */}
          <div>
            <p className="section-label">Sidebar Navigation</p>
            <div className="grid grid-cols-2 gap-2">
              <ColorInput label="Nav background" value={state.navBg} onChange={v => upd({ navBg: v })} />
              <Field label="Nav width (px)">
                <input type="number" className="input" min={140} max={340} value={state.navWidth}
                  onChange={e => upd({ navWidth: Number(e.target.value) })} />
              </Field>
            </div>
          </div>

          {/* Sections */}
          <div>
            <p className="section-label">Sections</p>
            <div className="space-y-3 mb-2">
              {state.sections.map((sec, si) => {
                const isOpen = expandedSections.has(sec.id);
                return (
                  <div key={sec.id} className="rounded border border-slate-200 bg-white">
                    {/* Section header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t border-b border-slate-200">
                      <button onClick={() => toggleSection(sec.id)} className="flex-1 text-left text-sm font-semibold text-slate-700 truncate">
                        {isOpen ? '▼' : '▶'} {si + 1}. {sec.title || '(untitled)'}
                      </button>
                      <button onClick={() => removeSection(si)} className="btn-danger text-xs px-2">✕</button>
                    </div>

                    {isOpen && (
                      <div className="p-3 space-y-3">
                        <div className="flex gap-2">
                          <Field label="Section title" className="flex-1">
                            <input className="input" value={sec.title} onChange={e => updSection(si, { title: e.target.value })} />
                          </Field>
                          <ColorInput label="Background" value={sec.bg} onChange={v => updSection(si, { bg: v })} />
                        </div>

                        {/* Blocks */}
                        <div className="space-y-2">
                          {sec.blocks.map((block, bi) => {
                            const typeLabel = BLOCK_TYPES.find(t => t.value === block.type)?.label || block.type;
                            return (
                              <div key={bi} className="rounded border border-slate-200 bg-slate-50 p-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5">{typeLabel}</span>
                                  <button onClick={() => removeBlock(si, bi)} className="btn-danger ml-auto text-xs px-2">✕</button>
                                </div>
                                <BlockEditor block={block} onChange={patch => updBlock(si, bi, patch)} />
                              </div>
                            );
                          })}
                        </div>

                        {/* Add block */}
                        <div className="flex gap-2 items-center">
                          <select id={`add-block-${si}`} className="input flex-1">
                            {BLOCK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <button
                            onClick={() => {
                              const sel = document.getElementById(`add-block-${si}`) as HTMLSelectElement;
                              addBlock(si, sel.value as PolicyBlockType);
                            }}
                            className="btn-ghost text-xs px-3">+ Add block</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button onClick={addSection} className="btn-ghost text-xs w-full">+ Add section</button>
          </div>
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh;overflow:hidden;">${previewHtml}</body></html>`
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
