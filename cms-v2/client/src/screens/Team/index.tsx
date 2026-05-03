import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { TeamCard, TeamFeature } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateTeamHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';

function getStr(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  return (v as any).text || '';
}

function normalizeCard(raw: any): TeamCard {
  return {
    id: raw.id || `tm-${Date.now().toString(36)}`,
    eyebrow: raw.eyebrow || 'MEET YOUR TUTOR',
    name: raw.name || '',
    designation: raw.designation || '',
    imgUrl: raw.imgUrl || '',
    features: (raw.features || []).map((f: any) => ({ value: getStr(f?.value), label: getStr(f?.label) })),
    paras: (raw.paras || []).map(getStr).filter(Boolean),
    tags: (raw.tags || []).map(getStr).filter(Boolean),
  };
}

function makeCard(): TeamCard {
  return {
    id: `tm-${Date.now().toString(36)}`,
    eyebrow: normalize('MEET YOUR TUTOR', 'teamEyebrow'),
    name: normalize('', 'teamName'),
    designation: normalize('', 'teamDesignation'),
    imgUrl: '',
    features: [],
    paras: [''],
    tags: [],
  };
}

export default function TeamScreen() {
  const [cards, setCards]         = useState<TeamCard[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');
  const [expanded, setExpanded]   = useState<Set<string>>(new Set());

  useEffect(() => {
    api.get<any>('/content/vls-team')
      .then(row => {
        const raw = row?.data as any;
        const rawCards: any[] = raw?.cards || [];
        const loaded = rawCards.map(normalizeCard);
        setCards(loaded);
        if (loaded.length > 0) setExpanded(new Set([loaded[0].id]));
      })
      .catch(e => setLoadError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, []);

  const upd = useCallback((patch: TeamCard[]) => { setCards(patch); setSaved(false); }, []);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function updateCard(i: number, patch: Partial<TeamCard>) {
    const a = [...cards]; a[i] = { ...a[i], ...patch }; upd(a);
  }

  function addCard()           { const c = makeCard(); upd([...cards, c]); setExpanded(prev => new Set([...prev, c.id])); }
  function removeCard(i: number) { upd(cards.filter((_, idx) => idx !== i)); }
  function moveCard(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= cards.length) return;
    const a = [...cards]; [a[i], a[j]] = [a[j], a[i]]; upd(a);
  }

  function addFeature(i: number) { updateCard(i, { features: [...cards[i].features, { value: '', label: '' }] }); }
  function removeFeature(i: number, fi: number) { updateCard(i, { features: cards[i].features.filter((_, idx) => idx !== fi) }); }
  function updateFeature(i: number, fi: number, patch: Partial<TeamFeature>) {
    const features = [...cards[i].features]; features[fi] = { ...features[fi], ...patch }; updateCard(i, { features });
  }

  function addPara(i: number) { updateCard(i, { paras: [...cards[i].paras, ''] }); }
  function removePara(i: number, pi: number) { updateCard(i, { paras: cards[i].paras.filter((_, idx) => idx !== pi) }); }
  function updatePara(i: number, pi: number, val: string) {
    const paras = [...cards[i].paras]; paras[pi] = val; updateCard(i, { paras });
  }

  function addTag(i: number) { updateCard(i, { tags: [...cards[i].tags, ''] }); }
  function removeTag(i: number, ti: number) { updateCard(i, { tags: cards[i].tags.filter((_, idx) => idx !== ti) }); }
  function updateTag(i: number, ti: number, val: string) {
    const tags = [...cards[i].tags]; tags[ti] = val; updateCard(i, { tags });
  }

  async function save() {
    setSaving(true);
    try {
      await api.put('/content/vls-team', { cards });
      setSaved(true);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  if (loadError) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-md text-center">
        <p className="text-sm font-semibold text-red-700 mb-1">Failed to load team data</p>
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
          <h1 className="text-base font-bold text-slate-900">Team</h1>
          <p className="text-xs text-slate-400 mt-0.5">{cards.length} team member{cards.length !== 1 ? 's' : ''}</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { setPreviewHtml(generateTeamHtml(cards)); setActiveTab('preview'); }}
            className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {cards.map((card, i) => {
            const nameText = getStr(card.name) || '(unnamed)';
            const isOpen = expanded.has(card.id);
            return (
              <div key={card.id} className="rounded border border-slate-200 bg-white">
                {/* Card header */}
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t border-b border-slate-200">
                  <button onClick={() => toggleExpand(card.id)} className="flex-1 text-left text-sm font-semibold text-slate-700 truncate">
                    {isOpen ? '▼' : '▶'} {nameText}
                  </button>
                  <button onClick={() => moveCard(i, -1)} disabled={i === 0} className="btn-ghost text-xs px-2 disabled:opacity-30">↑</button>
                  <button onClick={() => moveCard(i, 1)} disabled={i === cards.length - 1} className="btn-ghost text-xs px-2 disabled:opacity-30">↓</button>
                  <button onClick={() => removeCard(i)} className="btn-danger text-xs px-2">✕</button>
                </div>

                {isOpen && (
                  <div className="p-3 space-y-1">
                    <Field label="Photo URL">
                      {card.imgUrl.startsWith('data:') ? (
                        <div className="flex items-center gap-2">
                          <img src={card.imgUrl} alt="preview" className="h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0" />
                          <span className="text-xs text-slate-500 flex-1">Embedded base64 photo</span>
                          <button onClick={() => updateCard(i, { imgUrl: '' })} className="btn-danger text-xs px-2">Remove</button>
                        </div>
                      ) : (
                        <input className="input" value={card.imgUrl} placeholder="https://…"
                          onChange={e => updateCard(i, { imgUrl: e.target.value })} />
                      )}
                    </Field>
                    <RichTextField label="Eyebrow" value={normalize(card.eyebrow as any, 'teamEyebrow')} defaultKey="teamEyebrow"
                      onChange={v => updateCard(i, { eyebrow: v })} />
                    <RichTextField label="Name" value={normalize(card.name as any, 'teamName')} defaultKey="teamName"
                      onChange={v => updateCard(i, { name: v })} />
                    <RichTextField label="Designation / Role" value={normalize(card.designation as any, 'teamDesignation')} defaultKey="teamDesignation"
                      onChange={v => updateCard(i, { designation: v })} />

                    {/* Stat features */}
                    <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Stat Features (left panel)</p>
                    <div className="space-y-1.5 mb-1">
                      {card.features.map((feat, fi) => (
                        <div key={fi} className="flex gap-2 items-center">
                          <input className="input w-24 shrink-0 text-center font-bold" value={feat.value} placeholder="20+"
                            onChange={e => updateFeature(i, fi, { value: e.target.value })} />
                          <input className="input flex-1" value={feat.label} placeholder="Years Exp."
                            onChange={e => updateFeature(i, fi, { label: e.target.value })} />
                          <button onClick={() => removeFeature(i, fi)} className="btn-danger">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addFeature(i)} className="btn-ghost text-xs w-full">+ Add stat</button>

                    {/* Bio paragraphs */}
                    <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Bio Paragraphs</p>
                    <div className="space-y-1.5 mb-1">
                      {card.paras.map((para, pi) => (
                        <div key={pi} className="flex gap-2 items-start">
                          <textarea className="input flex-1" rows={2} value={para}
                            onChange={e => updatePara(i, pi, e.target.value)} />
                          <button onClick={() => removePara(i, pi)} className="btn-danger mt-1">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addPara(i)} className="btn-ghost text-xs w-full">+ Add paragraph</button>

                    {/* Tags */}
                    <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Tags</p>
                    <div className="flex flex-wrap gap-1.5 mb-1">
                      {card.tags.map((tag, ti) => (
                        <div key={ti} className="flex gap-1 items-center">
                          <input className="input w-32" value={tag}
                            onChange={e => updateTag(i, ti, e.target.value)} />
                          <button onClick={() => removeTag(i, ti)} className="btn-danger">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => addTag(i)} className="btn-ghost text-xs w-full">+ Add tag</button>
                  </div>
                )}
              </div>
            );
          })}

          <button onClick={addCard} className="btn-ghost text-xs w-full">+ Add team member</button>
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
              ? `<!doctype html><html><head><meta charset="utf-8"><style>body{padding:24px;background:#f8fafc;}</style></head><body>${previewHtml}</body></html>`
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
