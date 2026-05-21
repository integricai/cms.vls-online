import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import PaddingControl from '../../components/PaddingControl';
import RichTextField from '../../components/RichTextField';
import type { GradientBannerContent, GradientBannerSection, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateGradientBannerHtml } from './generateHtml';

let counter = 0;

function td(value: string, key: Parameters<typeof normalize>[1]): TextData {
  return normalize(value, key);
}

function newSection(): GradientBannerSection {
  counter += 1;
  return {
    id: `gbs${counter}`,
    name: `Gradient Banner ${counter}`,
    gradientLeft: '#0d1f3c',
    gradientRight: '#1f6ab4',
    padTop: 48,
    padBot: 48,
    padLeft: 34,
    padRight: 34,
    eyebrow: td('FULL EXAM PREPARATION', 'gbEyebrow'),
    title: td('Want the complete ACCA preparation package?', 'gbTitle'),
    desc: td('Mock exams are one piece of the puzzle. Pair them with VLS expert-led video lectures, study notes, WhatsApp tutor support, and weekly live sessions — everything you need to pass first time.', 'gbDesc'),
    primaryText: td('Browse ACCA courses →', 'gbPrimary'),
    primaryUrl: '#',
    primaryBg: '#ffffff',
    secondaryText: td('Book a free consultation', 'gbSecondary'),
    secondaryUrl: '#',
    secondaryBg: '#2d659b',
    secondaryBorder: '#5f91c5',
  };
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5" />
        <input className="input" value={value} onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

function SectionList({ sections, activeId, onSelect, onCreate, onDelete }: {
  sections: GradientBannerSection[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Saved Sections</span>
        <button onClick={onCreate} className="btn-ghost px-2 py-1 text-xs">+ New</button>
      </div>
      <div className="space-y-1">
        {sections.map(section => (
          <div key={section.id} onClick={() => onSelect(section.id)}
            className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
              section.id === activeId ? 'bg-brand text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand/40'
            }`}>
            <span className="truncate font-medium">{section.name || 'Untitled'}</span>
            {sections.length > 1 && (
              <button onClick={e => { e.stopPropagation(); onDelete(section.id); }}
                className={`ml-2 shrink-0 text-xs ${section.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}>
                ×
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function BannerForm({ section, onChange }: { section: GradientBannerSection; onChange: (patch: Partial<GradientBannerSection>) => void }) {
  function asText(value: TextValue, key: Parameters<typeof normalize>[1]) {
    return normalize(value, key);
  }

  return (
    <>
      <p className="section-label mt-0">Section</p>
      <Field label="Section name" hint="CMS only">
        <input className="input" value={section.name} onChange={e => onChange({ name: e.target.value })} />
      </Field>

      <p className="section-label">Gradient</p>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Left colour" value={section.gradientLeft} onChange={gradientLeft => onChange({ gradientLeft })} />
        <ColorField label="Right colour" value={section.gradientRight} onChange={gradientRight => onChange({ gradientRight })} />
      </div>

      <p className="section-label">Spacing</p>
      <PaddingControl value={section} defaults={{ padTop: 48, padBot: 48, padLeft: 34, padRight: 34 }} onChange={onChange} />

      <p className="section-label">Content</p>
      <RichTextField label="Eyebrow" value={asText(section.eyebrow, 'gbEyebrow')} defaultKey="gbEyebrow" onChange={eyebrow => onChange({ eyebrow })} />
      <RichTextField label="Title" value={asText(section.title, 'gbTitle')} defaultKey="gbTitle" onChange={title => onChange({ title })} />
      <RichTextField label="Description" multiline value={asText(section.desc, 'gbDesc')} defaultKey="gbDesc" onChange={desc => onChange({ desc })} />

      <p className="section-label">Buttons</p>
      <RichTextField label="Primary button" value={asText(section.primaryText, 'gbPrimary')} defaultKey="gbPrimary" onChange={primaryText => onChange({ primaryText })} />
      <Field label="Primary URL">
        <input className="input" value={section.primaryUrl} onChange={e => onChange({ primaryUrl: e.target.value })} />
      </Field>
      <ColorField label="Primary background" value={section.primaryBg} onChange={primaryBg => onChange({ primaryBg })} />
      <RichTextField label="Secondary button" value={asText(section.secondaryText, 'gbSecondary')} defaultKey="gbSecondary" onChange={secondaryText => onChange({ secondaryText })} />
      <Field label="Secondary URL">
        <input className="input" value={section.secondaryUrl} onChange={e => onChange({ secondaryUrl: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Secondary background" value={section.secondaryBg} onChange={secondaryBg => onChange({ secondaryBg })} />
        <ColorField label="Secondary border" value={section.secondaryBorder} onChange={secondaryBorder => onChange({ secondaryBorder })} />
      </div>
    </>
  );
}

export default function GradientBannerSectionScreen() {
  const [sections, setSections] = useState<GradientBannerSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [html, setHtml] = useState('');
  const section = sections.find(item => item.id === activeId) || null;

  useEffect(() => {
    api.get<{ data: GradientBannerContent }>('/content/vls-gradient-banner-sections')
      .then(row => {
        const loaded = (row?.data as GradientBannerContent)?.sections || [];
        const next = loaded.length ? loaded : [newSection()];
        setSections(next);
        setActiveId(next[0]?.id || null);
      })
      .catch(() => {
        const first = newSection();
        setSections([first]);
        setActiveId(first.id);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (section) setHtml(wrapGeneratedHtml('Gradient Banner Section', generateGradientBannerHtml(section)));
  }, [section]);

  const updateSection = useCallback((patch: Partial<GradientBannerSection>) => {
    setSections(prev => prev.map(item => item.id === activeId ? { ...item, ...patch } : item));
    setSaved(false);
  }, [activeId]);

  function createSection() {
    const next = newSection();
    setSections(prev => [...prev, next]);
    setActiveId(next.id);
    setSaved(false);
  }

  function deleteSection(id: string) {
    setSections(prev => {
      const next = prev.filter(item => item.id !== id);
      if (activeId === id) setActiveId(next[0]?.id || null);
      return next;
    });
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await api.put('/content/vls-gradient-banner-sections', { sections });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[440px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Gradient Banner Section</h1>
          <p className="mt-0.5 text-xs text-slate-400">Two-column callout banner with gradient background</p>
        </div>
        <div className="flex gap-2 border-b border-slate-100 bg-white px-5 py-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => { if (section) { setHtml(wrapGeneratedHtml('Gradient Banner Section', generateGradientBannerHtml(section))); setActiveTab('preview'); } }}
            className="btn-success flex-1 justify-center">
            Generate HTML
          </button>
        </div>
        <div className="px-5 py-4">
          <SectionList sections={sections} activeId={activeId} onSelect={setActiveId} onCreate={createSection} onDelete={deleteSection} />
          {section && <BannerForm section={section} onChange={updateSection} />}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>'}
            className="h-full w-full flex-1 border-0 bg-slate-50"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(html)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">{html || '// Generate HTML first'}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
