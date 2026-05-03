import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { AboutUsSection, AboutUsContent, AboutUsCard, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateAboutUsHtml } from './generateHtml';
import { ICON_OPTIONS } from './icons';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let counter = 0;

function td(v: string, key: Parameters<typeof normalize>[1]): TextData {
  return normalize(v, key);
}

function newSection(): AboutUsSection {
  counter++;
  return {
    id: `aus${counter}`,
    name: `About Us Section ${counter}`,
    padLeft: 24,
    padRight: 24,
    eyebrow:  td('ABOUT VERTEX LEARNING SOLUTIONS', 'aboutEyebrow'),
    title:    td('What is VLS and who is it for?', 'aboutTitle'),
    paragraphs: [
      td('Vertex Learning Solutions (VLS) is an online tutoring and coaching platform designed for working professionals, career changers, and motivated learners who want structured, expert-guided development without the constraints of a traditional classroom.', 'aboutParagraph'),
      td('Founded on the belief that great coaching changes careers, VLS brings together a vetted community of specialist tutors and coaches who deliver practical, outcome-focused learning across leadership, communication, career planning, wellbeing, and more.', 'aboutParagraph'),
    ],
    ctaText: td('Learn more about VLS →', 'aboutCta'),
    ctaUrl: '#',
    cards: [
      { icon: 'user',  title: td('Expert tutors & coaches',          'aboutCardTitle'), desc: td('Every VLS tutor is hand-picked for subject-matter expertise, real-world experience, and proven teaching ability.',      'aboutCard') },
      { icon: 'book',  title: td('Structured, outcome-led courses',  'aboutCardTitle'), desc: td('Courses are built around clear goals — not just content. Each module moves you measurably forward.',                  'aboutCard') },
      { icon: 'clock', title: td('Learn on your schedule',           'aboutCardTitle'), desc: td('On-demand video content, flexible coaching sessions, and lifetime access — study when it suits you.',                   'aboutCard') },
      { icon: 'check', title: td('Certificates & accreditation',     'aboutCardTitle'), desc: td('Complete a course and receive a recognised VLS certificate to add to your CV or LinkedIn profile.',                    'aboutCard') },
    ],
  };
}

// ── Section list ──────────────────────────────────────────────────────────────

