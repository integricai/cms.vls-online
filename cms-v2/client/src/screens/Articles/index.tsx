import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import type { ArticleGroup, ArticleGroupsContent, ArticleSection } from '../../types/cms';
import { normalize } from '../../utils/text';
import { defaultArticleSection } from './defaults';
import { generateArticlesHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

type ContentResponse<T> = { key: string; data: T; updated_at: string; updated_by: number | null };

function articlesToText(group: ArticleGroup): string {
  return (group.articles || []).map(article =>
    [article.code || '', article.title || '', article.desc || '', article.url || ''].join(' | '),
  ).join('\n');
}

function parseArticles(text: string): ArticleGroup['articles'] {
  return text.split(/\n+/).map(line => {
    const parts = line.split('|').map(part => part.trim());
    return {
      code: parts[0] || '',
      title: parts[1] || '',
      desc: parts[2] || '',
      url: parts.slice(3).join('|').trim(),
    };
  }).filter(article => article.title || article.url);
}

function normalizeSection(section: Partial<ArticleSection> | undefined): ArticleSection {
  const fallback = defaultArticleSection();
  return {
    ...fallback,
    ...section,
    headingStyle: normalize(section?.headingStyle, 'articleGroupTitle'),
    bodyStyle: normalize(section?.bodyStyle, 'articleGroupBody'),
    rowTitleStyle: normalize(section?.rowTitleStyle, 'articleGroupRowTitle'),
    notice: normalize(section?.notice, 'articleGroupNotice'),
    groups: (section?.groups?.length ? section.groups : fallback.groups).map(group => ({
      title: group.title || '',
      short: group.short || group.title || '',
      color: /^#[0-9a-fA-F]{6}$/.test(group.color || '') ? group.color : '#204280',
      articles: (group.articles || []).map(article => ({
        code: article.code || '',
        title: article.title || '',
        desc: article.desc || '',
        url: article.url || '',
      })),
    })),
  };
}

export default function Articles() {
  const [sections, setSections] = useState<ArticleSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ArticleSection | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<'preview' | 'html'>('preview');
  const [html, setHtml] = useState('');

  useEffect(() => {
    api.get<ContentResponse<ArticleGroupsContent>>('/content/vls-article-groups')
      .then(row => {
        const loaded = (row.data?.sections || []).map(normalizeSection);
        setSections(loaded);
        if (loaded[0]) {
          setActiveId(loaded[0].id);
          setDraft(loaded[0]);
          setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(loaded[0])));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(partial: Partial<ArticleSection>) {
    setDraft(prev => prev ? { ...prev, ...partial } : prev);
    setSaved(false);
  }

  function selectSection(id: string) {
    const section = sections.find(item => item.id === id);
    if (!section) return;
    setActiveId(section.id);
    setDraft(section);
    setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(section)));
    setSaved(false);
  }

  function createSection() {
    const section = defaultArticleSection();
    setActiveId(section.id);
    setDraft(section);
    setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(section)));
    setSaved(false);
  }

  function duplicateSection() {
    if (!draft) return;
    const section = JSON.parse(JSON.stringify(draft)) as ArticleSection;
    section.id = `ags-${Date.now().toString(36)}`;
    section.name = `Copy of ${draft.name || 'Articles'}`;
    setActiveId(section.id);
    setDraft(section);
    setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(section)));
    setSaved(false);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const next = activeId && sections.some(section => section.id === activeId)
        ? sections.map(section => section.id === activeId ? draft : section)
        : [...sections, draft];
      await api.put('/content/vls-article-groups', { sections: next });
      setSections(next);
      setActiveId(draft.id);
      setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(draft)));
      setTab('preview');
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection() {
    if (!activeId || !window.confirm('Delete this article section?')) return;
    const next = sections.filter(section => section.id !== activeId);
    await api.put('/content/vls-article-groups', { sections: next });
    setSections(next);
    setActiveId(next[0]?.id ?? null);
    setDraft(next[0] ?? null);
    setHtml(next[0] ? wrapGeneratedHtml('Articles', generateArticlesHtml(next[0])) : '');
  }

  function updateGroup(index: number, group: ArticleGroup) {
    if (!draft) return;
    patch({ groups: draft.groups.map((item, i) => i === index ? group : item) });
  }

  function addGroup() {
    if (!draft) return;
    patch({ groups: [...draft.groups, { title: 'New group', short: 'Topic', color: '#204280', articles: [] }] });
  }

  function removeGroup(index: number) {
    if (!draft) return;
    patch({ groups: draft.groups.filter((_, i) => i !== index) });
  }

  function generate() {
    if (!draft) return;
    setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(draft)));
    setTab('preview');
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading articles...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Articles</h1>
          <p className="text-xs text-slate-400 mt-0.5">Article groups with topic filtering</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving || !draft} className="btn-primary flex-1 justify-center">{saving ? 'Saving...' : saved ? 'Saved' : 'Save'}</button>
          <button onClick={generate} disabled={!draft} className="btn-success flex-1 justify-center">Generate HTML</button>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4">
            <p className="section-label mt-0">Saved Sections</p>
            <div className="flex gap-2 mb-3">
              <select className="input flex-1" value={activeId || ''} onChange={e => selectSection(e.target.value)}>
                <option value="">- select -</option>
                {sections.map(section => <option key={section.id} value={section.id}>{section.name || section.paperCode || 'Articles'}</option>)}
              </select>
              <button className="btn-ghost text-xs px-3" onClick={createSection}>+ New</button>
              <button className="btn-ghost text-xs px-3" onClick={duplicateSection} disabled={!draft}>Duplicate</button>
            </div>
            {activeId && <button className="btn-danger text-xs" onClick={deleteSection}>Delete selected section</button>}
          </div>

          {draft ? (
            <>
              <p className="section-label">Section Setup</p>
              <Field label="Section name" hint="CMS only"><input className="input" value={draft.name} onChange={e => patch({ name: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Paper code"><input className="input" value={draft.paperCode} onChange={e => patch({ paperCode: e.target.value })} /></Field>
                <Field label="Paper title"><input className="input" value={draft.paperTitle} onChange={e => patch({ paperTitle: e.target.value })} /></Field>
              </div>
              <Field label="Hub URL"><input className="input" value={draft.hubUrl} onChange={e => patch({ hubUrl: e.target.value })} /></Field>
              <Field label="Theme colour">
                <div className="flex gap-2 items-center">
                  <input type="color" value={draft.theme} onChange={e => patch({ theme: e.target.value })} className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                  <input className="input" value={draft.theme} onChange={e => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && patch({ theme: e.target.value })} />
                </div>
              </Field>

              <p className="section-label">Text Formatting</p>
              <RichTextField label="Heading sample" value={normalize(draft.headingStyle, 'articleGroupTitle')} defaultKey="articleGroupTitle" onChange={value => patch({ headingStyle: value })} />
              <RichTextField label="Description sample" multiline value={normalize(draft.bodyStyle, 'articleGroupBody')} defaultKey="articleGroupBody" onChange={value => patch({ bodyStyle: value })} />
              <RichTextField label="Article title sample" value={normalize(draft.rowTitleStyle, 'articleGroupRowTitle')} defaultKey="articleGroupRowTitle" onChange={value => patch({ rowTitleStyle: value })} />
              <RichTextField label="Copyright notice" multiline value={normalize(draft.notice, 'articleGroupNotice')} defaultKey="articleGroupNotice" onChange={value => patch({ notice: value })} />

              <p className="section-label">Groups</p>
              <div className="space-y-3">
                {draft.groups.map((group, index) => (
                  <div key={index} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-500">{group.title || 'New group'} · {group.articles.length} articles</span>
                      <button className="btn-danger" onClick={() => removeGroup(index)}>Remove</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Group title"><input className="input" value={group.title} onChange={e => updateGroup(index, { ...group, title: e.target.value })} /></Field>
                      <Field label="Filter label"><input className="input" value={group.short} onChange={e => updateGroup(index, { ...group, short: e.target.value })} /></Field>
                    </div>
                    <Field label="Group colour">
                      <div className="flex gap-2 items-center">
                        <input type="color" value={group.color} onChange={e => updateGroup(index, { ...group, color: e.target.value })} className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
                        <input className="input" value={group.color} onChange={e => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && updateGroup(index, { ...group, color: e.target.value })} />
                      </div>
                    </Field>
                    <Field label="Articles" hint="code | title | one-line description | URL">
                      <textarea className="input font-mono text-xs" rows={8} value={articlesToText(group)} onChange={e => updateGroup(index, { ...group, articles: parseArticles(e.target.value) })} />
                    </Field>
                  </div>
                ))}
              </div>
              <button className="btn-ghost text-xs w-full mt-3" onClick={addGroup}>+ Add group</button>
            </>
          ) : (
            <div className="py-10 text-center text-sm text-slate-400">Create an Articles section to get started.</div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(item => (
            <button key={item} onClick={() => setTab(item)} className={`px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${tab === item ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {item === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {tab === 'preview' ? (
          <iframe title="articles-preview" srcDoc={`<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>'}</body></html>`} className="flex-1 w-full border-0 bg-slate-50" sandbox="allow-same-origin allow-scripts" />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(html)} className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{html || '// Generate HTML first'}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
