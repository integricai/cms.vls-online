import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { ProgramsState, ProgramsComponent, ProgramsContent, ProgramTopic, ProgramCard, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateProgramCardsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';

let _cardCounter = 0;
function makeCard(): ProgramCard {
  return { id: `pc-${Date.now().toString(36)}-${++_cardCounter}`, title: normalize('', 'programCardTitle'), desc: normalize('', 'programDesc'), url: '#', cta: normalize('View Course →', 'programCta'), cardBg: '#204280', badge: '', rating: '', hours: '' };
}
function makeTopic(): ProgramTopic {
  return { id: `pt-${Date.now().toString(36)}`, title: normalize('New Topic', 'programCardTitle'), topicColor: '#204280', badgeBg: '#ffffff', badgeOpacity: 0.22, cards: [] };
}
function cloneTopic(topic: ProgramTopic): ProgramTopic {
  return {
    ...topic,
    id: `pt-${Date.now().toString(36)}-copy`,
    cards: topic.cards.map(c => ({ ...c, id: `pc-${Date.now().toString(36)}-${++_cardCounter}` })),
  };
}
function makeDefault(): ProgramsState { return { topics: [] }; }
function asTV(v: TextValue | undefined, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

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

export default function ProgramCardsScreen() {
  const [components, setComponents] = useState<ProgramsComponent[]>([]);
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [name, setName]             = useState('');
  const [state, setState]           = useState<ProgramsState>(makeDefault());
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [activeTab, setActiveTab]   = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [copyStatus, setCopyStatus]   = useState<string>('');
  const [copyingTopicId, setCopyingTopicId] = useState<string | null>(null);

  useEffect(() => {
    api.get<{ data: ProgramsContent & { sections?: any[] } }>('/content/vls-programs')
      .then(row => {
        const raw = row?.data as any;
        let comps: ProgramsComponent[] = [];
        if (raw?.components) {
          comps = raw.components;
        } else if (raw?.sections) {
          comps = (raw.sections as any[]).map((s: any, i: number) => ({
            id: s.id || `prog-${i}`,
            name: s.name || `Section ${i + 1}`,
            data: { topics: s.topics || [] },
          }));
        }
        setComponents(comps);
        if (comps.length > 0) { setActiveId(comps[0].id); setName(comps[0].name); setState(comps[0].data || makeDefault()); }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: Partial<ProgramsState>) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);

  function loadComponent(id: string) {
    if (!id) { newComponent(); return; }
    const c = components.find(c => c.id === id);
    if (!c) return;
    setActiveId(c.id); setName(c.name); setState(c.data || makeDefault()); setSaved(false);
  }
  function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }

  async function saveComps(comps: ProgramsComponent[]) {
    await api.put('/content/vls-programs', { components: comps });
    setComponents(comps);
  }

  async function save() {
    if (!name.trim()) { alert('Enter a component name first.'); return; }
    setSaving(true);
    try {
      let id = activeId; let comps = [...components];
      if (id) {
        comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
        if (!comps.find(c => c.id === id)) { id = `prog-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      } else { id = `prog-${Date.now().toString(36)}`; comps.push({ id, name, data: state }); }
      await saveComps(comps);
      setActiveId(id!); setSaved(true);
    } finally { setSaving(false); }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const comps = components.filter(c => c.id !== activeId);
    await saveComps(comps);
    newComponent();
  }

  function updateTopic(ti: number, patch: Partial<ProgramTopic>) { const a = [...state.topics]; a[ti] = { ...a[ti], ...patch }; upd({ topics: a }); }
  function addTopic()              { const t = makeTopic(); upd({ topics: [...state.topics, t] }); setExpandedTopics(prev => new Set([...prev, t.id])); }
  function removeTopic(ti: number) { upd({ topics: state.topics.filter((_, idx) => idx !== ti) }); }
  function toggleTopic(id: string) { setExpandedTopics(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
  function moveTopic(ti: number, dir: -1 | 1) {
    const nextIndex = ti + dir;
    if (nextIndex < 0 || nextIndex >= state.topics.length) return;
    const topics = [...state.topics];
    [topics[ti], topics[nextIndex]] = [topics[nextIndex], topics[ti]];
    upd({ topics });
  }

  function updateCard(ti: number, ci: number, patch: Partial<ProgramCard>) { const topics = [...state.topics]; const cards = [...topics[ti].cards]; cards[ci] = { ...cards[ci], ...patch }; topics[ti] = { ...topics[ti], cards }; upd({ topics }); }
  function addCard(ti: number) { const topics = [...state.topics]; topics[ti] = { ...topics[ti], cards: [...topics[ti].cards, makeCard()] }; upd({ topics }); }
  function removeCard(ti: number, ci: number) { const topics = [...state.topics]; topics[ti] = { ...topics[ti], cards: topics[ti].cards.filter((_, idx) => idx !== ci) }; upd({ topics }); }
  function moveCard(ti: number, ci: number, dir: -1 | 1) {
    const topic = state.topics[ti];
    const nextIndex = ci + dir;
    if (!topic || nextIndex < 0 || nextIndex >= topic.cards.length) return;
    const topics = [...state.topics];
    const cards = [...topic.cards];
    [cards[ci], cards[nextIndex]] = [cards[nextIndex], cards[ci]];
    topics[ti] = { ...topic, cards };
    upd({ topics });
  }

  async function copyTopicToComponent(ti: number, targetCompId: string) {
    const targetComp = components.find(c => c.id === targetCompId);
    if (!targetComp) return;
    setCopyingTopicId(state.topics[ti].id);
    try {
      const cloned = cloneTopic(state.topics[ti]);
      const updatedComps = components.map(c => {
        if (c.id !== targetCompId) return c;
        return { ...c, data: { topics: [...(c.data?.topics || []), cloned] } };
      });
      await saveComps(updatedComps);
      const topicLabel = normalize(state.topics[ti].title, 'programCardTitle').text || 'Topic';
      setCopyStatus(`"${topicLabel}" copied to "${targetComp.name}"`);
      setTimeout(() => setCopyStatus(''), 3000);
    } finally {
      setCopyingTopicId(null);
    }
  }

  function generate() {
    if (!activeId && !name) { alert('Save the component first.'); return; }
    const id = activeId || 'preview';
    const html = generateProgramCardsHtml(id, name || 'Preview', state);
    setPreviewHtml(html); setActiveTab('preview');
  }

  const otherComponents = components.filter(c => c.id !== activeId);

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;

  return (
    <div className="flex h-full">
      {/* ── Left panel ── */}
      <div className="w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Program Cards</h1>
          <p className="text-xs text-slate-400 mt-0.5">Filterable grid with sidebar topics, search &amp; pagination</p>
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
            <Field label="Section name (shown in filter pills)">
              <input className="input" value={name} placeholder="e.g. ACCA Courses"
                onChange={e => setName(e.target.value)} />
            </Field>
          </div>

          {copyStatus && (
            <div className="mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700">
              ✓ {copyStatus}
            </div>
          )}

          {/* Topics */}
          <p className="section-label">Topics</p>
          <div className="space-y-2 mb-2">
            {state.topics.map((topic, ti) => {
              const isOpen = expandedTopics.has(topic.id);
              const topicLabel = normalize(topic.title, 'programCardTitle').text || `Topic ${ti + 1}`;
              const isCopying = copyingTopicId === topic.id;
              return (
                <div key={topic.id} className="rounded border border-slate-200 bg-slate-50">
                  {/* Topic header row */}
                  <div className="flex items-center gap-1.5 px-3 py-2">
                    <span className="flex-1 text-sm font-medium text-slate-700 cursor-pointer truncate"
                      onClick={() => toggleTopic(topic.id)}>{topicLabel}</span>
                    <span className="text-xs text-slate-400 shrink-0">{topic.cards.length}c</span>

                    {/* Copy to another component */}
                    {otherComponents.length > 0 && (
                      <div className="relative shrink-0">
                        <select
                          className="text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white text-indigo-700 cursor-pointer"
                          value=""
                          disabled={isCopying}
                          onChange={e => { if (e.target.value) copyTopicToComponent(ti, e.target.value); }}
                          title="Copy topic to another component"
                        >
                          <option value="">{isCopying ? 'Copying…' : '⧉ Copy to…'}</option>
                          {otherComponents.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <button
                      onClick={e => { e.stopPropagation(); moveTopic(ti, -1); }}
                      disabled={ti === 0}
                      title="Move topic up"
                      className="btn-ghost text-xs px-2 py-1 shrink-0"
                    >
                      ▲
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); moveTopic(ti, 1); }}
                      disabled={ti === state.topics.length - 1}
                      title="Move topic down"
                      className="btn-ghost text-xs px-2 py-1 shrink-0"
                    >
                      ▼
                    </button>
                    <button onClick={e => { e.stopPropagation(); removeTopic(ti); }} className="btn-danger text-xs px-2 shrink-0">✕</button>
                    <span className="text-slate-400 text-xs cursor-pointer shrink-0" onClick={() => toggleTopic(topic.id)}>{isOpen ? '▲' : '▼'}</span>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-200 p-3 space-y-2">
                      <RichTextField label="Topic title" value={asTV(topic.title, 'programCardTitle')} defaultKey="programCardTitle"
                        onChange={v => updateTopic(ti, { title: v })} />
                      <div className="grid grid-cols-2 gap-2">
                        <ColorRow label="Topic colour" value={topic.topicColor} onChange={v => updateTopic(ti, { topicColor: v })} />
                        <ColorRow label="Badge background" value={topic.badgeBg} onChange={v => updateTopic(ti, { badgeBg: v })} />
                        <Field label="Badge opacity (0–1)">
                          <input type="number" className="input" min={0} max={1} step={0.05} value={topic.badgeOpacity}
                            onChange={e => updateTopic(ti, { badgeOpacity: parseFloat(e.target.value) })} />
                        </Field>
                      </div>

                      <p className="text-xs font-semibold text-slate-500 mt-2">Cards</p>
                      <div className="space-y-2">
                        {topic.cards.map((card, ci) => (
                          <div key={card.id || ci} className="relative rounded border border-slate-100 bg-white p-3">
                            <div className="absolute right-2 top-2 flex gap-1">
                              <button
                                onClick={() => moveCard(ti, ci, -1)}
                                disabled={ci === 0}
                                title="Move card up"
                                className="btn-ghost text-xs px-2 py-1"
                              >
                                ▲
                              </button>
                              <button
                                onClick={() => moveCard(ti, ci, 1)}
                                disabled={ci === topic.cards.length - 1}
                                title="Move card down"
                                className="btn-ghost text-xs px-2 py-1"
                              >
                                ▼
                              </button>
                              <button onClick={() => removeCard(ti, ci)} className="btn-danger text-xs px-2">✕</button>
                            </div>
                            <RichTextField label="Card title" value={asTV(card.title, 'programCardTitle')} defaultKey="programCardTitle"
                              onChange={v => updateCard(ti, ci, { title: v })} />
                            <RichTextField label="Description" value={asTV(card.desc, 'programDesc')} defaultKey="programDesc"
                              onChange={v => updateCard(ti, ci, { desc: v })} multiline />
                            <div className="grid grid-cols-2 gap-2">
                              <Field label="Card URL">
                                <input className="input" value={card.url} placeholder="https://…"
                                  onChange={e => updateCard(ti, ci, { url: e.target.value })} />
                              </Field>
                              <Field label="Badge text">
                                <input className="input" value={card.badge} placeholder="NEW"
                                  onChange={e => updateCard(ti, ci, { badge: e.target.value })} />
                              </Field>
                              <Field label="Video hours">
                                <input className="input" value={card.hours} placeholder="12h"
                                  onChange={e => updateCard(ti, ci, { hours: e.target.value })} />
                              </Field>
                              <Field label="Rating">
                                <input className="input" value={card.rating} placeholder="4.8"
                                  onChange={e => updateCard(ti, ci, { rating: e.target.value })} />
                              </Field>
                              <ColorRow label="Card background" value={card.cardBg} onChange={v => updateCard(ti, ci, { cardBg: v })} />
                            </div>
                            <RichTextField label="CTA text" value={asTV(card.cta, 'programCta')} defaultKey="programCta"
                              onChange={v => updateCard(ti, ci, { cta: v })} />
                          </div>
                        ))}
                      </div>
                      <button onClick={() => addCard(ti)} className="btn-ghost text-xs w-full mt-1">+ Add card</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button onClick={addTopic} className="btn-ghost text-xs w-full mb-4">+ Add topic</button>
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px">${previewHtml}</body></html>`
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
