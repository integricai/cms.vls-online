import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { HeroSection, HeroContent, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateHeroHtml } from './generateHtml';
import Field from '../../components/Field';
import ColorPicker from '../../components/ColorPicker';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

const MAX_W_OPTIONS = ['480px', '560px', '640px', '720px', '100%'];

let counter = 0;

function newSection(): HeroSection {
  counter++;
  return {
    id: `hs${counter}`,
    name: `Hero Section ${counter}`,
    bg: '#ffffff',
    maxW: '560px',
    padTop: 48, padBot: 48, padLeft: 0, padRight: 0,
    h1Size: 44,
    eyebrow: normalize('VERTEX LEARNING SOLUTIONS', 'heroEyebrow'),
    h1:     normalize('Expert-led tutoring & coaching', 'heroH1'),
    h1hl:   normalize('— built for results.', 'heroH1Highlight'),
    h2:     normalize('', 'heroH2'),
    desc:   normalize('Vertex Learning Solutions (VLS) connects ambitious learners with expert tutors across ACCA, CIMA, and CMA.', 'hero'),
    b1t:    normalize('Browse courses', 'heroButton'),
    b1u: '', b1s: '',
    b2t:    normalize('Enquire now ↓', 'heroButtonAlt'),
    b2u: '', b2s: '',
    tags: (['ACCA tuition', 'CIMA coaching', 'Online tutoring', '1-to-1 coaching'] as string[])
      .map(t => normalize(t, 'heroTag')),
    stats: [
      { v: normalize('2,400+', 'heroStatValue'), l: normalize('Students enrolled', 'heroStatLabel') },
      { v: normalize('98%',    'heroStatValue'), l: normalize('Satisfaction rate',  'heroStatLabel') },
      { v: normalize('35+',    'heroStatValue'), l: normalize('Courses available',  'heroStatLabel') },
    ],
  };
}

function asTextData(v: TextValue, key: Parameters<typeof normalize>[1]): TextData {
  return normalize(v, key);
}

// ── Section list sidebar ──────────────────────────────────────────────────────

