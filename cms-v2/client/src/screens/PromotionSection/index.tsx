import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { PromoSection, PromoContent, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generatePromoSectionHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let counter = 0;

function nd(v: string, key: Parameters<typeof normalize>[1]): TextData {
  return normalize(v, key);
}

function newSection(): PromoSection {
  counter++;
  return {
    id: `prs${counter}`,
    name: `Promotion Section ${counter}`,
    bg: '#deebf7',
    btnBg: '#152b57',
    padLeft: 24,
    padRight: 24,
    title:    nd('Ready to take the next step?', 'promoTitle'),
    subtitle: nd('Join 2,400+ learners already transforming their careers with Vertex Learning Solutions.', 'promoSubtitle'),
    ctaText:  nd('Start for free', 'promoCta'),
    ctaUrl: '#',
  };
}

function SectionList({ sections, activeId, onSelect, onCreate, onDelete }: {
  sections: PromoSection[];
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
          <div key={sec.id} onClick={() => onSelect(sec.id)}
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

export default function PromotionSection() {
  const [sections, setSections] = useState<PromoSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  const sec = sections.find(s => s.id === activeId) ?? null;

  useEffect(() => {
    api.get<{ data: PromoContent }>('/content/vls-promotion-sections')
      .then(row => {
        const secs: PromoSection[] = (row?.data as PromoContent)?.sections ?? [];
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
    if (sec) setPreviewHtml(wrapGeneratedHtml('Promotion Section', generatePromoSectionHtml(sec)));
  }, [sec]);

  const updateSec = useCallback((patch: Partial<PromoSection>) => {
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
      await api.put('/content/vls-promotion-sections', { sections });
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
      <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Promotion Section</h1>
          <p className="text-xs text-slate-400 mt-0.5">Full-width promotional banner with CTA button</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={() => { if (sec) { setPreviewHtml(wrapGeneratedHtml('Promotion Section', generatePromoSectionHtml(sec))); setActiveTab('preview'); } }}
            className="btn-success flex-1 justify-center">
            ⚡ Generate HTML
          </button>
        </div>

        <div className="px-5 py-4">
          <SectionList sections={sections} activeId={activeId}
            onSelect={setActiveId} onCreate={createSection} onDelete={deleteSection} />
          {sec && <PromoForm section={sec} onChange={updateSec} />}
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

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={value}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
        <input type="text" value={value} className="input"
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

function PromoForm({ section: s, onChange }: { section: PromoSection; onChange: (p: Partial<PromoSection>) => void }) {
  function asTextData(v: TextValue, key: Parameters<typeof normalize>[1]) { return normalize(v, key); }

  return (
    <>
      <p className="section-label">Section Setup</p>
      <Field label="Section name" hint="CMS only">
        <input className="input" value={s.name} onChange={e => onChange({ name: e.target.value })} />
      </Field>

      <p className="section-label">Layout</p>
      <ColorField label="Background colour" value={s.bg || '#deebf7'} onChange={v => onChange({ bg: v })} />
      <ColorField label="CTA button background" value={s.btnBg || '#152b57'} onChange={v => onChange({ btnBg: v })} />
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

      <p className="section-label">Content</p>
      <RichTextField label="Title" value={asTextData(s.title, 'promoTitle')}
        defaultKey="promoTitle" onChange={v => onChange({ title: v })} />
      <RichTextField label="Subtitle" multiline value={asTextData(s.subtitle, 'promoSubtitle')}
        defaultKey="promoSubtitle" onChange={v => onChange({ subtitle: v })} />

      <p className="section-label">CTA</p>
      <RichTextField label="Button text" value={asTextData(s.ctaText, 'promoCta')}
        defaultKey="promoCta" onChange={v => onChange({ ctaText: v })} />
      <Field label="Button URL">
        <input className="input" value={s.ctaUrl} placeholder="https://"
          onChange={e => onChange({ ctaUrl: e.target.value })} />
      </Field>
    </>
  );
}
