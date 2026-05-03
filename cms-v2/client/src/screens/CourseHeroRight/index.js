import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateCourseHeroRightHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
function makeDefault() {
    return {
        bg: '#ffffff', border: '#e2e8f0',
        padTop: 24, padBot: 24, padLeft: 24, padRight: 24,
        radius: 12, divider: '#f1f5f9', iconBg: '#f0f4ff',
        badgeBg: '#e2e8f0', badgeTc: '#374151',
        labelText: 'THIS COURSE INCLUDES',
        ctaUrl: '#', ctaText: 'Enrol Now →',
        ctaBg: '#0f172a', ctaTc: '#ffffff', ctaRadius: 8,
        items: [],
    };
}
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
export default function CourseHeroRightScreen() {
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
        api.get('/content/vls-course-hero-right-components')
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
                    id = `chr-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `chr-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-course-hero-right-components', { components: comps });
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
        await api.put('/content/vls-course-hero-right-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function updateItem(i, patch) {
        const items = [...state.items];
        items[i] = { ...items[i], ...patch };
        upd({ items });
    }
    function addItem() {
        upd({ items: [...state.items, { icon: '📚', title: normalize('', 'chrItemTitle'), desc: normalize('', 'chrItemDesc'), badge: '' }] });
    }
    function removeItem(i) { upd({ items: state.items.filter((_, idx) => idx !== i) }); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Right Hero Section" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Course page hero \u2014 right column card panel" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(generateCourseHeroRightHtml(state)); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. FA1 Course Panel", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Card Styling" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(ColorRow, { label: "Border", value: state.border, onChange: v => upd({ border: v }) }), _jsx(ColorRow, { label: "Item divider", value: state.divider, onChange: v => upd({ divider: v }) }), _jsx(ColorRow, { label: "Icon background", value: state.iconBg, onChange: v => upd({ iconBg: v }) }), _jsx(ColorRow, { label: "Badge background", value: state.badgeBg, onChange: v => upd({ badgeBg: v }) }), _jsx(ColorRow, { label: "Badge text", value: state.badgeTc, onChange: v => upd({ badgeTc: v }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Border radius (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 40, value: state.radius, onChange: e => upd({ radius: Number(e.target.value) }) }) }), ['padTop', 'padBot', 'padLeft', 'padRight'].map(k => (_jsx(Field, { label: k.replace('pad', 'Pad ').replace('Top', 'top').replace('Bot', 'bottom').replace('Left', 'left').replace('Right', 'right') + ' (px)', children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state[k], onChange: e => upd({ [k]: Number(e.target.value) }) }) }, k)))] }), _jsx("p", { className: "section-label", children: "Section Label" }), _jsx(Field, { label: "Label text", children: _jsx("input", { className: "input", value: state.labelText, placeholder: "THIS COURSE INCLUDES", onChange: e => upd({ labelText: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Items" }), _jsx("div", { className: "space-y-2 mb-2", children: state.items.map((item, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeItem(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(Field, { label: "Icon (emoji or URL)", children: _jsx("input", { className: "input", value: item.icon, placeholder: "\uD83D\uDCDA or https://...", onChange: e => updateItem(i, { icon: e.target.value }) }) }), _jsx(RichTextField, { label: "Title", value: asTV(item.title, 'chrItemTitle'), defaultKey: "chrItemTitle", onChange: v => updateItem(i, { title: v }) }), _jsx(RichTextField, { label: "Description", value: asTV(item.desc, 'chrItemDesc'), defaultKey: "chrItemDesc", onChange: v => updateItem(i, { desc: v }) }), _jsx(Field, { label: "Badge (optional)", hint: "e.g. 46 hours", children: _jsx("input", { className: "input", value: item.badge, placeholder: "46 hours", onChange: e => updateItem(i, { badge: e.target.value }) }) })] }, i))) }), _jsx("button", { onClick: addItem, className: "btn-ghost text-xs w-full mb-1", children: "+ Add item" }), _jsx("p", { className: "section-label", children: "CTA Button" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Button background", value: state.ctaBg, onChange: v => upd({ ctaBg: v }) }), _jsx(ColorRow, { label: "Button text", value: state.ctaTc, onChange: v => upd({ ctaTc: v }) })] }), _jsx(Field, { label: "Border radius (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 40, value: state.ctaRadius, onChange: e => upd({ ctaRadius: Number(e.target.value) }) }) }), _jsx(Field, { label: "Button text", children: _jsx("input", { className: "input", value: state.ctaText, placeholder: "Enrol Now \u2192", onChange: e => upd({ ctaText: e.target.value }) }) }), _jsx(Field, { label: "Button URL", children: _jsx("input", { className: "input", value: state.ctaUrl, placeholder: "https://...", onChange: e => upd({ ctaUrl: e.target.value }) }) })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
