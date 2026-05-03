import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generatePromoSectionHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
let counter = 0;
function nd(v, key) {
    return normalize(v, key);
}
function newSection() {
    counter++;
    return {
        id: `prs${counter}`,
        name: `Promotion Section ${counter}`,
        bg: '#deebf7',
        btnBg: '#152b57',
        padLeft: 24,
        padRight: 24,
        title: nd('Ready to take the next step?', 'promoTitle'),
        subtitle: nd('Join 2,400+ learners already transforming their careers with Vertex Learning Solutions.', 'promoSubtitle'),
        ctaText: nd('Start for free', 'promoCta'),
        ctaUrl: '#',
    };
}
function SectionList({ sections, activeId, onSelect, onCreate, onDelete }) {
    return (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Sections" }), _jsx("button", { onClick: onCreate, className: "btn-ghost text-xs py-1 px-2", children: "+ New" })] }), _jsx("div", { className: "space-y-1", children: sections.map(sec => (_jsxs("div", { onClick: () => onSelect(sec.id), className: `flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${sec.id === activeId
                        ? 'bg-brand text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'}`, children: [_jsx("span", { className: "truncate font-medium", children: sec.name || 'Untitled' }), sections.length > 1 && (_jsx("button", { onClick: e => { e.stopPropagation(); onDelete(sec.id); }, className: `ml-2 shrink-0 text-xs ${sec.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u2715" }))] }, sec.id))) })] }));
}
export default function PromotionSection() {
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const sec = sections.find(s => s.id === activeId) ?? null;
    useEffect(() => {
        api.get('/content/vls-promotion-sections')
            .then(row => {
            const secs = row?.data?.sections ?? [];
            if (secs.length === 0) {
                const first = newSection();
                setSections([first]);
                setActiveId(first.id);
            }
            else {
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
        if (sec)
            setPreviewHtml(wrapGeneratedHtml('Promotion Section', generatePromoSectionHtml(sec)));
    }, [sec]);
    const updateSec = useCallback((patch) => {
        setSections(prev => prev.map(s => s.id === activeId ? { ...s, ...patch } : s));
        setSaved(false);
    }, [activeId]);
    function createSection() {
        const s = newSection();
        setSections(prev => [...prev, s]);
        setActiveId(s.id);
        setSaved(false);
    }
    function deleteSection(id) {
        setSections(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeId === id)
                setActiveId(next[0]?.id ?? null);
            return next;
        });
        setSaved(false);
    }
    async function save() {
        setSaving(true);
        try {
            await api.put('/content/vls-promotion-sections', { sections });
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Promotion Section" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Full-width promotional banner with CTA button" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { if (sec) {
                                    setPreviewHtml(wrapGeneratedHtml('Promotion Section', generatePromoSectionHtml(sec)));
                                    setActiveTab('preview');
                                } }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsx(SectionList, { sections: sections, activeId: activeId, onSelect: setActiveId, onCreate: createSection, onDelete: deleteSection }), sec && _jsx(PromoForm, { section: sec, onChange: updateSec })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to see a preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
function ColorField({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: value, onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function PromoForm({ section: s, onChange }) {
    function asTextData(v, key) { return normalize(v, key); }
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Section Setup" }), _jsx(Field, { label: "Section name", hint: "CMS only", children: _jsx("input", { className: "input", value: s.name, onChange: e => onChange({ name: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Layout" }), _jsx(ColorField, { label: "Background colour", value: s.bg || '#deebf7', onChange: v => onChange({ bg: v }) }), _jsx(ColorField, { label: "CTA button background", value: s.btnBg || '#152b57', onChange: v => onChange({ btnBg: v }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: s.padLeft, onChange: e => onChange({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: s.padRight, onChange: e => onChange({ padRight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(RichTextField, { label: "Title", value: asTextData(s.title, 'promoTitle'), defaultKey: "promoTitle", onChange: v => onChange({ title: v }) }), _jsx(RichTextField, { label: "Subtitle", multiline: true, value: asTextData(s.subtitle, 'promoSubtitle'), defaultKey: "promoSubtitle", onChange: v => onChange({ subtitle: v }) }), _jsx("p", { className: "section-label", children: "CTA" }), _jsx(RichTextField, { label: "Button text", value: asTextData(s.ctaText, 'promoCta'), defaultKey: "promoCta", onChange: v => onChange({ ctaText: v }) }), _jsx(Field, { label: "Button URL", children: _jsx("input", { className: "input", value: s.ctaUrl, placeholder: "https://", onChange: e => onChange({ ctaUrl: e.target.value }) }) })] }));
}
