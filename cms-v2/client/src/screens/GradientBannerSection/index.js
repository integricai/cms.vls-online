import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import PaddingControl from '../../components/PaddingControl';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateGradientBannerHtml } from './generateHtml';
let counter = 0;
function td(value, key) {
    return normalize(value, key);
}
function newSection() {
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
function ColorField({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "h-9 w-10 shrink-0 cursor-pointer rounded border border-slate-300 p-0.5" }), _jsx("input", { className: "input", value: value, onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function SectionList({ sections, activeId, onSelect, onCreate, onDelete }) {
    return (_jsxs("div", { className: "mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Saved Sections" }), _jsx("button", { onClick: onCreate, className: "btn-ghost px-2 py-1 text-xs", children: "+ New" })] }), _jsx("div", { className: "space-y-1", children: sections.map(section => (_jsxs("div", { onClick: () => onSelect(section.id), className: `flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition ${section.id === activeId ? 'bg-brand text-white' : 'border border-slate-200 bg-white text-slate-700 hover:border-brand/40'}`, children: [_jsx("span", { className: "truncate font-medium", children: section.name || 'Untitled' }), sections.length > 1 && (_jsx("button", { onClick: e => { e.stopPropagation(); onDelete(section.id); }, className: `ml-2 shrink-0 text-xs ${section.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u00D7" }))] }, section.id))) })] }));
}
function BannerForm({ section, onChange }) {
    function asText(value, key) {
        return normalize(value, key);
    }
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label mt-0", children: "Section" }), _jsx(Field, { label: "Section name", hint: "CMS only", children: _jsx("input", { className: "input", value: section.name, onChange: e => onChange({ name: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Gradient" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorField, { label: "Left colour", value: section.gradientLeft, onChange: gradientLeft => onChange({ gradientLeft }) }), _jsx(ColorField, { label: "Right colour", value: section.gradientRight, onChange: gradientRight => onChange({ gradientRight }) })] }), _jsx("p", { className: "section-label", children: "Spacing" }), _jsx(PaddingControl, { value: section, defaults: { padTop: 48, padBot: 48, padLeft: 34, padRight: 34 }, onChange: onChange }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(RichTextField, { label: "Eyebrow", value: asText(section.eyebrow, 'gbEyebrow'), defaultKey: "gbEyebrow", onChange: eyebrow => onChange({ eyebrow }) }), _jsx(RichTextField, { label: "Title", value: asText(section.title, 'gbTitle'), defaultKey: "gbTitle", onChange: title => onChange({ title }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: asText(section.desc, 'gbDesc'), defaultKey: "gbDesc", onChange: desc => onChange({ desc }) }), _jsx("p", { className: "section-label", children: "Buttons" }), _jsx(RichTextField, { label: "Primary button", value: asText(section.primaryText, 'gbPrimary'), defaultKey: "gbPrimary", onChange: primaryText => onChange({ primaryText }) }), _jsx(Field, { label: "Primary URL", children: _jsx("input", { className: "input", value: section.primaryUrl, onChange: e => onChange({ primaryUrl: e.target.value }) }) }), _jsx(ColorField, { label: "Primary background", value: section.primaryBg, onChange: primaryBg => onChange({ primaryBg }) }), _jsx(RichTextField, { label: "Secondary button", value: asText(section.secondaryText, 'gbSecondary'), defaultKey: "gbSecondary", onChange: secondaryText => onChange({ secondaryText }) }), _jsx(Field, { label: "Secondary URL", children: _jsx("input", { className: "input", value: section.secondaryUrl, onChange: e => onChange({ secondaryUrl: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorField, { label: "Secondary background", value: section.secondaryBg, onChange: secondaryBg => onChange({ secondaryBg }) }), _jsx(ColorField, { label: "Secondary border", value: section.secondaryBorder, onChange: secondaryBorder => onChange({ secondaryBorder }) })] })] }));
}
export default function GradientBannerSectionScreen() {
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [html, setHtml] = useState('');
    const section = sections.find(item => item.id === activeId) || null;
    useEffect(() => {
        api.get('/content/vls-gradient-banner-sections')
            .then(row => {
            const loaded = row?.data?.sections || [];
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
        if (section)
            setHtml(wrapGeneratedHtml('Gradient Banner Section', generateGradientBannerHtml(section)));
    }, [section]);
    const updateSection = useCallback((patch) => {
        setSections(prev => prev.map(item => item.id === activeId ? { ...item, ...patch } : item));
        setSaved(false);
    }, [activeId]);
    function createSection() {
        const next = newSection();
        setSections(prev => [...prev, next]);
        setActiveId(next.id);
        setSaved(false);
    }
    function deleteSection(id) {
        setSections(prev => {
            const next = prev.filter(item => item.id !== id);
            if (activeId === id)
                setActiveId(next[0]?.id || null);
            return next;
        });
        setSaved(false);
    }
    async function save() {
        setSaving(true);
        try {
            await api.put('/content/vls-gradient-banner-sections', { sections });
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[440px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Gradient Banner Section" }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: "Two-column callout banner with gradient background" })] }), _jsxs("div", { className: "flex gap-2 border-b border-slate-100 bg-white px-5 py-3", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving...' : saved ? 'Saved' : 'Save' }), _jsx("button", { onClick: () => { if (section) {
                                    setHtml(wrapGeneratedHtml('Gradient Banner Section', generateGradientBannerHtml(section)));
                                    setActiveTab('preview');
                                } }, className: "btn-success flex-1 justify-center", children: "Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsx(SectionList, { sections: sections, activeId: activeId, onSelect: setActiveId, onCreate: createSection, onDelete: deleteSection }), section && _jsx(BannerForm, { section: section, onChange: updateSection })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>', className: "h-full w-full flex-1 border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(html), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300", children: html || '// Generate HTML first' })] }))] })] }));
}
