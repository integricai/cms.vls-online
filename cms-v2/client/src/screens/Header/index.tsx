import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { HeaderConfig, HeaderCta, HeaderMenuItem, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateHeaderHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let ctaCounter = 0;
let menuCounter = 0;

function makeDefault(): HeaderConfig {
  return {
    logoUrl: '', logoAlt: 'VLS Online', logoLink: '/', logoHeight: 56,
    siteTitle: normalize('Vertex Language Solutions', 'headerSiteTitle'),
    subTitle:  normalize('', 'headerSubTitle'),
    topbarBg:  '#ffffff', topbarText: '#262a32',
    brandBg:   '#ffffff', menuBg:    '#ffffff',
    menuText:  '#204280', menuHover: '#f0f4ff',
    dropBg:    '#ffffff', dropText:  '#262a32',
    containerWidth: 1280,
    padLeft: 24, padRight: 24, padTop: 8, padBottom: 8, dropSpacing: 10,
    ctas: [], menuItems: [], useZenMenu: false,
  };
}

function newCta(): HeaderCta {
  return { id: `hc${++ctaCounter}`, label: normalize('', 'headerCta'), url: '', bgColor: '#204280', textColor: '#ffffff', newTab: false };
}

function newMenuItem(): HeaderMenuItem {
  return { id: `hm${++menuCounter}`, label: normalize('', 'headerMenu'), url: '#', newTab: false, children: [] };
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        className="w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" />
    </div>
  );
}

