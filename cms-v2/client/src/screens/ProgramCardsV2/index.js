import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateProgramCardsV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function makeCard() {
    return { id: `pcv2c-${Date.now().toString(36)}`, imageUrl: '', imageAlt: '', accent: '#1f73b7', ctaBg: '#0d1f3c', tagBg: '#e4f2ff', cardBg: '#ffffff', eyebrow: normalize('', 'pcv2Eyebrow'), title: normalize('', 'pcv2Title'), desc: normalize('', 'pcv2Desc'), chips: '', meta: normalize('', 'pcv2Meta'), cta: normalize('Learn More →', 'pcv2Cta'), url: '#' };
}
function makeDefault() {
    return { bg: '#ffffff', maxWidth: 930, gap: 16, cards: [] };
}
function asTV(v, key) { return normalize(v, key); }
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
export default function ProgramCardsV2Screen() {
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
        api.get('/content/vls-program-cards-v2')
            .then(row => {
            const raw = row?.data;
            let comps = [];
            if (raw?.components) {
                comps = raw.components;
            }
            else if (raw?.collections) {
                comps = raw.collections.map((col, i) => ({
                    id: col.id || `pcv2-${i}`,
                    name: col.name || `Collection ${i + 1}`,
                    data: { bg: col.bg ?? '#ffffff', maxWidth: col.maxWidth ?? 930, gap: col.gap ?? 16, cards: col.cards || [] },
                }));
            }
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
    const upd = useCallback((patch) => { setState(prev => ({ ...prev, ...patch })); setSaved(false); }, []);
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
                    id = `pcv2-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `pcv2-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-program-cards-v2', { components: comps });
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
        await api.put('/content/vls-program-cards-v2', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function updateCard(i, patch) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
    function addCard() { upd({ cards: [...state.cards, makeCard()] }); }
    function removeCard(i) { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Program Cards v2" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Horizontal cards \u2014 image left, content right, chips & CTA" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(wrapGeneratedHtml('Program Cards V2', generateProgramCardsV2Html(state))); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. ACCA Programs", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Layout" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Max width (px)", children: _jsx("input", { type: "number", className: "input", min: 520, max: 1400, value: state.maxWidth, onChange: e => upd({ maxWidth: Number(e.target.value) }) }) }), _jsx(Field, { label: "Card gap (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 60, value: state.gap, onChange: e => upd({ gap: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Cards" }), _jsx("div", { className: "space-y-3 mb-2", children: state.cards.map((card, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeCard(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(Field, { label: "Image URL", children: _jsx("input", { className: "input", value: card.imageUrl, placeholder: "https://\u2026", onChange: e => updateCard(i, { imageUrl: e.target.value }) }) }), _jsx(Field, { label: "Image alt text", children: _jsx("input", { className: "input", value: card.imageAlt, placeholder: "Descriptive alt text", onChange: e => updateCard(i, { imageAlt: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Accent", value: card.accent, onChange: v => updateCard(i, { accent: v }) }), _jsx(ColorRow, { label: "CTA background", value: card.ctaBg, onChange: v => updateCard(i, { ctaBg: v }) }), _jsx(ColorRow, { label: "Tag background", value: card.tagBg, onChange: v => updateCard(i, { tagBg: v }) }), _jsx(ColorRow, { label: "Card background", value: card.cardBg, onChange: v => updateCard(i, { cardBg: v }) })] }), _jsx(RichTextField, { label: "Eyebrow badge", value: asTV(card.eyebrow, 'pcv2Eyebrow'), defaultKey: "pcv2Eyebrow", onChange: v => updateCard(i, { eyebrow: v }) }), _jsx(RichTextField, { label: "Title", value: asTV(card.title, 'pcv2Title'), defaultKey: "pcv2Title", onChange: v => updateCard(i, { title: v }) }), _jsx(RichTextField, { label: "Description", value: asTV(card.desc, 'pcv2Desc'), defaultKey: "pcv2Desc", onChange: v => updateCard(i, { desc: v }), multiline: true }), _jsx(Field, { label: "Feature chips (one per line)", children: _jsx("textarea", { className: "input", rows: 3, value: card.chips, placeholder: 'Full syllabus videos\nPractice kit\nMock exam', onChange: e => updateCard(i, { chips: e.target.value }) }) }), _jsx(RichTextField, { label: "Meta line", value: asTV(card.meta, 'pcv2Meta'), defaultKey: "pcv2Meta", onChange: v => updateCard(i, { meta: v }) }), _jsx(RichTextField, { label: "CTA text", value: asTV(card.cta, 'pcv2Cta'), defaultKey: "pcv2Cta", onChange: v => updateCard(i, { cta: v }) }), _jsx(Field, { label: "Card URL", children: _jsx("input", { className: "input", value: card.url, placeholder: "https://\u2026", onChange: e => updateCard(i, { url: e.target.value }) }) })] }, card.id || i))) }), _jsx("button", { onClick: addCard, className: "btn-ghost text-xs w-full mb-4", children: "+ Add card" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