function SectionList({
  sections, activeId, onSelect, onCreate, onDelete,
}: {
  sections: HeroSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Sections</span>
        <button onClick={onCreate} className="btn-ghost text-xs py-1 px-2">+ New</button>
      </div>
      <div className="space-y-1">
        {sections.map(sec => (
          <div
            key={sec.id}
            className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${
              sec.id === activeId
                ? 'bg-brand text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'
            }`}
            onClick={() => onSelect(sec.id)}
          >
            <span className="truncate font-medium">{sec.name || 'Untitled'}</span>
            {sections.length > 1 && (
              <button
                onClick={e => { e.stopPropagation(); onDelete(sec.id); }}
                className={`ml-2 shrink-0 text-xs ${sec.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        {sections.length === 0 && (
          <p className="text-xs text-slate-400 italic px-1">No sections yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeHero() {
  const [sections, setSections] = useState<HeroSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  const sec = sections.find(s => s.id === activeId) ?? null;

  // Load from API
  useEffect(() => {
    api.get<{ data: HeroContent }>('/content/vls-home-hero')
      .then(row => {
        const secs: HeroSection[] = (row?.data as HeroContent)?.sections ?? [];
        if (secs.length === 0) {
          const first = newSection();
          setSections([first]);
          setActiveId(first.id);
        } else {
          setSections(secs);
          setActiveId(secs[0].id);
        }
      })
      .catch(() => {
        const first = newSection();
        setSections([first]);
        setActiveId(first.id);
      })
      .finally(() => setLoading(false));
  }, []);

  // Regenerate preview when active section changes
  useEffect(() => {
    if (sec) setPreviewHtml(wrapGeneratedHtml('Home Hero', generateHeroHtml(sec)));
  }, [sec]);

  const updateSec = useCallback((patch: Partial<HeroSection>) => {
    setSections(prev => prev.map(s => s.id === activeId ? { ...s, ...patch } : s));
    setSaved(false);
  }, [activeId]);

  function createSection() {
    const s = newSection();
    setSections(prev => [...prev, s]);
    setActiveId(s.id);
    setSaved(false);
  }

  function deleteSection(id: string) {
    setSections(prev => {
      const next = prev.filter(s => s.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put('/content/vls-home-hero', { sections });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function generateAndPreview() {
    if (sec) {
      setPreviewHtml(wrapGeneratedHtml('Home Hero', generateHeroHtml(sec)));
      setActiveTab('preview');
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex h-full">
      {/* ── Form panel ── */}
      <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Home Hero</h1>
          <p className="text-xs text-slate-400 mt-0.5">Hero banner for the homepage</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generateAndPreview} className="btn-success flex-1 justify-center">
            ⚡ Generate HTML
          </button>
        </div>

        <div className="px-5 py-4">
          <SectionList
            sections={sections}
            activeId={activeId}
            onSelect={setActiveId}
            onCreate={createSection}
            onDelete={deleteSection}
          />

          {sec && (
            <HeroForm section={sec} onChange={updateSec} />
          )}
        </div>

      </div>

      {/* ── Output panel ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>

        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to see a preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button
              onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600"
            >
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

// ── Form fields ───────────────────────────────────────────────────────────────

function HeroForm({ section: s, onChange }: { section: HeroSection; onChange: (p: Partial<HeroSection>) => void }) {
  function patchTag(i: number, v: TextData) {
    const tags = [...(s.tags as TextData[])];
    tags[i] = v;
    onChange({ tags });
  }

  function addTag() {
    onChange({ tags: [...(s.tags as TextData[]), normalize('', 'heroTag')] });
  }

  function removeTag(i: number) {
    onChange({ tags: (s.tags as TextData[]).filter((_, idx) => idx !== i) });
  }

  function patchStat(i: number, field: 'v' | 'l', v: TextData) {
    const stats = [...s.stats] as Array<{ v: TextData; l: TextData }>;
    stats[i] = { ...stats[i], [field]: v };
    onChange({ stats });
  }

  function addStat() {
    onChange({
      stats: [...s.stats, {
        v: normalize('', 'heroStatValue'),
        l: normalize('', 'heroStatLabel'),
      }],
    });
  }

  function removeStat(i: number) {
    onChange({ stats: s.stats.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <p className="section-label">Section Setup</p>
      <Field label="Section name" hint="CMS only">
        <input className="input" value={s.name} onChange={e => onChange({ name: e.target.value })} />
      </Field>

      <p className="section-label">Layout</p>
      <Field label="Background colour">
        <ColorPicker value={s.bg} onChange={bg => onChange({ bg })} />
      </Field>
      <Field label="Max width">
        <select className="input" value={s.maxW} onChange={e => onChange({ maxW: e.target.value })}>
          {MAX_W_OPTIONS.map(w => <option key={w} value={w}>{w}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {(['padTop','padBot','padLeft','padRight'] as const).map(k => (
          <Field key={k} label={k.replace('pad', 'Pad ').replace('Top','top').replace('Bot','bottom').replace('Left','left').replace('Right','right') + ' (px)'}>
            <input type="number" className="input" min={0} max={200} value={s[k]}
              onChange={e => onChange({ [k]: Number(e.target.value) })} />
          </Field>
        ))}
      </div>
      <Field label="H1 font size (px)">
        <input type="number" className="input" min={24} max={80} value={s.h1Size}
          onChange={e => onChange({ h1Size: Number(e.target.value) })} />
      </Field>

      <p className="section-label">Eyebrow</p>
      <RichTextField label="Eyebrow text" value={asTextData(s.eyebrow, 'heroEyebrow')}
        defaultKey="heroEyebrow" onChange={v => onChange({ eyebrow: v })} />

      <p className="section-label">Heading</p>
      <RichTextField label="H1 — Main line" value={asTextData(s.h1, 'heroH1')}
        defaultKey="heroH1" onChange={v => onChange({ h1: v })} />
      <RichTextField label="H1 — Highlighted line" hint="displays in VLS blue"
        value={asTextData(s.h1hl, 'heroH1Highlight')} defaultKey="heroH1Highlight"
        onChange={v => onChange({ h1hl: v })} />
      <RichTextField label="H2 — Sub-heading" hint="optional"
        value={asTextData(s.h2, 'heroH2')} defaultKey="heroH2"
        onChange={v => onChange({ h2: v })} />

      <p className="section-label">Description</p>
      <RichTextField label="Body text" multiline value={asTextData(s.desc, 'hero')}
        defaultKey="hero" onChange={v => onChange({ desc: v })} />

      <p className="section-label">Tag Pills</p>
      <div className="space-y-1.5 mb-2">
        {(s.tags as TextData[]).map((tag, i) => (
          <div key={i} className="flex gap-2 items-start">
            <div className="flex-1">
              <RichTextField label={`Tag ${i + 1}`} value={tag}
                defaultKey="heroTag" onChange={v => patchTag(i, v)} />
            </div>
            <button onClick={() => removeTag(i)} className="btn-danger mt-5">✕</button>
          </div>
        ))}
      </div>
      <button onClick={addTag} className="btn-ghost text-xs w-full">+ Add tag</button>

      <p className="section-label">Call to Action Buttons</p>
      <RichTextField label="Primary button text" value={asTextData(s.b1t, 'heroButton')}
        defaultKey="heroButton" onChange={v => onChange({ b1t: v })} />
      <Field label="Primary button URL">
        <input className="input" value={s.b1u} placeholder="https://"
          onChange={e => onChange({ b1u: e.target.value })} />
      </Field>
      <Field label="Primary — scroll to" hint="overrides URL, e.g. .section-faq">
        <input className="input" value={s.b1s} placeholder=".my-section or #my-section"
          onChange={e => onChange({ b1s: e.target.value })} />
      </Field>
      <RichTextField label="Secondary button text" value={asTextData(s.b2t, 'heroButtonAlt')}
        defaultKey="heroButtonAlt" onChange={v => onChange({ b2t: v })} />
      <Field label="Secondary button URL">
        <input className="input" value={s.b2u} placeholder="https://"
          onChange={e => onChange({ b2u: e.target.value })} />
      </Field>
      <Field label="Secondary — scroll to" hint="overrides URL">
        <input className="input" value={s.b2s} placeholder=".my-section or #my-section"
          onChange={e => onChange({ b2s: e.target.value })} />
      </Field>

      <p className="section-label">Stats</p>
      <div className="space-y-3 mb-2">
        {(s.stats as Array<{ v: TextData; l: TextData }>).map((stat, i) => (
          <div key={i} className="rounded-lg border border-slate-100 bg-slate-50 p-3 relative">
            <button onClick={() => removeStat(i)} className="btn-danger absolute right-2 top-2">✕</button>
            <RichTextField label="Value" value={stat.v} defaultKey="heroStatValue"
              onChange={v => patchStat(i, 'v', v)} />
            <RichTextField label="Label" value={stat.l} defaultKey="heroStatLabel"
              onChange={v => patchStat(i, 'l', v)} />
          </div>
        ))}
      </div>
      <button onClick={addStat} className="btn-ghost text-xs w-full mb-4">+ Add stat</button>
    </>
  );
}
