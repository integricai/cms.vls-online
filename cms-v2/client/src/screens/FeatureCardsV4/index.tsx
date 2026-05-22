import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type { Fc4Card, Fc4Component, Fc4Content, Fc4State } from '../../types/cms';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateFeatureCardsV4Html } from './generateHtml';

function makeCard(): Fc4Card {
  return {
    badge: 'F2 · MA',
    badgeBg: '#d8efff',
    badgeTc: '#0967b1',
    title: 'Management Accounting',
    subtitle: 'Applied Knowledge',
    ctaText: 'View →',
    ctaUrl: '',
  };
}

function makeDefault(): Fc4State {
  return {
    bg: '#f3f6fc',
    padTop: 36,
    padBottom: 42,
    padLeft: 30,
    padRight: 30,
    maxWidth: 1180,
    cols: 4,
    gap: 12,
    eyebrow: 'OTHER MOCK EXAMS',
    eyebrowTc: '#8a919b',
    heading: 'Explore other ACCA mock exams',
    headingTc: '#07172d',
    cardBg: '#ffffff',
    cardBorder: '#dfe6f0',
    cardRadius: 8,
    titleTc: '#07172d',
    subtitleTc: '#7b8490',
    ctaTc: '#0967b1',
    cards: [
      makeCard(),
      { badge: 'F3 · FA', badgeBg: '#d8f6e7', badgeTc: '#08724f', title: 'Financial Accounting', subtitle: 'Applied Knowledge', ctaText: 'View →', ctaUrl: '' },
      { badge: 'F5 · PM', badgeBg: '#ebe3ff', badgeTc: '#5b36d6', title: 'Performance Management', subtitle: 'Applied Skills', ctaText: 'View →', ctaUrl: '' },
      { badge: 'F7 · FR', badgeBg: '#fff0d6', badgeTc: '#9a5a00', title: 'Financial Reporting', subtitle: 'Applied Skills', ctaText: 'View →', ctaUrl: '' },
    ],
  };
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0"
        />
        <input
          type="text"
          value={value}
          className="input"
          onChange={e => onChange(e.target.value)}
        />
      </div>
    </Field>
  );
}

function normalizeState(data?: Partial<Fc4State>): Fc4State {
  const base = makeDefault();
  return {
    ...base,
    ...data,
    cards: (data?.cards?.length ? data.cards : base.cards).map(card => ({
      ...makeCard(),
      ...card,
    })),
  };
}

