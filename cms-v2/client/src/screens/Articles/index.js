import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { defaultArticleSection } from './defaults';
import { generateArticlesHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function articlesToText(group) {
    return (group.articles || []).map(article => [article.code || '', article.title || '', article.desc || '', article.url || ''].join(' | ')).join('\n');
}
function parseArticles(text) {
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
function normalizeSection(section) {
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
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [tab, setTab] = useState('preview');
    const [html, setHtml] = useState('');
    useEffect(() => {
        api.get('/content/vls-article-groups')
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
    function patch(partial) {
        setDraft(prev => prev ? { ...prev, ...partial } : prev);
        setSaved(false);
    }
    function selectSection(id) {
        const section = sections.find(item => item.id === id);
        if (!section)
            return;
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
        if (!draft)
            return;
        const section = JSON.parse(JSON.stringify(draft));
        section.id = `ags-${Date.now().toString(36)}`;
        section.name = `Copy of ${draft.name || 'Articles'}`;
        setActiveId(section.id);
        setDraft(section);
        setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(section)));
        setSaved(false);
    }
    async function save() {
        if (!draft)
            return;
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
        }
        finally {
            setSaving(false);
        }
    }
    async function deleteSection() {
        if (!activeId || !window.confirm('Delete this article section?'))
            return;
        const next = sections.filter(section => section.id !== activeId);
        await api.put('/content/vls-article-groups', { sections: next });
        setSections(next);
        setActiveId(next[0]?.id ?? null);
        setDraft(next[0] ?? null);
        setHtml(next[0] ? wrapGeneratedHtml('Articles', generateArticlesHtml(next[0])) : '');
    }
    function updateGroup(index, group) {
        if (!draft)
            return;
        patch({ groups: draft.groups.map((item, i) => i === index ? group : item) });
    }
    function addGroup() {
        if (!draft)
            return;
        patch({ groups: [...draft.groups, { title: 'New group', short: 'Topic', color: '#204280', articles: [] }] });
    }
    function removeGroup(index) {
        if (!draft)
            return;
        patch({ groups: draft.groups.filter((_, i) => i !== index) });
    }
    function generate() {
        if (!draft)
            return;
        setHtml(wrapGeneratedHtml('Articles', generateArticlesHtml(draft)));
        setTab('preview');
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading articles..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Articles" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Article groups with topic filtering" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving || !draft, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving...' : saved ? 'Saved' : 'Save' }), _jsx("button", { onClick: generate, disabled: !draft, className: "btn-success flex-1 justify-center", children: "Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Sections" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => selectSection(e.target.value), children: [_jsx("option", { value: "", children: "- select -" }), sections.map(section => _jsx("option", { value: section.id, children: section.name || section.paperCode || 'Articles' }, section.id))] }), _jsx("button", { className: "btn-ghost text-xs px-3", onClick: createSection, children: "+ New" }), _jsx("button", { className: "btn-ghost text-xs px-3", onClick: duplicateSection, disabled: !draft, children: "Duplicate" })] }), activeId && _jsx("button", { className: "btn-danger text-xs", onClick: deleteSection, children: "Delete selected section" })] }), draft ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Section Setup" }), _jsx(Field, { label: "Section name", hint: "CMS only", children: _jsx("input", { className: "input", value: draft.name, onChange: e => patch({ name: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Paper code", children: _jsx("input", { className: "input", value: draft.paperCode, onChange: e => patch({ paperCode: e.target.value }) }) }), _jsx(Field, { label: "Paper title", children: _jsx("input", { className: "input", value: draft.paperTitle, onChange: e => patch({ paperTitle: e.target.value }) }) })] }), _jsx(Field, { label: "Hub URL", children: _jsx("input", { className: "input", value: draft.hubUrl, onChange: e => patch({ hubUrl: e.target.value }) }) }), _jsx(Field, { label: "Theme colour", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: draft.theme, onChange: e => patch({ theme: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { className: "input", value: draft.theme, onChange: e => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && patch({ theme: e.target.value }) })] }) }), _jsx("p", { className: "section-label", children: "Text Formatting" }), _jsx(RichTextField, { label: "Heading sample", value: normalize(draft.headingStyle, 'articleGroupTitle'), defaultKey: "articleGroupTitle", onChange: value => patch({ headingStyle: value }) }), _jsx(RichTextField, { label: "Description sample", multiline: true, value: normalize(draft.bodyStyle, 'articleGroupBody'), defaultKey: "articleGroupBody", onChange: value => patch({ bodyStyle: value }) }), _jsx(RichTextField, { label: "Article title sample", value: normalize(draft.rowTitleStyle, 'articleGroupRowTitle'), defaultKey: "articleGroupRowTitle", onChange: value => patch({ rowTitleStyle: value }) }), _jsx(RichTextField, { label: "Copyright notice", multiline: true, value: normalize(draft.notice, 'articleGroupNotice'), defaultKey: "articleGroupNotice", onChange: value => patch({ notice: value }) }), _jsx("p", { className: "section-label", children: "Groups" }), _jsx("div", { className: "space-y-3", children: draft.groups.map((group, index) => (_jsxs("div", { className: "rounded-lg border border-slate-100 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-500", children: [group.title || 'New group', " \u00B7 ", group.articles.length, " articles"] }), _jsx("button", { className: "btn-danger", onClick: () => removeGroup(index), children: "Remove" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Group title", children: _jsx("input", { className: "input", value: group.title, onChange: e => updateGroup(index, { ...group, title: e.target.value }) }) }), _jsx(Field, { label: "Filter label", children: _jsx("input", { className: "input", value: group.short, onChange: e => updateGroup(index, { ...group, short: e.target.value }) }) })] }), _jsx(Field, { label: "Group colour", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: group.color, onChange: e => updateGroup(index, { ...group, color: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { className: "input", value: group.color, onChange: e => /^#[0-9a-fA-F]{6}$/.test(e.target.value) && updateGroup(index, { ...group, color: e.target.value }) })] }) }), _jsx(Field, { label: "Articles", hint: "code | title | one-line description | URL", children: _jsx("textarea", { className: "input font-mono text-xs", rows: 8, value: articlesToText(group), onChange: e => updateGroup(index, { ...group, articles: parseArticles(e.target.value) }) }) })] }, index))) }), _jsx("button", { className: "btn-ghost text-xs w-full mt-3", onClick: addGroup, children: "+ Add group" })] })) : (_jsx("div", { className: "py-10 text-center text-sm text-slate-400", children: "Create an Articles section to get started." }))] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(item => (_jsx("button", { onClick: () => setTab(item), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${tab === item ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: item === 'html' ? 'HTML' : 'Preview' }, item))) }), tab === 'preview' ? (_jsx("iframe", { title: "articles-preview", srcDoc: `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html || '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>'}</body></html>`, className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(html), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: html || '// Generate HTML first' })] }))] })] }));
}
