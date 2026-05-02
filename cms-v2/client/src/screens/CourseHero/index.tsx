import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { CourseHeroState, CourseHeroComponent, CourseHeroContent, CourseHeroPill, CourseHeroLearnItem, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateCourseHeroHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';

function makeDefault(): CourseHeroState {
  return {
    bg: '#0d1f3c',
    padTop: 48, padBot: 56, padLeft: 60, padRight: 60,
    breadcrumb: '',
    eyebrowTc: '#4a90d9', eyebrowDot: '#4a90d9',
    heading: normalize('', 'chHeading'),
    desc:    normalize('', 'chDesc'),
    tags: [],
    pillBg: '#0f2744', pillBorder: '#1e3a5f', pillVc: '#ffffff', pillLc: '#94a3b8',
    pills: [],
    learnLabel: "WHAT YOU'LL LEARN",
    learnLabelTc: '#4a90d9', learnBg: '#132343', learnBorder: '#1e3a5f',
    learnCc: '#4a90d9', learnTitleTc: '#ffffff', learnSubTc: '#f97316',
    learnItems: [],
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

export default function CourseHeroScreen() {
  const [components, setComponents] = useState<CourseHeroComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<CourseHeroState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: CourseHeroContent }>('/content/vls-course-hero-components')
      .then(row => {
        const comps = (row?.data as CourseHeroContent)?.components ?? [];
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<CourseHeroState>) => {
    setState(prev => ({ ...prev, ...patch }));
    setSaved(false);
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
      let id = activeId;
      let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `ch-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else {
        id = `ch-${Date.now().toString(36)}`; comps.push({ id, name, data: state });
      }
      await api.put('/content/vls-course-hero-components', { components: comps });
      setComponents(comps); setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-course-hero-components', { components: comps });
    setComponents(comps); newComponent();
  }

  function generate() { setPreviewHtml(generateCourseHeroHtml(state)); setActiveTab('preview'); }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  function updateTag(i: number, val: string) {
    const tags = [...state.tags]; tags[i] = val; upd({ tags });
  }
  function addTag() { upd({ tags: [...state.tags, ''] }); }
  function removeTag(i: number) { upd({ tags: state.tags.filter((_, idx) => idx !== i) }); }

  function updatePill(i: number, patch: Partial<CourseHeroPill>) {
    const pills = [...state.pills]; pills[i] = { ...pills[i], ...patch }; upd({ pills });
  }
  function addPill() { upd({ pills: [...state.pills, { icon: '', value: '', label: '' }] }); }
  function removePill(i: number) { upd({ pills: state.pills.filter((_, idx) => idx !== i) }); }

  function updateLearn(i: number, patch: Partial<CourseHeroLearnItem>) {
    const items = [...state.learnItems]; items[i] = { ...items[i], ...patch }; upd({ learnItems: items });
  }
  function addLearn() { upd({ learnItems: [...state.learnItems, { title: '', subtitle: '', fullWidth: false }] }); }
  function removeLearn(i: number) { upd({ learnItems: state.learnItems.filter((_, idx) => idx !== i) }); }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Left Hero Section</h1>
          <p className="text-xs text-slate-400 mt-0.5">Course page hero — left column content</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
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
              <input className="input" value={name} placeholder="e.g. FA1 Course Hero"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          <p className="section-label">Background & Layout</p>
          <ColorRow label="Background colour" value={state.bg} onChange={v => upd({ bg: v })} />
          <div className="grid grid-cols-2 gap-2">
            {(['padTop','padBot','padLeft','padRight'] as const).map(k => (
              <Field key={k} label={k.replace('pad','Pad ').replace('Top','top').replace('Bot','bottom').replace('Left','left').replace('Right','right') + ' (px)'}>
                <input type="number" className="input" min={0} max={300} value={state[k]}
                  onChange={e => upd({ [k]: Number(e.target.value) })} />
              </Field>
            ))}
          </div>

          <p className="section-label">Breadcrumb</p>
          <Field label="Breadcrumb trail" hint="optional">
            <input className="input" value={state.breadcrumb} placeholder="Home › ACCA Courses › FA1"
              onChange={e => upd({ breadcrumb: e.target.value })} />
          </Field>

          <p className="section-label">Eyebrow Tags</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Tag colour" value={state.eyebrowTc} onChange={v => upd({ eyebrowTc: v })} />
            <ColorRow label="Dot colour" value={state.eyebrowDot} onChange={v => upd({ eyebrowDot: v })} />
          </div>
          <div className="space-y-1.5 mb-2">
            {state.tags.map((tag, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input className="input flex-1" value={tag} placeholder="e.g. ACCA"
                  onChange={e => updateTag(i, e.target.value)} />
                <button onClick={() => removeTag(i)} className="btn-danger">✕</button>
              </div>
            ))}
          </div>
          <button onClick={addTag} className="btn-ghost text-xs w-full mb-1">+ Add tag</button>

          <p className="section-label">Heading & Description</p>
          <RichTextField label="Heading" value={asTV(state.heading, 'chHeading')}
            defaultKey="chHeading" onChange={v => upd({ heading: v })} />
          <RichTextField label="Description" multiline value={asTV(state.desc, 'chDesc')}
            defaultKey="chDesc" onChange={v => upd({ desc: v })} />

          <p className="section-label">Feature Pills</p>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <ColorRow label="Pill background" value={state.pillBg} onChange={v => upd({ pillBg: v })} />
            <ColorRow label="Pill border" value={state.pillBorder} onChange={v => upd({ pillBorder: v })} />
            <ColorRow label="Value colour" value={state.pillVc} onChange={v => upd({ pillVc: v })} />
            <ColorRow label="Label colour" value={state.pillLc} onChange={v => upd({ pillLc: v })} />
          </div>
          <div className="space-y-2 mb-2">
            {state.pills.map((pill, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-2">
                <button onClick={() => removePill(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <div className="grid grid-cols-3 gap-1.5">
                  <Field label="Icon (emoji)">
                    <input className="input" value={pill.icon} placeholder="📅" onChange={e => updatePill(i, { icon: e.target.value })} />
                  </Field>
                  <Field label="Value (bold)">
                    <input className="input" value={pill.value} placeholder="12 weeks" onChange={e => updatePill(i, { value: e.target.value })} />
                  </Field>
                  <Field label="Label">
                    <input className="input" value={pill.label} placeholder="Duration" onChange={e => updatePill(i, { label: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addPill} className="btn-ghost text-xs w-full mb-1">+ Add pill</button>

          <p className="section-label">What You'll Learn</p>
          <Field label="Section label">
            <input className="input" value={state.learnLabel} onChange={e => upd({ learnLabel: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <ColorRow label="Label colour" value={state.learnLabelTc} onChange={v => upd({ learnLabelTc: v })} />
            <ColorRow label="Card background" value={state.learnBg} onChange={v => upd({ learnBg: v })} />
            <ColorRow label="Card border" value={state.learnBorder} onChange={v => upd({ learnBorder: v })} />
            <ColorRow label="Check mark colour" value={state.learnCc} onChange={v => upd({ learnCc: v })} />
            <ColorRow label="Title colour" value={state.learnTitleTc} onChange={v => upd({ learnTitleTc: v })} />
            <ColorRow label="Subtitle colour" value={state.learnSubTc} onChange={v => upd({ learnSubTc: v })} />
          </div>
          <div className="space-y-2 mb-2">
            {state.learnItems.map((item, i) => (
              <div key={i} className="relative rounded border border-slate-200 bg-slate-50 p-2">
                <button onClick={() => removeLearn(i)} className="btn-danger absolute right-2 top-2">✕</button>
                <Field label="Title">
                  <input className="input" value={item.title} placeholder="Learn item title"
                    onChange={e => updateLearn(i, { title: e.target.value })} />
                </Field>
                <Field label="Subtitle (optional)">
                  <input className="input" value={item.subtitle} placeholder="Additional detail"
                    onChange={e => updateLearn(i, { subtitle: e.target.value })} />
                </Field>
                <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                  <input type="checkbox" checked={item.fullWidth} onChange={e => updateLearn(i, { fullWidth: e.target.checked })} />
                  Full width (spans both columns)
                </label>
              </div>
            ))}
          </div>
          <button onClick={addLearn} className="btn-ghost text-xs w-full mb-4">+ Add learn item</button>
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