export default function FeatureCardsV4Screen() {
  const [components, setComponents] = useState<Fc4Component[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [state, setState] = useState<Fc4State>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<{ data: Fc4Content }>('/content/vls-feature-cards-4')
      .then(row => {
        const comps = (row?.data?.components || []).map(c => ({ ...c, data: normalizeState(c.data) }));
        setComponents(comps);
        if (comps.length > 0) {
          setActiveId(comps[0].id);
          setName(comps[0].name);
          setState(comps[0].data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<Fc4State>) => {
    setState(prev => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  function loadComponent(id: string) {
    if (!id) {
      newComponent();
      return;
    }
    const c = components.find(item => item.id === id);
    if (!c) return;
    setActiveId(c.id);
    setName(c.name);
    setState(normalizeState(c.data));
    setSaved(false);
  }

  function newComponent() {
    setActiveId(null);
    setName('');
    setState(makeDefault());
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) {
      alert('Enter a component name first.');
      return;
    }
    setSaving(true);
    try {
      let id = activeId;
      let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) {
          id = `fc4-${Date.now().toString(36)}`;
          comps.push({ id, name, data: state });
        }
      } else {
        id = `fc4-${Date.now().toString(36)}`;
        comps.push({ id, name, data: state });
      }
      await api.put('/content/vls-feature-cards-4', { components: comps });
      setComponents(comps);
      setActiveId(id);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await api.put('/content/vls-feature-cards-4', { components: comps });
    setComponents(comps);
    newComponent();
  }

  function updateCard(index: number, patch: Partial<Fc4Card>) {
    const cards = [...state.cards];
    cards[index] = { ...cards[index], ...patch };
    upd({ cards });
  }

  function addCard() {
    upd({ cards: [...state.cards, makeCard()] });
  }

  function removeCard(index: number) {
    upd({ cards: state.cards.filter((_, i) => i !== index) });
  }

  function generate() {
    setPreviewHtml(wrapGeneratedHtml('Feature Cards V4', generateFeatureCardsV4Html(state)));
    setActiveTab('preview');
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Feature Cards v4</h1>
          <p className="text-xs text-slate-400 mt-0.5">Compact mock exam cards with badges and view links</p>
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
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} placeholder="e.g. Other Mock Exams" onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          <p className="section-label">Layout</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Background" value={state.bg} onChange={v => upd({ bg: v })} />
            <Field label="Max width (px)">
              <input type="number" className="input" min={320} max={1600} value={state.maxWidth} onChange={e => upd({ maxWidth: Number(e.target.value) })} />
            </Field>
            <Field label="Columns">
              <select className="input" value={state.cols} onChange={e => upd({ cols: Number(e.target.value) })}>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns</option>
                <option value={5}>5 columns</option>
              </select>
            </Field>
            <Field label="Gap (px)">
              <input type="number" className="input" min={0} max={60} value={state.gap} onChange={e => upd({ gap: Number(e.target.value) })} />
            </Field>
            <Field label="Pad top (px)">
              <input type="number" className="input" min={0} max={160} value={state.padTop} onChange={e => upd({ padTop: Number(e.target.value) })} />
            </Field>
            <Field label="Pad bottom (px)">
              <input type="number" className="input" min={0} max={160} value={state.padBottom} onChange={e => upd({ padBottom: Number(e.target.value) })} />
            </Field>
            <Field label="Pad left (px)">
              <input type="number" className="input" min={0} max={160} value={state.padLeft} onChange={e => upd({ padLeft: Number(e.target.value) })} />
            </Field>
            <Field label="Pad right (px)">
              <input type="number" className="input" min={0} max={160} value={state.padRight} onChange={e => upd({ padRight: Number(e.target.value) })} />
            </Field>
          </div>

          <p className="section-label">Header</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Eyebrow">
              <input className="input" value={state.eyebrow} onChange={e => upd({ eyebrow: e.target.value })} />
            </Field>
            <ColorRow label="Eyebrow colour" value={state.eyebrowTc} onChange={v => upd({ eyebrowTc: v })} />
            <Field label="Heading" className="col-span-2">
              <input className="input" value={state.heading} onChange={e => upd({ heading: e.target.value })} />
            </Field>
            <ColorRow label="Heading colour" value={state.headingTc} onChange={v => upd({ headingTc: v })} />
          </div>

          <p className="section-label">Cards Style</p>
          <div className="grid grid-cols-2 gap-2">
            <ColorRow label="Card background" value={state.cardBg} onChange={v => upd({ cardBg: v })} />
            <ColorRow label="Card border" value={state.cardBorder} onChange={v => upd({ cardBorder: v })} />
            <Field label="Radius (px)">
              <input type="number" className="input" min={0} max={30} value={state.cardRadius} onChange={e => upd({ cardRadius: Number(e.target.value) })} />
            </Field>
            <ColorRow label="Title colour" value={state.titleTc} onChange={v => upd({ titleTc: v })} />
            <ColorRow label="Subtitle colour" value={state.subtitleTc} onChange={v => upd({ subtitleTc: v })} />
            <ColorRow label="CTA colour" value={state.ctaTc} onChange={v => upd({ ctaTc: v })} />
          </div>

          <p className="section-label">Cards</p>
          <div className="space-y-3 mb-2">
            {state.cards.map((card, index) => (
              <div key={index} className="relative rounded border border-slate-200 bg-slate-50 p-3">
                <button onClick={() => removeCard(index)} className="btn-danger absolute right-2 top-2">✕</button>
                <div className="grid grid-cols-2 gap-2 pr-9">
                  <Field label="Badge">
                    <input className="input" value={card.badge} onChange={e => updateCard(index, { badge: e.target.value })} />
                  </Field>
                  <Field label="Title">
                    <input className="input" value={card.title} onChange={e => updateCard(index, { title: e.target.value })} />
                  </Field>
                  <ColorRow label="Badge bg" value={card.badgeBg} onChange={v => updateCard(index, { badgeBg: v })} />
                  <ColorRow label="Badge text" value={card.badgeTc} onChange={v => updateCard(index, { badgeTc: v })} />
                  <Field label="Subtitle">
                    <input className="input" value={card.subtitle} onChange={e => updateCard(index, { subtitle: e.target.value })} />
                  </Field>
                  <Field label="CTA text">
                    <input className="input" value={card.ctaText} onChange={e => updateCard(index, { ctaText: e.target.value })} />
                  </Field>
                  <Field label="CTA URL" className="col-span-2">
                    <input className="input" value={card.ctaUrl} placeholder="/mock-exams/acca-ma" onChange={e => updateCard(index, { ctaUrl: e.target.value })} />
                  </Field>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addCard} className="btn-ghost text-xs w-full mb-4">+ Add card</button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}
            >
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'}
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click ⚡ Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