function SectionList({ sections, activeId, onSelect, onCreate, onDelete }: {
  sections: AboutUsSection[];
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
          <div key={sec.id}
            onClick={() => onSelect(sec.id)}
            className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${
              sec.id === activeId
                ? 'bg-brand text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'
            }`}
          >
            <span className="truncate font-medium">{sec.name || 'Untitled'}</span>
            {sections.length > 1 && (
              <button onClick={e => { e.stopPropagation(); onDelete(sec.id); }}
                className={`ml-2 shrink-0 text-xs ${sec.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}>
                ✕
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AboutUs() {
  const [sections, setSections] = useState<AboutUsSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  const sec = sections.find(s => s.id === activeId) ?? null;

  useEffect(() => {
    api.get<{ data: AboutUsContent }>('/content/vls-about-us')
      .then(row => {
        const secs: AboutUsSection[] = (row?.data as AboutUsContent)?.sections ?? [];
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

  useEffect(() => {
    if (sec) setPreviewHtml(wrapGeneratedHtml('About Us', generateAboutUsHtml(sec)));
  }, [sec]);

  const updateSec = useCallback((patch: Partial<AboutUsSection>) => {
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
      await api.put('/content/vls-about-us', { sections });
      setSaved(true);
    } finally {
      setSaving(false);
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
          <h1 className="text-base font-bold text-slate-900">About Us</h1>
          <p className="text-xs text-slate-400 mt-0.5">Two-column about section with feature cards</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { if (sec) { setPreviewHtml(wrapGeneratedHtml('About Us', generateAboutUsHtml(sec))); setActiveTab('preview'); } }}
            className="btn-success flex-1 justify-center">
            ⚡ Generate HTML
          </button>
        </div>

        <div className="px-5 py-4">
          <SectionList sections={sections} activeId={activeId}
            onSelect={setActiveId} onCreate={createSection} onDelete={deleteSection} />

          {sec && <AboutUsForm section={sec} onChange={updateSec} />}
        </div>

      </div>

      {/* ── Output panel ── */}
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
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to see a preview.</p>'
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

// ── Form ──────────────────────────────────────────────────────────────────────

function AboutUsForm({ section: s, onChange }: { section: AboutUsSection; onChange: (p: Partial<AboutUsSection>) => void }) {
  function asTextData(v: TextValue, key: Parameters<typeof normalize>[1]): TextData {
    return normalize(v, key);
  }

  function patchParagraph(i: number, v: TextData) {
    const paragraphs = [...s.paragraphs as TextData[]];
    paragraphs[i] = v;
    onChange({ paragraphs });
  }

  function addParagraph() {
    onChange({ paragraphs: [...s.paragraphs as TextData[], normalize('', 'aboutParagraph')] });
  }

  function removeParagraph(i: number) {
    onChange({ paragraphs: (s.paragraphs as TextData[]).filter((_, idx) => idx !== i) });
  }

  function patchCard(i: number, patch: Partial<AboutUsCard>) {
    const cards = [...s.cards];
    cards[i] = { ...cards[i], ...patch };
    onChange({ cards });
  }

  function addCard() {
    onChange({
      cards: [...s.cards, {
        icon: 'star',
        title: normalize('', 'aboutCardTitle'),
        desc:  normalize('', 'aboutCard'),
      }],
    });
  }

  function removeCard(i: number) {
    onChange({ cards: s.cards.filter((_, idx) => idx !== i) });
  }

  return (
    <>
      <p className="section-label">Section Setup</p>
      <Field label="Section name" hint="CMS only">
        <input className="input" value={s.name} onChange={e => onChange({ name: e.target.value })} />
      </Field>

      <p className="section-label">Layout</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Padding left (px)">
          <input type="number" className="input" min={0} max={200} value={s.padLeft}
            onChange={e => onChange({ padLeft: Number(e.target.value) })} />
        </Field>
        <Field label="Padding right (px)">
          <input type="number" className="input" min={0} max={200} value={s.padRight}
            onChange={e => onChange({ padRight: Number(e.target.value) })} />
        </Field>
      </div>

      <p className="section-label">Section Header</p>
      <RichTextField label="Eyebrow text" value={asTextData(s.eyebrow, 'aboutEyebrow')}
        defaultKey="aboutEyebrow" onChange={v => onChange({ eyebrow: v })} />
      <RichTextField label="Section title" value={asTextData(s.title, 'aboutTitle')}
        defaultKey="aboutTitle" onChange={v => onChange({ title: v })} />

      <p className="section-label">Paragraphs</p>
      <div className="space-y-2 mb-2">
        {(s.paragraphs as TextData[]).map((para, i) => (
          <div key={i} className="relative rounded-lg border border-slate-100 bg-slate-50 p-3">
            <button onClick={() => removeParagraph(i)} className="btn-danger absolute right-2 top-2">✕</button>
            <RichTextField label={`Paragraph ${i + 1}`} multiline value={para}
              defaultKey="aboutParagraph" onChange={v => patchParagraph(i, v)} />
          </div>
        ))}
      </div>
      <button onClick={addParagraph} className="btn-ghost text-xs w-full mb-1">+ Add paragraph</button>

      <p className="section-label">CTA</p>
      <RichTextField label="CTA text" value={asTextData(s.ctaText, 'aboutCta')}
        defaultKey="aboutCta" onChange={v => onChange({ ctaText: v })} />
      <Field label="CTA URL">
        <input className="input" value={s.ctaUrl} placeholder="https://"
          onChange={e => onChange({ ctaUrl: e.target.value })} />
      </Field>

      <p className="section-label">Right Panel Feature Cards</p>
      <div className="space-y-3 mb-2">
        {s.cards.map((card, i) => (
          <div key={i} className="relative rounded-lg border border-slate-100 bg-slate-50 p-3">
            <button onClick={() => removeCard(i)} className="btn-danger absolute right-2 top-2">✕</button>
            <Field label="Icon">
              <select className="input" value={card.icon} onChange={e => patchCard(i, { icon: e.target.value })}>
                {ICON_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </Field>
            <RichTextField label="Title" value={asTextData(card.title, 'aboutCardTitle')}
              defaultKey="aboutCardTitle" onChange={v => patchCard(i, { title: v })} />
            <RichTextField label="Description" multiline value={asTextData(card.desc, 'aboutCard')}
              defaultKey="aboutCard" onChange={v => patchCard(i, { desc: v })} />
          </div>
        ))}
      </div>
      <button onClick={addCard} className="btn-ghost text-xs w-full mb-4">+ Add feature card</button>
    </>
  );
}
