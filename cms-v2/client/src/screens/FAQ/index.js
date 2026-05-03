import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { generateFaqHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function id(prefix) {
    return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
function makeFaq() {
    return {
        id: id('fq'),
        type: 'paragraph',
        question: normalize('', 'faqQuestion'),
        heading: normalize('', 'faqHeading'),
        para: normalize('', 'faq'),
        items: [],
    };
}
function makeSection() {
    return { id: id('fqs'), name: 'FAQ Section', items: [] };
}
function textOf(value) {
    if (!value)
        return '';
    return typeof value === 'string' ? value : value.text || '';
}
function normalizeFaq(item) {
    const type = ['paragraph', 'heading-para', 'bullets', 'heading-bullets'].includes(item?.type) ? item.type : 'paragraph';
    return {
        id: item?.id || id('fq'),
        type,
        question: normalize(item?.question, 'faqQuestion'),
        heading: normalize(item?.heading, 'faqHeading'),
        para: normalize(item?.para, 'faq'),
        items: (item?.items || []).map((entry) => normalize(entry, 'faqBullet')),
    };
}
function normalizeSection(section) {
    return {
        id: section?.id || id('fqs'),
        name: section?.name || '',
        items: (section?.items || []).map(normalizeFaq),
    };
}
function OutputPane({ html, tab, setTab }) {
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(t => (_jsx("button", { onClick: () => setTab(t), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: t === 'html' ? 'HTML' : 'Preview' }, t))) }), tab === 'preview' ? (_jsx("iframe", { title: "FAQ preview", srcDoc: html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a section and generate HTML to preview it.</p>', className: "h-full w-full flex-1 border-0 bg-white", sandbox: "allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(html), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300", children: html || '// Generate HTML first' })] }))] }));
}
function FaqEditor({ item, index, total, onChange, onRemove, onMove, }) {
    function patch(partial) {
        onChange({ ...item, ...partial });
    }
    function updateBullet(i, value) {
        const next = [...item.items];
        next[i] = value;
        patch({ items: next });
    }
    return (_jsxs("div", { className: "mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-3 flex items-center gap-2", children: [_jsx("span", { className: "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white", children: index + 1 }), _jsx("div", { className: "min-w-0 flex-1 truncate text-sm font-semibold text-slate-700", children: textOf(item.question) || 'Untitled question' }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === 0, onClick: () => onMove(-1), children: "Up" }), _jsx("button", { className: "btn-ghost px-2 py-1 text-xs", disabled: index === total - 1, onClick: () => onMove(1), children: "Down" }), _jsx("button", { className: "btn-danger", onClick: onRemove, children: "Remove" })] }), _jsx(RichTextField, { label: "Question", value: normalize(item.question, 'faqQuestion'), defaultKey: "faqQuestion", onChange: question => patch({ question }) }), _jsx(Field, { label: "Answer type", children: _jsxs("select", { className: "input", value: item.type, onChange: e => patch({ type: e.target.value }), children: [_jsx("option", { value: "paragraph", children: "Paragraph" }), _jsx("option", { value: "heading-para", children: "Heading + Paragraph" }), _jsx("option", { value: "bullets", children: "Bullet list" }), _jsx("option", { value: "heading-bullets", children: "Heading + Bullet list" })] }) }), (item.type === 'heading-para' || item.type === 'heading-bullets') && (_jsx(RichTextField, { label: "Heading", value: normalize(item.heading, 'faqHeading'), defaultKey: "faqHeading", onChange: heading => patch({ heading }) })), (item.type === 'paragraph' || item.type === 'heading-para') && (_jsx(RichTextField, { label: "Paragraph", hint: "HTML allowed", multiline: true, value: normalize(item.para, 'faq'), defaultKey: "faq", onChange: para => patch({ para }) })), (item.type === 'bullets' || item.type === 'heading-bullets') && (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Bullet Items" }), (item.items || []).map((entry, i) => (_jsxs("div", { className: "mb-2 grid grid-cols-[1fr_auto] gap-2", children: [_jsx(RichTextField, { label: `Bullet ${i + 1}`, value: normalize(entry, 'faqBullet'), defaultKey: "faqBullet", onChange: bullet => updateBullet(i, bullet) }), _jsx("button", { className: "btn-danger mt-6 h-9", onClick: () => patch({ items: item.items.filter((_, idx) => idx !== i) }), children: "Remove" })] }, i))), _jsx("button", { className: "btn-ghost w-full justify-center", onClick: () => patch({ items: [...(item.items || []), normalize('', 'faqBullet')] }), children: "+ Add bullet" })] }))] }));
}
export default function FAQ() {
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [html, setHtml] = useState('');
    const [tab, setTab] = useState('preview');
    useEffect(() => {
        api.get('/content/vls-faq')
            .then(row => {
            const next = (row?.data?.sections || []).map(normalizeSection);
            setSections(next);
            if (next[0])
                setActiveId(next[0].id);
        })
            .finally(() => setLoading(false));
    }, []);
    const active = useMemo(() => sections.find(section => section.id === activeId) || null, [sections, activeId]);
    const totalFaqs = sections.reduce((count, section) => count + section.items.length, 0);
    function updateSection(section) {
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
        if (!active)
            return;
        const copy = {
            id: id('fqs'),
            name: `NEW_${active.name || 'FAQ Section'}`,
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
        if (!active || !confirm(`Delete "${active.name || 'this FAQ section'}"?`))
            return;
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
        if (!active)
            return;
        updateSection({ ...active, items: [...active.items, makeFaq()] });
    }
    function updateFaq(index, item) {
        if (!active)
            return;
        const next = [...active.items];
        next[index] = item;
        updateSection({ ...active, items: next });
    }
    function moveFaq(index, dir) {
        if (!active)
            return;
        const nextIndex = index + dir;
        if (nextIndex < 0 || nextIndex >= active.items.length)
            return;
        const next = [...active.items];
        const [item] = next.splice(index, 1);
        next.splice(nextIndex, 0, item);
        updateSection({ ...active, items: next });
    }
    if (loading)
        return _jsx("div", { className: "p-5 text-sm text-slate-400", children: "Loading FAQ..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[560px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "FAQ" }), _jsxs("p", { className: "mt-0.5 text-xs text-slate-400", children: ["Site wide Sections / ", sections.length, " sections / ", totalFaqs, " FAQs"] })] }), _jsx("button", { onClick: addSection, className: "btn-ghost text-xs", children: "+ New Section" })] }), _jsxs("div", { className: "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "section-label mt-0", children: "FAQ Sections" }), _jsxs("div", { className: "mb-2 flex gap-2", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => setActiveId(e.target.value), children: [_jsx("option", { value: "", children: "- select -" }), sections.map(section => _jsxs("option", { value: section.id, children: [section.name || 'Untitled section', " (", section.items.length, ")"] }, section.id))] }), active && _jsx("button", { onClick: duplicateSection, className: "btn-ghost text-xs", children: "Duplicate" }), active && _jsx("button", { onClick: deleteSection, className: "btn-danger text-xs", children: "Delete" })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving...' : saved ? 'Saved' : 'Save All' }), _jsx("button", { onClick: () => { setHtml(wrapGeneratedHtml('FAQ', generateFaqHtml(active?.items || []))); setTab('preview'); }, disabled: !active, className: "btn-success flex-1 justify-center", children: "Generate HTML" })] })] })] }), !active ? (_jsx("div", { className: "p-5 text-sm text-slate-400", children: "Create or select a FAQ section." })) : (_jsxs("div", { className: "px-5 py-4", children: [_jsx(Field, { label: "Section name", children: _jsx("input", { className: "input", value: active.name, onChange: e => updateSection({ ...active, name: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Questions" }), active.items.map((item, index) => (_jsx(FaqEditor, { item: item, index: index, total: active.items.length, onChange: next => updateFaq(index, next), onRemove: () => updateSection({ ...active, items: active.items.filter((_, i) => i !== index) }), onMove: dir => moveFaq(index, dir) }, item.id))), _jsx("button", { onClick: addFaq, className: "btn-ghost mb-6 w-full justify-center", children: "+ Add FAQ" })] }))] }), _jsx(OutputPane, { html: html, tab: tab, setTab: setTab })] }));
}
