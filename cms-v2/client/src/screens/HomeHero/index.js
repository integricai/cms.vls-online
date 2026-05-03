import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateHeroHtml } from './generateHtml';
import Field from '../../components/Field';
import ColorPicker from '../../components/ColorPicker';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
const MAX_W_OPTIONS = ['480px', '560px', '640px', '720px', '100%'];
let counter = 0;
function newSection() {
    counter++;
    return {
        id: `hs${counter}`,
        name: `Hero Section ${counter}`,
        bg: '#ffffff',
        maxW: '560px',
        padTop: 48, padBot: 48, padLeft: 0, padRight: 0,
        h1Size: 44,
        eyebrow: normalize('VERTEX LEARNING SOLUTIONS', 'heroEyebrow'),
        h1: normalize('Expert-led tutoring & coaching', 'heroH1'),
        h1hl: normalize('— built for results.', 'heroH1Highlight'),
        h2: normalize('', 'heroH2'),
        desc: normalize('Vertex Learning Solutions (VLS) connects ambitious learners with expert tutors across ACCA, CIMA, and CMA.', 'hero'),
        b1t: normalize('Browse courses', 'heroButton'),
        b1u: '', b1s: '',
        b2t: normalize('Enquire now ↓', 'heroButtonAlt'),
        b2u: '', b2s: '',
        tags: ['ACCA tuition', 'CIMA coaching', 'Online tutoring', '1-to-1 coaching']
            .map(t => normalize(t, 'heroTag')),
        stats: [
            { v: normalize('2,400+', 'heroStatValue'), l: normalize('Students enrolled', 'heroStatLabel') },
            { v: normalize('98%', 'heroStatValue'), l: normalize('Satisfaction rate', 'heroStatLabel') },
            { v: normalize('35+', 'heroStatValue'), l: normalize('Courses available', 'heroStatLabel') },
        ],
    };
}
function asTextData(v, key) {
    return normalize(v, key);
}
// ── Section list sidebar ──────────────────────────────────────────────────────
function SectionList({ sections, activeId, onSelect, onCreate, onDelete, }) {
    return (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Sections" }), _jsx("button", { onClick: onCreate, className: "btn-ghost text-xs py-1 px-2", children: "+ New" })] }), _jsxs("div", { className: "space-y-1", children: [sections.map(sec => (_jsxs("div", { className: `flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${sec.id === activeId
                            ? 'bg-brand text-white'
                            : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'}`, onClick: () => onSelect(sec.id), children: [_jsx("span", { className: "truncate font-medium", children: sec.name || 'Untitled' }), sections.length > 1 && (_jsx("button", { onClick: e => { e.stopPropagation(); onDelete(sec.id); }, className: `ml-2 shrink-0 text-xs ${sec.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u2715" }))] }, sec.id))), sections.length === 0 && (_jsx("p", { className: "text-xs text-slate-400 italic px-1", children: "No sections yet." }))] })] }));
}
// ── Main screen ───────────────────────────────────────────────────────────────
export default function HomeHero() {
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const sec = sections.find(s => s.id === activeId) ?? null;
    // Load from API
    useEffect(() => {
        api.get('/content/vls-home-hero')
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
    // Regenerate preview when active section changes
    useEffect(() => {
        if (sec)
            setPreviewHtml(wrapGeneratedHtml('Home Hero', generateHeroHtml(sec)));
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
            await api.put('/content/vls-home-hero', { sections });
            setSaved(true);
        }
        finally {
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
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Home Hero" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Hero banner for the homepage" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generateAndPreview, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsx(SectionList, { sections: sections, activeId: activeId, onSelect: setActiveId, onCreate: createSection, onDelete: deleteSection }), sec && (_jsx(HeroForm, { section: sec, onChange: updateSec }))] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${activeTab === tab
                                ? 'border-brand text-brand'
                                : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to see a preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
// ── Form fields ───────────────────────────────────────────────────────────────
function HeroForm({ section: s, onChange }) {
    function patchTag(i, v) {
        const tags = [...s.tags];
        tags[i] = v;
        onChange({ tags });
    }
    function addTag() {
        onChange({ tags: [...s.tags, normalize('', 'heroTag')] });
    }
    function removeTag(i) {
        onChange({ tags: s.tags.filter((_, idx) => idx !== i) });
    }
    function patchStat(i, field, v) {
        const stats = [...s.stats];
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
    function removeStat(i) {
        onChange({ stats: s.stats.filter((_, idx) => idx !== i) });
    }
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Section Setup" }), _jsx(Field, { label: "Section name", hint: "CMS only", children: _jsx("input", { className: "input", value: s.name, onChange: e => onChange({ name: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Layout" }), _jsx(Field, { label: "Background colour", children: _jsx(ColorPicker, { value: s.bg, onChange: bg => onChange({ bg }) }) }), _jsx(Field, { label: "Max width", children: _jsx("select", { className: "input", value: s.maxW, onChange: e => onChange({ maxW: e.target.value }), children: MAX_W_OPTIONS.map(w => _jsx("option", { value: w, children: w }, w)) }) }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ['padTop', 'padBot', 'padLeft', 'padRight'].map(k => (_jsx(Field, { label: k.replace('pad', 'Pad ').replace('Top', 'top').replace('Bot', 'bottom').replace('Left', 'left').replace('Right', 'right') + ' (px)', children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: s[k], onChange: e => onChange({ [k]: Number(e.target.value) }) }) }, k))) }), _jsx(Field, { label: "H1 font size (px)", children: _jsx("input", { type: "number", className: "input", min: 24, max: 80, value: s.h1Size, onChange: e => onChange({ h1Size: Number(e.target.value) }) }) }), _jsx("p", { className: "section-label", children: "Eyebrow" }), _jsx(RichTextField, { label: "Eyebrow text", value: asTextData(s.eyebrow, 'heroEyebrow'), defaultKey: "heroEyebrow", onChange: v => onChange({ eyebrow: v }) }), _jsx("p", { className: "section-label", children: "Heading" }), _jsx(RichTextField, { label: "H1 \u2014 Main line", value: asTextData(s.h1, 'heroH1'), defaultKey: "heroH1", onChange: v => onChange({ h1: v }) }), _jsx(RichTextField, { label: "H1 \u2014 Highlighted line", hint: "displays in VLS blue", value: asTextData(s.h1hl, 'heroH1Highlight'), defaultKey: "heroH1Highlight", onChange: v => onChange({ h1hl: v }) }), _jsx(RichTextField, { label: "H2 \u2014 Sub-heading", hint: "optional", value: asTextData(s.h2, 'heroH2'), defaultKey: "heroH2", onChange: v => onChange({ h2: v }) }), _jsx("p", { className: "section-label", children: "Description" }), _jsx(RichTextField, { label: "Body text", multiline: true, value: asTextData(s.desc, 'hero'), defaultKey: "hero", onChange: v => onChange({ desc: v }) }), _jsx("p", { className: "section-label", children: "Tag Pills" }), _jsx("div", { className: "space-y-1.5 mb-2", children: s.tags.map((tag, i) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Tag ${i + 1}`, value: tag, defaultKey: "heroTag", onChange: v => patchTag(i, v) }) }), _jsx("button", { onClick: () => removeTag(i), className: "btn-danger mt-5", children: "\u2715" })] }, i))) }), _jsx("button", { onClick: addTag, className: "btn-ghost text-xs w-full", children: "+ Add tag" }), _jsx("p", { className: "section-label", children: "Call to Action Buttons" }), _jsx(RichTextField, { label: "Primary button text", value: asTextData(s.b1t, 'heroButton'), defaultKey: "heroButton", onChange: v => onChange({ b1t: v }) }), _jsx(Field, { label: "Primary button URL", children: _jsx("input", { className: "input", value: s.b1u, placeholder: "https://", onChange: e => onChange({ b1u: e.target.value }) }) }), _jsx(Field, { label: "Primary \u2014 scroll to", hint: "overrides URL, e.g. .section-faq", children: _jsx("input", { className: "input", value: s.b1s, placeholder: ".my-section or #my-section", onChange: e => onChange({ b1s: e.target.value }) }) }), _jsx(RichTextField, { label: "Secondary button text", value: asTextData(s.b2t, 'heroButtonAlt'), defaultKey: "heroButtonAlt", onChange: v => onChange({ b2t: v }) }), _jsx(Field, { label: "Secondary button URL", children: _jsx("input", { className: "input", value: s.b2u, placeholder: "https://", onChange: e => onChange({ b2u: e.target.value }) }) }), _jsx(Field, { label: "Secondary \u2014 scroll to", hint: "overrides URL", children: _jsx("input", { className: "input", value: s.b2s, placeholder: ".my-section or #my-section", onChange: e => onChange({ b2s: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Stats" }), _jsx("div", { className: "space-y-3 mb-2", children: s.stats.map((stat, i) => (_jsxs("div", { className: "rounded-lg border border-slate-100 bg-slate-50 p-3 relative", children: [_jsx("button", { onClick: () => removeStat(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(RichTextField, { label: "Value", value: stat.v, defaultKey: "heroStatValue", onChange: v => patchStat(i, 'v', v) }), _jsx(RichTextField, { label: "Label", value: stat.l, defaultKey: "heroStatLabel", onChange: v => patchStat(i, 'l', v) })] }, i))) }), _jsx("button", { onClick: addStat, className: "btn-ghost text-xs w-full mb-4", children: "+ Add stat" })] }));
}
