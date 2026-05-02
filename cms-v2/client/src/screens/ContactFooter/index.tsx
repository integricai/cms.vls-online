import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { CfState, CfComponent, CfContent, CfItem, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateCfHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';

function makeDefault(): CfState {
  return {
    padTop: 24, padBot: 24, padLeft: 48, padRight: 48,
    bg: '#ffffff', border: '#e5e7eb', leftWidth: 55,
    label:   normalize('GET IN TOUCH', 'cfLabel'),
    company: normalize('Vertex Learning Solutions Ltd', 'cfCompany'),
    address: normalize('Kemp House, 128 City Road, London, EC1V 2NX, United Kingdom', 'cfAddress'),
    items: [
      { icon: '📞', iconBg: '#1e3a5f', title: normalize('Call / WhatsApp', 'cfItemTitle'), value: normalize('+44 7446 426261', 'cfItemValue'), href: 'tel:+447446426261' },
      { icon: '✉️', iconBg: '#1e3a5f', title: normalize('Email us', 'cfItemTitle'), value: normalize('office@vls-online.com', 'cfItemValue'), href: 'mailto:office@vls-online.com' },
      { icon: '📍', iconBg: '#2d1f5e', title: normalize('Registered office', 'cfItemTitle'), value: normalize('London, United Kingdom', 'cfItemValue'), href: '' },
    ],
  };
}

function ColorPair({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
        <input type="text" value={value} className="input"
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

function ItemRow({ item, onRemove, onChange }: {
  item: CfItem;
  onRemove: () => void;
  onChange: (p: Partial<CfItem>) => void;
}) {
  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }
  return (
    <div className="relative rounded-lg border border-slate-100 bg-slate-50 p-3 mb-2">
      <button onClick={onRemove} className="btn-danger absolute right-2 top-2">✕</button>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Icon (emoji)">
          <input className="input" value={item.icon} placeholder="📞"
            onChange={e => onChange({ icon: e.target.value })} />
        </Field>
        <ColorPair label="Icon background" value={item.iconBg || '#1e3a5f'} onChange={v => onChange({ iconBg: v })} />
      </div>
      <RichTextField label="Title" value={asTV(item.title, 'cfItemTitle')}
        defaultKey="cfItemTitle" onChange={v => onChange({ title: v })} />
      <RichTextField label="Value" value={asTV(item.value, 'cfItemValue')}
        defaultKey="cfItemValue" onChange={v => onChange({ value: v })} />
      <Field label="Link URL" hint="optional — tel:, mailto:, or https://">
        <input className="input" value={item.href} placeholder="tel:+447446426261"
          onChange={e => onChange({ href: e.target.value })} />
      </Field>
    </div>
  );
}

export default function ContactFooter() {
  const [components, setComponents] = useState<CfComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<CfState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: CfContent }>('/content/vls-cf-components')
      .then(row => {
        const comps: CfComponent[] = (row?.data as CfContent)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) {
          const first = comps[0];
          setActiveId(first.id);
          setName(first.name);
          setState(first.data || makeDefault());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const updateState = useCallback((patch: Partial<CfState>) => {
    setState(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  function updateItem(i: number, patch: Partial<CfItem>) {
    setState(prev => {
      const items = [...prev.items];
      items[i] = { ...items[i], ...patch };
      return { ...prev, items };
    });
    setSaved(false);
  }

  function addItem() {
    setState(prev => ({
      ...prev,
      items: [...prev.items, { icon: '📌', iconBg: '#1e3a5f', title: normalize('', 'cfItemTitle'), value: normalize('', 'cfItemValue'), href: '' }],
    }));
    setSaved(false);
  }

  function removeItem(i: number) {
    setState(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
    setSaved(false);
  }

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const comp = components.find(c => c.id === id);
    if (!comp) return;
    setActiveId(comp.id);
    setName(comp.name);
    setState(comp.data || makeDefault());
    setSaved(false);
  }

  function newComponent() {
    setActiveId(null);
    setName('');
    setState(makeDefault());
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) { alert('Please enter a component name before saving.'); return; }
    setSaving(true);
    try {
      let id = activeId;
      let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `cf-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else {
        id = `cf-${Date.now().toString(36)}`;
        comps.push({ id, name, data: state });
      }
      await api.put('/content/vls-cf-components', { components: comps });
      setComponents(comps);
      setActiveId(id);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteComponent() {
    if (!activeId) return;
    const comp = components.find(c => c.id === activeId);
    if (!window.confirm(`Delete "${comp?.name || 'this component'}"?`)) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-cf-components', { components: comps });
    setComponents(comps);
    newComponent();
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  return (
    <div className="flex h-full">
      <div className="w-[460px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Contact Footer</h1>
          <p className="text-xs text-slate-400 mt-0.5">Two-column contact strip with icon items</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Component'}
          </button>
          <button onClick={() => { setPreviewHtml(generateCfHtml(state)); setActiveTab('preview'); }}
            className="btn-success flex-1 justify-center">
            ⚡ Generate HTML
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
            <p className="section-label mt-0">Saved Components</p>
            <div className="flex gap-2 mb-3">
              <select className="input flex-1" value={activeId || ''}
                onChange={e => loadComponent(e.target.value)}>
                <option value="">— select to load —</option>
                {components.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={newComponent} className="btn-ghost text-xs px-3">+ New</button>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. VLS — Contact Footer"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          <p className="section-label">Section Styling</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Padding top (px)">
              <input type="number" className="input" min={0} max={200} value={state.padTop}
                onChange={e => updateState({ padTop: Number(e.target.value) })} />
            </Field>
            <Field label="Padding bottom (px)">
              <input type="number" className="input" min={0} max={200} value={state.padBot}
                onChange={e => updateState({ padBot: Number(e.target.value) })} />
            </Field>
            <Field label="Padding left (px)">
              <input type="number" className="input" min={0} max={300} value={state.padLeft}
                onChange={e => updateState({ padLeft: Number(e.target.value) })} />
            </Field>
            <Field label="Padding right (px)">
              <input type="number" className="input" min={0} max={300} value={state.padRight}
                onChange={e => updateState({ padRight: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <ColorPair label="Background" value={state.bg} onChange={v => updateState({ bg: v })} />
            <ColorPair label="Border top" value={state.border} onChange={v => updateState({ border: v })} />
          </div>
          <Field label="Left column width %">
            <select className="input" value={String(state.leftWidth)}
              onChange={e => updateState({ leftWidth: Number(e.target.value) })}>
              {[40, 45, 50, 55, 60].map(v => (
                <option key={v} value={String(v)}>{v} / {100 - v}</option>
              ))}
            </select>
          </Field>

          <p className="section-label">Left Column — Company Info</p>
          <RichTextField label="Eyebrow label" value={asTV(state.label, 'cfLabel')}
            defaultKey="cfLabel" onChange={v => updateState({ label: v })} />
          <RichTextField label="Company name" value={asTV(state.company, 'cfCompany')}
            defaultKey="cfCompany" onChange={v => updateState({ company: v })} />
          <RichTextField label="Address / tagline" multiline value={asTV(state.address, 'cfAddress')}
            defaultKey="cfAddress" onChange={v => updateState({ address: v })} />

          <p className="section-label">Right Column — Contact Items</p>
          {state.items.map((item, i) => (
            <ItemRow key={i} item={item}
              onRemove={() => removeItem(i)}
              onChange={p => updateItem(i, p)} />
          ))}
          <button onClick={addItem} className="btn-ghost text-xs w-full mb-4">+ Add contact item</button>
        </div>

      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>

        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">
              Copy
            </button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click ⚡ Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
