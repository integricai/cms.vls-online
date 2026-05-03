import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { generateFeatureCardsV3Html } from './generateHtml';
import Field from '../../components/Field';
function makeTag() { return { code: '', name: '' }; }
function makeCard() { return { headerBg: '#204280', number: '01', title: '', subtitle: '', tags: [] }; }
function makeDefault() {
    return { bg: '#f8faff', padTop: 60, padBottom: 60, padLeft: 80, padRight: 80, cols: 3, gap: 24, eyebrow: '', eyebrowColor: '#4a90d9', headingText: '', headingColor: '#1a1a1a', descText: '', descColor: '#4a5568', cards: [] };
}
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
export default function FeatureCardsV3Screen() {
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
        api.get('/content/vls-feature-cards-3')
            .then(row => {
            const raw = row?.data;
            let comps = [];
            if (raw?.components) {
                comps = raw.components;
            }
            else if (raw?.sections) {
                comps = raw.sections.map((s, i) => ({
                    id: s.id || `fc3-${i}`,
                    name: s.name || `Section ${i + 1}`,
                    data: { bg: s.bg ?? '#f8faff', padTop: s.padTop ?? 60, padBottom: s.padBottom ?? 60, padLeft: s.padLeft ?? 80, padRight: s.padRight ?? 80, cols: s.cols ?? 3, gap: s.gap ?? 24, eyebrow: s.eyebrow ?? '', eyebrowColor: s.eyebrowColor ?? '#4a90d9', headingText: s.headingText ?? '', headingColor: s.headingColor ?? '#1a1a1a', descText: s.descText ?? '', descColor: s.descColor ?? '#4a5568', cards: s.cards || [] },
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
                    id = `fc3-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `fc3-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-feature-cards-3', { components: comps });
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
        await api.put('/content/vls-feature-cards-3', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function updateCard(i, patch) { const a = [...state.cards]; a[i] = { ...a[i], ...patch }; upd({ cards: a }); }
    function addCard() { upd({ cards: [...state.cards, makeCard()] }); }
    function removeCard(i) { upd({ cards: state.cards.filter((_, idx) => idx !== i) }); }
    function updateTag(ci, ti, patch) { const cards = [...state.cards]; const tags = [...cards[ci].tags]; tags[ti] = { ...tags[ti], ...patch }; cards[ci] = { ...cards[ci], tags }; upd({ cards }); }
    function addTag(ci) { const cards = [...state.cards]; cards[ci] = { ...cards[ci], tags: [...cards[ci].tags, makeTag()] }; upd({ cards }); }
    function removeTag(ci, ti) { const cards = [...state.cards]; cards[ci] = { ...cards[ci], tags: cards[ci].tags.filter((_, idx) => idx !== ti) }; upd({ cards }); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Feature Card v3" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Cards with coloured header, number badge, and tag rows" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(generateFeatureCardsV3Html(state)); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. Program Overview Cards", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Layout" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Columns", children: _jsxs("select", { className: "input", value: state.cols, onChange: e => upd({ cols: Number(e.target.value) }), children: [_jsx("option", { value: 2, children: "2 columns" }), _jsx("option", { value: 3, children: "3 columns" }), _jsx("option", { value: 4, children: "4 columns" })] }) }), _jsx(Field, { label: "Gap (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 80, value: state.gap, onChange: e => upd({ gap: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad top (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padTop, onChange: e => upd({ padTop: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad bottom (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padBottom, onChange: e => upd({ padBottom: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padLeft, onChange: e => upd({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padRight, onChange: e => upd({ padRight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Section Header (optional)" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: state.eyebrow, placeholder: "FEATURED PROGRAMS", onChange: e => upd({ eyebrow: e.target.value }) }) }), _jsx(ColorRow, { label: "Eyebrow colour", value: state.eyebrowColor, onChange: v => upd({ eyebrowColor: v }) }), _jsx(Field, { label: "Heading text", children: _jsx("input", { className: "input", value: state.headingText, placeholder: "Our programs", onChange: e => upd({ headingText: e.target.value }) }) }), _jsx(ColorRow, { label: "Heading colour", value: state.headingColor, onChange: v => upd({ headingColor: v }) })] }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input", rows: 2, value: state.descText, placeholder: "Brief description\u2026", onChange: e => upd({ descText: e.target.value }) }) }), _jsx(ColorRow, { label: "Description colour", value: state.descColor, onChange: v => upd({ descColor: v }) }), _jsx("p", { className: "section-label", children: "Cards" }), _jsx("div", { className: "space-y-3 mb-2", children: state.cards.map((card, ci) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeCard(ci), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(ColorRow, { label: "Header background", value: card.headerBg, onChange: v => updateCard(ci, { headerBg: v }) }), _jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx(Field, { label: "Number badge", children: _jsx("input", { className: "input", value: card.number, placeholder: "01", onChange: e => updateCard(ci, { number: e.target.value }) }) }), _jsx(Field, { label: "Title", className: "col-span-2", children: _jsx("input", { className: "input", value: card.title, placeholder: "Card title", onChange: e => updateCard(ci, { title: e.target.value }) }) })] }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { className: "input", value: card.subtitle, placeholder: "Short subtitle", onChange: e => updateCard(ci, { subtitle: e.target.value }) }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Tags" }), _jsx("div", { className: "space-y-1.5 mb-1", children: card.tags.map((tag, ti) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input w-24 shrink-0", value: tag.code, placeholder: "BT", onChange: e => updateTag(ci, ti, { code: e.target.value }) }), _jsx("input", { className: "input flex-1", value: tag.name, placeholder: "Business and Technology", onChange: e => updateTag(ci, ti, { name: e.target.value }) }), _jsx("button", { onClick: () => removeTag(ci, ti), className: "btn-danger", children: "\u2715" })] }, ti))) }), _jsx("button", { onClick: () => addTag(ci), className: "btn-ghost text-xs w-full", children: "+ Add tag" })] }, ci))) }), _jsx("button", { onClick: addCard, className: "btn-ghost text-xs w-full mb-4", children: "+ Add card" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