function Accordion({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-lg border border-slate-200 mb-2 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left">
        <span className="text-sm font-semibold text-slate-700">{title}</span>
        <svg viewBox="0 0 20 20" fill="currentColor" className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

function MenuItemRow({ item, depth, onUpdate, onDelete, onAddChild }: {
  item: HeaderMenuItem;
  depth: number;
  onUpdate: (patch: Partial<HeaderMenuItem>) => void;
  onDelete: () => void;
  onAddChild: () => void;
}) {
  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }
  return (
    <div className={`rounded border border-slate-200 bg-white p-2 mb-1.5 ${depth > 0 ? 'ml-6 border-l-2 border-l-brand/30' : ''}`}>
      <div className="flex gap-2 items-end mb-1">
        <div className="flex-1">
          <RichTextField label="Label" value={asTV(item.label, 'headerMenu')}
            defaultKey="headerMenu" onChange={v => onUpdate({ label: v })} />
        </div>
        <div className="flex-1">
          <Field label="URL">
            <input className="input" value={item.url} onChange={e => onUpdate({ url: e.target.value })} />
          </Field>
        </div>
        <div className="flex gap-1">
          {depth === 0 && (
            <button onClick={onAddChild} title="Add child item"
              className="px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600 border border-slate-200">
              + Child
            </button>
          )}
          <button onClick={onDelete} className="btn-danger">✕</button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
        <input type="checkbox" checked={item.newTab}
          onChange={e => onUpdate({ newTab: e.target.checked })} />
        Open in new tab
      </label>
    </div>
  );
}

interface HeaderEditorProps {
  title?: string;
  subtitle?: string;
  contentKey?: string;
  generateHtml?: (cfg: HeaderConfig) => string;
  commentName?: string;
  publicPublishPath?: string | null;
}

export function HeaderEditor({
  title = 'Header',
  subtitle = 'Site header with logo, navigation and CTAs',
  contentKey = 'vls-header-config',
  generateHtml = generateHeaderHtml,
  commentName = 'Header',
  publicPublishPath = '/publish-header',
}: HeaderEditorProps) {
  const [cfg, setCfg]         = useState<HeaderConfig>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: { config: HeaderConfig } }>(`/content/${contentKey}`)
      .then(row => {
        const c = (row?.data as { config?: HeaderConfig })?.config;
        if (c) setCfg(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contentKey]);

  const update = useCallback((patch: Partial<HeaderConfig>) => {
    setCfg(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  function addCta() {
    if (cfg.ctas.length >= 2) return;
    update({ ctas: [...cfg.ctas, newCta()] });
  }

  function updateCta(id: string, patch: Partial<HeaderCta>) {
    update({ ctas: cfg.ctas.map(c => c.id === id ? { ...c, ...patch } : c) });
  }

  function deleteCta(id: string) {
    update({ ctas: cfg.ctas.filter(c => c.id !== id) });
  }

  function addMenuItem() {
    update({ menuItems: [...cfg.menuItems, newMenuItem()] });
  }

  function updateMenuItem(id: string, patch: Partial<HeaderMenuItem>) {
    function doUpdate(items: HeaderMenuItem[]): HeaderMenuItem[] {
      return items.map(it => it.id === id
        ? { ...it, ...patch }
        : { ...it, children: doUpdate(it.children) }
      );
    }
    update({ menuItems: doUpdate(cfg.menuItems) });
  }

  function addChildMenuItem(parentId: string) {
    const child = newMenuItem();
    function doAdd(items: HeaderMenuItem[]): HeaderMenuItem[] {
      return items.map(it => it.id === parentId
        ? { ...it, children: [...it.children, child] }
        : { ...it, children: doAdd(it.children) }
      );
    }
    update({ menuItems: doAdd(cfg.menuItems) });
  }

  function deleteMenuItem(id: string) {
    function doDel(items: HeaderMenuItem[]): HeaderMenuItem[] {
      return items.filter(it => it.id !== id).map(it => ({ ...it, children: doDel(it.children) }));
    }
    update({ menuItems: doDel(cfg.menuItems) });
  }

  async function save() {
    setSaving(true);
    try {
      await api.put(`/content/${contentKey}`, { config: cfg });
      if (publicPublishPath) {
        await api.post(publicPublishPath, { config: cfg });
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function generate() {
    setPreviewHtml(wrapGeneratedHtml(commentName, generateHtml(cfg)));
    setActiveTab('preview');
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  function renderMenuItems(items: HeaderMenuItem[], depth: number): React.ReactNode {
    return items.map(item => (
      <div key={item.id}>
        <MenuItemRow item={item} depth={depth}
          onUpdate={p => updateMenuItem(item.id, p)}
          onDelete={() => deleteMenuItem(item.id)}
          onAddChild={() => addChildMenuItem(item.id)}
        />
        {item.children.length > 0 && (
          <div>{renderMenuItems(item.children, depth + 1)}</div>
        )}
      </div>
    ));
  }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">{title}</h1>
          <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4">
          <Accordion title="Logo" defaultOpen>
            <Field label="Logo image URL">
              <input className="input" value={cfg.logoUrl} placeholder="https://..."
                onChange={e => update({ logoUrl: e.target.value })} />
            </Field>
            <Field label="Alt text">
              <input className="input" value={cfg.logoAlt} onChange={e => update({ logoAlt: e.target.value })} />
            </Field>
            <Field label="Logo link URL">
              <input className="input" value={cfg.logoLink} onChange={e => update({ logoLink: e.target.value })} />
            </Field>
            <Field label="Logo height (px)">
              <input type="number" className="input" min={20} max={120} value={cfg.logoHeight}
                onChange={e => update({ logoHeight: Number(e.target.value) })} />
            </Field>
          </Accordion>

          <Accordion title="Site Title" defaultOpen>
            <RichTextField label="Site title text" value={asTV(cfg.siteTitle, 'headerSiteTitle')}
              defaultKey="headerSiteTitle" onChange={v => update({ siteTitle: v })} />
            <RichTextField label="Sub-title / strapline" value={asTV(cfg.subTitle, 'headerSubTitle')}
              defaultKey="headerSubTitle" onChange={v => update({ subTitle: v })} />
          </Accordion>

          <Accordion title="Colours">
            <div className="grid grid-cols-2 gap-3">
              <ColorInput label="Brand bar BG" value={cfg.brandBg} onChange={v => update({ brandBg: v })} />
              <ColorInput label="Menu bar BG" value={cfg.menuBg} onChange={v => update({ menuBg: v })} />
              <ColorInput label="Menu text" value={cfg.menuText} onChange={v => update({ menuText: v })} />
              <ColorInput label="Menu hover BG" value={cfg.menuHover} onChange={v => update({ menuHover: v })} />
              <ColorInput label="Dropdown BG" value={cfg.dropBg} onChange={v => update({ dropBg: v })} />
              <ColorInput label="Dropdown text" value={cfg.dropText} onChange={v => update({ dropText: v })} />
            </div>
          </Accordion>

          <Accordion title="Layout & Spacing">
            <Field label="Container width (px)" hint="must match your page container">
              <input type="number" className="input" min={600} max={2400} value={cfg.containerWidth}
                onChange={e => update({ containerWidth: Number(e.target.value) })} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Padding left (px)">
                <input type="number" className="input" min={0} max={300} value={cfg.padLeft}
                  onChange={e => update({ padLeft: Number(e.target.value) })} />
              </Field>
              <Field label="Padding right (px)">
                <input type="number" className="input" min={0} max={300} value={cfg.padRight}
                  onChange={e => update({ padRight: Number(e.target.value) })} />
              </Field>
              <Field label="Padding top (px)">
                <input type="number" className="input" min={0} max={80} value={cfg.padTop}
                  onChange={e => update({ padTop: Number(e.target.value) })} />
              </Field>
              <Field label="Padding bottom (px)">
                <input type="number" className="input" min={0} max={80} value={cfg.padBottom}
                  onChange={e => update({ padBottom: Number(e.target.value) })} />
              </Field>
            </div>
            <Field label="Submenu item spacing (px)">
              <input type="number" className="input" min={2} max={24} value={cfg.dropSpacing}
                onChange={e => update({ dropSpacing: Number(e.target.value) })} />
            </Field>
          </Accordion>

          <Accordion title="Call to Actions (max 2)">
            <div className="space-y-3">
              {cfg.ctas.map(cta => (
                <div key={cta.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="flex justify-between mb-2">
                    <span className="text-xs font-semibold text-slate-500">CTA {cfg.ctas.indexOf(cta) + 1}</span>
                    <button onClick={() => deleteCta(cta.id)} className="btn-danger text-xs">Remove</button>
                  </div>
                  <RichTextField label="Button text" value={asTV(cta.label, 'headerCta')}
                    defaultKey="headerCta" onChange={v => updateCta(cta.id, { label: v })} />
                  <Field label="URL">
                    <input className="input" value={cta.url} placeholder="https://..."
                      onChange={e => updateCta(cta.id, { url: e.target.value })} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Button BG</label>
                      <input type="color" value={cta.bgColor} onChange={e => updateCta(cta.id, { bgColor: e.target.value })}
                        className="w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Text colour</label>
                      <input type="color" value={cta.textColor} onChange={e => updateCta(cta.id, { textColor: e.target.value })}
                        className="w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer mt-1">
                    <input type="checkbox" checked={cta.newTab} onChange={e => updateCta(cta.id, { newTab: e.target.checked })} />
                    Open in new tab
                  </label>
                </div>
              ))}
            </div>
            {cfg.ctas.length < 2 && (
              <button onClick={addCta} className="btn-ghost text-xs w-full mt-2">+ Add CTA</button>
            )}
          </Accordion>

          <Accordion title="Navigation Menu">
            <div className="mb-3 rounded bg-blue-50 border border-blue-200 p-3">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-800">
                <input type="checkbox" checked={cfg.useZenMenu}
                  onChange={e => update({ useZenMenu: e.target.checked })} />
                Use Zenler's live navigation (auto-sync)
              </label>
              <p className="text-xs text-slate-500 mt-1 ml-5 leading-relaxed">
                When enabled, the snippet reads the navigation directly from Zenler's DOM. Menu items below are saved as fallback.
              </p>
            </div>
            <div className={cfg.useZenMenu ? 'opacity-50 pointer-events-none' : ''}>
              {renderMenuItems(cfg.menuItems, 0)}
              <button onClick={addMenuItem} className="btn-ghost text-xs w-full mt-1">+ Add menu item</button>
            </div>
          </Accordion>
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
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

export default function HeaderScreen() {
  return <HeaderEditor />;
}
