import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateHeroV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
function makeDefault() {
    return {
        bg: '#0d1f3c', leftW: 55,
        padTop: 80, padBot: 80, padLeft: 60, padRight: 60,
        dotColor: '#4a90d9', hlColor: '#4a90d9', tagBg: '#1e3550', tagTc: '#94a3b8', cardBg: '#1e3550',
        eyebrow: normalize('', 'h2Eyebrow'),
        heading: normalize('', 'h2Heading'),
        highlight: normalize('', 'h2Highlight'),
        body: normalize('', 'h2Body'),
        tags: [], ctas: [], stats: [], rcards: [],
    };
}
function makeCta() {
    return { text: '', url: '#', scroll: '', style: 'solid', bg: '#1e3a5f', tc: '#ffffff', bc: '#ffffff' };
}
function makeStat() { return { value: '', label: '' }; }
function makeRCard() { return { icon: '📚', iconBg: '#1a56a3', title: '', subtitle: '', count: '', url: '#' }; }
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function asTV(v, key) { return normalize(v, key); }
export default function HeroSectionV2Screen() {
    const [components, setComponents] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    useEffect(() => {
        api.get('/content/vls-hero2-components')
            .then(row => {
            const comps = row?.data?.components ?? [];
            setComponents(comps);
            if (comps.length > 0) {
                setActiveId(comps[0].id);
                setName(comps[0].name);
                setState(comps[0].data || makeDefault());
            }
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    const upd = useCallback((patch) => {
        setState(prev => ({ ...prev, ...patch }));
        setSaved(false);
    }, []);
    function loadComponent(id) {
        if (!id) {
            newComponent();
            return;
        }
        const c = components.find(c => c.id === id);
        if (!c)
            return;
        setActiveId(c.id);
        setName(c.name);
        setState(c.data || makeDefault());
        setSaved(false);
    }
    function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setSaved(false); }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name first.');
            return;
        }
        setSaving(true);
        try {
            let id = activeId;
            let comps = [...components];
            if (id) {
                comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
                if (!comps.find(c => c.id === id)) {
                    id = `h2-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `h2-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-hero2-components', { components: comps });
            setComponents(comps);
            setActiveId(id);
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    async function deleteComponent() {
        if (!activeId)
            return;
        if (!window.confirm('Delete this component?'))
            return;
        const comps = components.filter(c => c.id !== activeId);
        await api.put('/content/vls-hero2-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    // CTAs
    function updateCta(i, patch) { const a = [...state.ctas]; a[i] = { ...a[i], ...patch }; upd({ ctas: a }); }
    function addCta() { upd({ ctas: [...state.ctas, makeCta()] }); }
    function removeCta(i) { upd({ ctas: state.ctas.filter((_, idx) => idx !== i) }); }
    // Stats
    function updateStat(i, patch) { const a = [...state.stats]; a[i] = { ...a[i], ...patch }; upd({ stats: a }); }
    function addStat() { upd({ stats: [...state.stats, makeStat()] }); }
    function removeStat(i) { upd({ stats: state.stats.filter((_, idx) => idx !== i) }); }
    // RCards
    function updateRCard(i, patch) { const a = [...state.rcards]; a[i] = { ...a[i], ...patch }; upd({ rcards: a }); }
    function addRCard() { upd({ rcards: [...state.rcards, makeRCard()] }); }
    function removeRCard(i) { upd({ rcards: state.rcards.filter((_, idx) => idx !== i) }); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Hero Section V2" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Two-column hero \u2014 left content, right course cards" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(generateHeroV2Html(state)); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. Home Hero V2", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Background & Layout" }), _jsx(ColorRow, { label: "Background colour", value: state.bg, onChange: v => upd({ bg: v }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Left column width (%)", children: _jsx("input", { type: "number", className: "input", min: 35, max: 70, value: state.leftW, onChange: e => upd({ leftW: Number(e.target.value) }) }) }), ['padTop', 'padBot', 'padLeft', 'padRight'].map(k => (_jsx(Field, { label: k.replace('pad', 'Pad ').replace('Top', ' top').replace('Bot', ' bottom').replace('Left', ' left').replace('Right', ' right') + ' (px)', children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: state[k], onChange: e => upd({ [k]: Number(e.target.value) }) }) }, k)))] }), _jsx("p", { className: "section-label", children: "Accent Colours" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Eyebrow dot", value: state.dotColor, onChange: v => upd({ dotColor: v }) }), _jsx(ColorRow, { label: "Highlight text", value: state.hlColor, onChange: v => upd({ hlColor: v }) }), _jsx(ColorRow, { label: "Tag background", value: state.tagBg, onChange: v => upd({ tagBg: v }) }), _jsx(ColorRow, { label: "Tag text", value: state.tagTc, onChange: v => upd({ tagTc: v }) }), _jsx(ColorRow, { label: "Card background", value: state.cardBg, onChange: v => upd({ cardBg: v }) })] }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(RichTextField, { label: "Eyebrow", value: asTV(state.eyebrow, 'h2Eyebrow'), defaultKey: "h2Eyebrow", onChange: v => upd({ eyebrow: v }) }), _jsx(RichTextField, { label: "Heading (use \u21B5 newline before last line for highlight)", value: asTV(state.heading, 'h2Heading'), defaultKey: "h2Heading", onChange: v => upd({ heading: v }), multiline: true }), _jsx(RichTextField, { label: "Heading highlight (appended to last line)", value: asTV(state.highlight, 'h2Highlight'), defaultKey: "h2Highlight", onChange: v => upd({ highlight: v }) }), _jsx(RichTextField, { label: "Body text", value: asTV(state.body, 'h2Body'), defaultKey: "h2Body", onChange: v => upd({ body: v }), multiline: true }), _jsx("p", { className: "section-label", children: "Eyebrow Tags" }), _jsx("div", { className: "space-y-1.5 mb-2", children: state.tags.map((tag, i) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input flex-1", value: tag, placeholder: "e.g. ACCA tuition", onChange: e => { const t = [...state.tags]; t[i] = e.target.value; upd({ tags: t }); } }), _jsx("button", { onClick: () => upd({ tags: state.tags.filter((_, idx) => idx !== i) }), className: "btn-danger", children: "\u2715" })] }, i))) }), _jsx("button", { onClick: () => upd({ tags: [...state.tags, ''] }), className: "btn-ghost text-xs w-full mb-1", children: "+ Add tag" }), _jsx("p", { className: "section-label", children: "CTA Buttons" }), _jsx("div", { className: "space-y-2 mb-2", children: state.ctas.map((cta, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeCta(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(Field, { label: "Button text", children: _jsx("input", { className: "input", value: cta.text, placeholder: "Browse all courses \u2193", onChange: e => updateCta(i, { text: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Style", children: _jsxs("select", { className: "input", value: cta.style, onChange: e => updateCta(i, { style: e.target.value }), children: [_jsx("option", { value: "solid", children: "Solid" }), _jsx("option", { value: "outlined", children: "Outlined" })] }) }), _jsx(Field, { label: "URL", children: _jsx("input", { className: "input", value: cta.url, placeholder: "https://...", onChange: e => updateCta(i, { url: e.target.value }) }) })] }), _jsx(Field, { label: "Scroll target (optional \u2014 overrides URL)", hint: "CSS selector or ID", children: _jsx("input", { className: "input", value: cta.scroll, placeholder: "#courses or .section-id", onChange: e => updateCta(i, { scroll: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx(ColorRow, { label: "Background", value: cta.bg, onChange: v => updateCta(i, { bg: v }) }), _jsx(ColorRow, { label: "Text", value: cta.tc, onChange: v => updateCta(i, { tc: v }) }), _jsx(ColorRow, { label: "Border", value: cta.bc, onChange: v => updateCta(i, { bc: v }) })] })] }, i))) }), _jsx("button", { onClick: addCta, className: "btn-ghost text-xs w-full mb-1", children: "+ Add CTA" }), _jsx("p", { className: "section-label", children: "Stats Row" }), _jsx("div", { className: "space-y-1.5 mb-2", children: state.stats.map((stat, i) => (_jsxs("div", { className: "flex gap-2 items-end", children: [_jsx(Field, { label: "Value", children: _jsx("input", { className: "input", value: stat.value, placeholder: "2,400+", onChange: e => updateStat(i, { value: e.target.value }) }) }), _jsx(Field, { label: "Label", children: _jsx("input", { className: "input", value: stat.label, placeholder: "STUDENTS ENROLLED", onChange: e => updateStat(i, { label: e.target.value }) }) }), _jsx("button", { onClick: () => removeStat(i), className: "btn-danger mb-0.5", children: "\u2715" })] }, i))) }), _jsx("button", { onClick: addStat, className: "btn-ghost text-xs w-full mb-1", children: "+ Add stat" }), _jsx("p", { className: "section-label", children: "Right Column Cards" }), _jsx("div", { className: "space-y-2 mb-2", children: state.rcards.map((card, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeRCard(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: card.icon, placeholder: "\uD83D\uDCDA", onChange: e => updateRCard(i, { icon: e.target.value }) }) }), _jsx(ColorRow, { label: "Icon background", value: card.iconBg, onChange: v => updateRCard(i, { iconBg: v }) })] }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: card.title, placeholder: "ACCA Courses", onChange: e => updateRCard(i, { title: e.target.value }) }) }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { className: "input", value: card.subtitle, placeholder: "Foundation \u00B7 Applied Knowledge \u00B7 Skills", onChange: e => updateRCard(i, { subtitle: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Count badge (optional)", children: _jsx("input", { className: "input", value: card.count, placeholder: "75 courses", onChange: e => updateRCard(i, { count: e.target.value }) }) }), _jsx(Field, { label: "Link URL", children: _jsx("input", { className: "input", value: card.url, placeholder: "https://...", onChange: e => updateRCard(i, { url: e.target.value }) }) })] })] }, i))) }), _jsx("button", { onClick: addRCard, className: "btn-ghost text-xs w-full mb-4", children: "+ Add card" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
