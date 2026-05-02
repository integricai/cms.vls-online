import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { CourseHeroRightState, CourseHeroRightComponent, CourseHeroRightContent, CourseHeroRightItem, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateCourseHeroRightHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';

function makeDefault(): CourseHeroRightState {
  return {
    bg: '#ffffff', border: '#e2e8f0',
    padTop: 24, padBot: 24, padLeft: 24, padRight: 24,
    radius: 12, divider: '#f1f5f9', iconBg: '#f0f4ff',
    badgeBg: '#e2e8f0', badgeTc: '#374151',
    labelText: 'THIS COURSE INCLUDES',
    ctaUrl: '#', ctaText: 'Enrol Now →',
    ctaBg: '#0f172a', ctaTc: '#ffffff', ctaRadius: 8,
    items: [],
  };
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

export default function CourseHeroRightScreen() {
  const [components, setComponents] = useState<CourseHeroRightComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<CourseHeroRightState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: CourseHeroRightContent }>('/content/vls-course-hero-right-components')
      .then(row => {
        const comps = (row?.data as CourseHeroRightContent)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<CourseHeroRightState>) => {
    setState(prev => ({ ...prev, ...patch })); setSaved(false);
  }, []);

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
        if (!comps.find(c => c.id === id)) { id = `chr-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `chr-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await api.put('/content/vls-course-hero-right-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-course-hero-right-components', { components: comps });
    setComponents(comps); newComponent();
  }

  function updateItem(i: number, patch: Partial<CourseHeroRightItem>) {
    const items = [...state.items]; items[i] = { ...items[i], ...patch }; upd({ items });
  }
  function addItem() {
    upd({ items: [...state.items, { icon: '📚', title: normalize('', 'chrItemTitle'), desc: normalize('', 'chrItemDesc'), badge: '' }] });
  }
  function removeItem(i: number) { upd({ items: state.items.filter((_, idx) => idx !== i) }); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Right Hero Section</h1>
          <p className="text-xs text-slate-400 mt-0.5">Course page hero — right column card panel</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(generateCourseHeroRightHtml(state)); setActiveTab('preview'); }}
            className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
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
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. FA1 Course Panel"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          <p className="section-label">Card Styling</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
            <ColorRow label="Border" value={state.border} onChange={v => upd({ border: v })} />
            <ColorRow label="Item divider" value={state.divider} onChange={v => upd({ divider: v })} />
            <ColorRow label="Icon background" value={state.iconBg} onChange={v => upd({ iconBg: v })} />
            <ColorRow label="Badge background" value={state.badgeBg} onChange={v => upd({ badgeBg: v })} />
            <ColorRow label="Badge text" value={state.badgeTc} onChange={v => upd({ badgeTc: v })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Border radius (px)">
              <input type="number" className="input" min={0} max={40} value={state.radius}
                onChange={e => upd({ radius: Number(e.target.value) })} />
            </Field>
            {(['padTop','padBot','padLeft','padRight'] as const).map(k => (
              <Field key={k} label={k.replace('pad','Pad ').replace('Top','top').replace('Bot','bottom').replace('Left','left').replace('Right','right') + ' (px)'}>
                <input type="number" className="input" min={0} max={200} value={state[k]}
                  onChange={e => upd({ [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>

          <p className="section-label">Section Label</p>
          <Field label="Label text">
            <input className="input" value={state.labelText} placeholder="THIS COURSE INCLUDES"
              onChange={e => upd({ labelText: e.target.value })} />
          </Field>

          <p className="section-label">Items</p>
          <div className="space-y-2 mb-2">
            {state.items.map((item, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeItem(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <Field label="Icon (emoji or URL)">
                  <input className="input" value={item.icon} placeholder="📚 or https://..."
                    onChange={e => updateItem(i, { icon: e.target.value })} />
                </Field>
                <RichTextField label="Title" value={asTV(item.title, 'chrItemTitle')}
                  defaultKey="chrItemTitle" onChange={v => updateItem(i, { title: v })} />
                <RichTextField label="Description" value={asTV(item.desc, 'chrItemDesc')}
                  defaultKey="chrItemDesc" onChange={v => updateItem(i, { desc: v })} />
                <Field label="Badge (optional)" hint="e.g. 46 hours">
                  <input className="input" value={item.badge} placeholder="46 hours"
                    onChange={e => updateItem(i, { badge: e.target.value })} />
                </Field>
              </div>
            ))}
          </div>
          <button onClick={addItem} className="btn-ghost text-xs w-full mb-1">+ Add item</button>

          <p className="section-label">CTA Button</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Button background" value={state.ctaBg} onChange={v => upd({ ctaBg: v })} />
            <ColorRow label="Button text" value={state.ctaTc} onChange={v => upd({ ctaTc: v })} />
          </div>
          <Field label="Border radius (px)">
            <input type="number" className="input" min={0} max={40} value={state.ctaRadius}
              onChange={e => upd({ ctaRadius: Number(e.target.value) })} />
          </Field>
          <Field label="Button text">
            <input className="input" value={state.ctaText} placeholder="Enrol Now →"
              onChange={e => upd({ ctaText: e.target.value })} />
          </Field>
          <Field label="Button URL">
            <input className="input" value={state.ctaUrl} placeholder="https://..."
              onChange={e => upd({ ctaUrl: e.target.value })} />
          </Field>
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'}
            className="flex-1 w-full border-0 bg-slate-50" sandbox="allow-same-origin" />
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
