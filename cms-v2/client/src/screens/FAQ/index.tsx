import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import type { FaqAnswerType, FaqItem, FaqSection, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateFaqHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import type { Course } from '../../../../shared/types';

type Tab = 'preview' | 'html';

function id(prefix: string) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

function makeFaq(): FaqItem {
  return {
    id: id('fq'),
    type: 'paragraph',
    question: normalize('', 'faqQuestion'),
    heading: normalize('', 'faqHeading'),
    para: normalize('', 'faq'),
    items: [],
  };
}

function makeSection(): FaqSection {
  return {
    id: id('fqs'),
    name: 'FAQ Section',
    courseId: null,
    icon: '❔',
    title: normalize('Frequently Asked Questions', 'faqTitle'),
    titleGap: 8,
    schemaId: '',
    items: [],
  };
}

function textOf(value: TextValue | undefined) {
  if (!value) return '';
  return typeof value === 'string' ? value : value.text || '';
}

function normalizeFaq(item: any): FaqItem {
  const type = ['paragraph', 'heading-para', 'bullets', 'heading-bullets'].includes(item?.type) ? item.type : 'paragraph';
  return {
    id: item?.id || id('fq'),
    type,
    question: normalize(item?.question, 'faqQuestion'),
    heading: normalize(item?.heading, 'faqHeading'),
    para: normalize(item?.para, 'faq'),
    items: (item?.items || []).map((entry: TextValue) => normalize(entry, 'faqBullet')),
  };
}

function normalizeSection(section: any): FaqSection {
  return {
    id: section?.id || id('fqs'),
    name: section?.name || '',
    courseId: Number.isInteger(Number(section?.courseId)) ? Number(section.courseId) : null,
    icon: section?.icon ?? '❔',
    title: normalize(section?.title || 'Frequently Asked Questions', 'faqTitle'),
    titleGap: Number.isFinite(Number(section?.titleGap)) ? Number(section.titleGap) : 8,
    schemaId: section?.schemaId || '',
    items: (section?.items || []).map(normalizeFaq),
  };
}

function OutputPane({ html, tab, setTab }: { html: string; tab: Tab; setTab: (tab: Tab) => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex border-b border-slate-200 bg-white px-4">
        {(['preview', 'html'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
            {t === 'html' ? 'HTML' : 'Preview'}
          </button>
        ))}
      </div>
      {tab === 'preview' ? (
        <iframe
          title="FAQ preview"
          srcDoc={html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a section and generate HTML to preview it.</p>'}
          className="h-full w-full flex-1 border-0 bg-white"
          sandbox="allow-scripts"
        />
      ) : (
        <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
          <button onClick={() => navigator.clipboard.writeText(html)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">{html || '// Generate HTML first'}</pre>
        </div>
      )}
    </div>
  );
}

function FaqEditor({
  item,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  item: FaqItem;
  index: number;
  total: number;
  onChange: (item: FaqItem) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  function patch(partial: Partial<FaqItem>) {
    onChange({ ...item, ...partial });
  }

  function updateBullet(i: number, value: TextData) {
    const next = [...item.items];
    next[i] = value;
    patch({ items: next });
  }

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">{index + 1}</span>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">{textOf(item.question) || 'Untitled question'}</div>
        <button className="btn-ghost px-2 py-1 text-xs" disabled={index === 0} onClick={() => onMove(-1)}>Up</button>
        <button className="btn-ghost px-2 py-1 text-xs" disabled={index === total - 1} onClick={() => onMove(1)}>Down</button>
        <button className="btn-danger" onClick={onRemove}>Remove</button>
      </div>
      <RichTextField label="Question" value={normalize(item.question, 'faqQuestion')} defaultKey="faqQuestion" onChange={question => patch({ question })} />
      <Field label="Answer type">
        <select className="input" value={item.type} onChange={e => patch({ type: e.target.value as FaqAnswerType })}>
          <option value="paragraph">Paragraph</option>
          <option value="heading-para">Heading + Paragraph</option>
          <option value="bullets">Bullet list</option>
          <option value="heading-bullets">Heading + Bullet list</option>
        </select>
      </Field>
      {(item.type === 'heading-para' || item.type === 'heading-bullets') && (
        <RichTextField label="Heading" value={normalize(item.heading, 'faqHeading')} defaultKey="faqHeading" onChange={heading => patch({ heading })} />
      )}
      {(item.type === 'paragraph' || item.type === 'heading-para') && (
        <RichTextField label="Paragraph" hint="HTML allowed" multiline value={normalize(item.para, 'faq')} defaultKey="faq" onChange={para => patch({ para })} />
      )}
      {(item.type === 'bullets' || item.type === 'heading-bullets') && (
        <>
          <p className="section-label">Bullet Items</p>
          {(item.items || []).map((entry, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_auto] gap-2">
              <RichTextField label={`Bullet ${i + 1}`} value={normalize(entry, 'faqBullet')} defaultKey="faqBullet" onChange={bullet => updateBullet(i, bullet)} />
              <button className="btn-danger mt-6 h-9" onClick={() => patch({ items: item.items.filter((_, idx) => idx !== i) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost w-full justify-center" onClick={() => patch({ items: [...(item.items || []), normalize('', 'faqBullet')] })}>+ Add bullet</button>
        </>
      )}
    </div>
  );
}

export default function FAQ() {
  const [sections, setSections] = useState<FaqSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [html, setHtml] = useState('');
  const [tab, setTab] = useState<Tab>('preview');
  const [courses, setCourses] = useState<Course[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<any>('/content/vls-faq'),
      api.get<Course[]>('/courses/active').catch(() => []),
    ])
      .then(([row, courseRows]) => {
        const next = ((row?.data?.sections || []) as any[]).map(normalizeSection);
        setSections(next);
        if (next[0]) setActiveId(next[0].id);
        setCourses(courseRows || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const active = useMemo(() => sections.find(section => section.id === activeId) || null, [sections, activeId]);
  const totalFaqs = sections.reduce((count, section) => count + section.items.length, 0);

  function updateSection(section: FaqSection) {
    setSections(prev => prev.map(item => item.id === section.id ? section : item));
    setSaved(false);
  }

  function addSection() {
    const section = makeSection();
    setSections(prev => [...prev, section]);
    setActiveId(section.id);
    setSaved(false);
  }

  function duplicateSection() {
    if (!active) return;
    const copy: FaqSection = {
      id: id('fqs'),
      name: `NEW_${active.name || 'FAQ Section'}`,
      courseId: active.courseId,
      icon: active.icon,
      title: structuredClone(normalize(active.title, 'faqTitle')),
      titleGap: active.titleGap,
      schemaId: active.schemaId,
      items: active.items.map(item => ({ ...structuredClone(item), id: id('fq') })),
    };
    const index = sections.findIndex(section => section.id === active.id);
    const next = [...sections];
    next.splice(index + 1, 0, copy);
    setSections(next);
    setActiveId(copy.id);
    setSaved(false);
  }

  async function deleteSection() {
    if (!active || !confirm(`Delete "${active.name || 'this FAQ section'}"?`)) return;
    const next = sections.filter(section => section.id !== active.id);
    await api.put('/content/vls-faq', { sections: next });
    setSections(next);
    setActiveId(next[0]?.id || null);
    setSaved(true);
  }

  async function save() {
    setSaving(true);
    await api.put('/content/vls-faq', { sections });
    setSaving(false);
    setSaved(true);
  }

  function addFaq() {
    if (!active) return;
    updateSection({ ...active, items: [...active.items, makeFaq()] });
  }

  function updateFaq(index: number, item: FaqItem) {
    if (!active) return;
    const next = [...active.items];
    next[index] = item;
    updateSection({ ...active, items: next });
  }

  function moveFaq(index: number, dir: -1 | 1) {
    if (!active) return;
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= active.items.length) return;
    const next = [...active.items];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    updateSection({ ...active, items: next });
  }

  if (loading) return <div className="p-5 text-sm text-slate-400">Loading FAQ...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[560px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-bold text-slate-900">FAQ</h1>
              <p className="mt-0.5 text-xs text-slate-400">Site wide Sections / {sections.length} sections / {totalFaqs} FAQs</p>
            </div>
            <button onClick={addSection} className="btn-ghost text-xs">+ New Section</button>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="section-label mt-0">FAQ Sections</p>
            <div className="mb-2 flex gap-2">
              <select className="input flex-1" value={activeId || ''} onChange={e => setActiveId(e.target.value)}>
                <option value="">- select -</option>
                {sections.map(section => <option key={section.id} value={section.id}>{section.name || 'Untitled section'} ({section.items.length})</option>)}
              </select>
              {active && <button onClick={duplicateSection} className="btn-ghost text-xs">Duplicate</button>}
              {active && <button onClick={deleteSection} className="btn-danger text-xs">Delete</button>}
            </div>
            {active && (
              <Field label="Course" hint="Links this FAQ section to a course for the combined Course Hero schema.">
                <select
                  className="input"
                  value={active.courseId ?? ''}
                  onChange={e => updateSection({ ...active, courseId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">No course selected</option>
                  {courses.map(course => (
                    <option key={course.id} value={course.id}>{course.name}</option>
                  ))}
                </select>
              </Field>
            )}
            <div className="flex gap-2">
              <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : saved ? 'Saved' : 'Save All'}</button>
              <button onClick={() => { setHtml(wrapGeneratedHtml('FAQ', generateFaqHtml(active || []))); setTab('preview'); }} disabled={!active} className="btn-success flex-1 justify-center">Generate HTML</button>
            </div>
          </div>
        </div>

        {!active ? (
          <div className="p-5 text-sm text-slate-400">Create or select a FAQ section.</div>
        ) : (
          <div className="px-5 py-4">
            <Field label="Section name">
              <input className="input" value={active.name} onChange={e => updateSection({ ...active, name: e.target.value })} />
            </Field>
            <p className="section-label">Section Title</p>
            <div className="grid grid-cols-[88px_1fr] gap-3">
              <Field label="Icon">
                <input className="input" value={active.icon} placeholder="Leave blank for no icon" onChange={e => updateSection({ ...active, icon: e.target.value })} />
              </Field>
              <RichTextField
                label="Title"
                value={normalize(active.title, 'faqTitle')}
                defaultKey="faqTitle"
                onChange={title => updateSection({ ...active, title })}
              />
            </div>
            <Field label="Gap below title (px)">
              <input
                type="number"
                min={0}
                max={80}
                className="input"
                value={active.titleGap}
                onChange={e => updateSection({ ...active, titleGap: Number(e.target.value) })}
              />
            </Field>
            <Field label="Schema @id URL" hint="Optional. Example: https://vls-online.com/courses/fma#faq">
              <input
                className="input"
                value={active.schemaId}
                placeholder="https://vls-online.com/courses/fma#faq"
                onChange={e => updateSection({ ...active, schemaId: e.target.value })}
              />
            </Field>
            <p className="section-label">Questions</p>
            {active.items.map((item, index) => (
              <FaqEditor
                key={item.id}
                item={item}
                index={index}
                total={active.items.length}
                onChange={next => updateFaq(index, next)}
                onRemove={() => updateSection({ ...active, items: active.items.filter((_, i) => i !== index) })}
                onMove={dir => moveFaq(index, dir)}
              />
            ))}
            <button onClick={addFaq} className="btn-ghost mb-6 w-full justify-center">+ Add FAQ</button>
          </div>
        )}
      </div>
      <OutputPane html={html} tab={tab} setTab={setTab} />
    </div>
  );
}
