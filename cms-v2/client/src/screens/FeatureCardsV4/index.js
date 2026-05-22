import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateFeatureCardsV4Html } from './generateHtml';
function makeCard() {
    return {
        badge: 'F2 · MA',
        badgeBg: '#d8efff',
        badgeTc: '#0967b1',
        title: 'Management Accounting',
        subtitle: 'Applied Knowledge',
        ctaText: 'View →',
        ctaUrl: '',
    };
}
function makeDefault() {
    return {
        bg: '#f3f6fc',
        padTop: 36,
        padBottom: 42,
        padLeft: 30,
        padRight: 30,
        maxWidth: 1180,
        cols: 4,
        gap: 12,
        eyebrow: 'OTHER MOCK EXAMS',
        eyebrowTc: '#8a919b',
        heading: 'Explore other ACCA mock exams',
        headingTc: '#07172d',
        cardBg: '#ffffff',
        cardBorder: '#dfe6f0',
        cardRadius: 8,
        titleTc: '#07172d',
        subtitleTc: '#7b8490',
        ctaTc: '#0967b1',
        cards: [
            makeCard(),
            { badge: 'F3 · FA', badgeBg: '#d8f6e7', badgeTc: '#08724f', title: 'Financial Accounting', subtitle: 'Applied Knowledge', ctaText: 'View →', ctaUrl: '' },
            { badge: 'F5 · PM', badgeBg: '#ebe3ff', badgeTc: '#5b36d6', title: 'Performance Management', subtitle: 'Applied Skills', ctaText: 'View →', ctaUrl: '' },
            { badge: 'F7 · FR', badgeBg: '#fff0d6', badgeTc: '#9a5a00', title: 'Financial Reporting', subtitle: 'Applied Skills', ctaText: 'View →', ctaUrl: '' },
        ],
    };
}
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => onChange(e.target.value) })] }) }));
}
function normalizeState(data) {
    const base = makeDefault();
    return {
        ...base,
        ...data,
        cards: (data?.cards?.length ? data.cards : base.cards).map(card => ({
            ...makeCard(),
            ...card,
        })),
    };
}
export default function FeatureCardsV4Screen() {
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
        api.get('/content/vls-feature-cards-4')
            .then(row => {
            const comps = (row?.data?.components || []).map(c => ({ ...c, data: normalizeState(c.data) }));
            setComponents(comps);
            if (comps.length > 0) {
                setActiveId(comps[0].id);
                setName(comps[0].name);
                setState(comps[0].data);
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
        const c = components.find(item => item.id === id);
        if (!c)
            return;
        setActiveId(c.id);
        setName(c.name);
        setState(normalizeState(c.data));
        setSaved(false);
    }
    function newComponent() {
        setActiveId(null);
        setName('');
        setState(makeDefault());
        setSaved(false);
    }
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
                    id = `fc4-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `fc4-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-feature-cards-4', { components: comps });
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
        await api.put('/content/vls-feature-cards-4', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function updateCard(index, patch) {
        const cards = [...state.cards];
        cards[index] = { ...cards[index], ...patch };
        upd({ cards });
    }
    function addCard() {
        upd({ cards: [...state.cards, makeCard()] });
    }
    function removeCard(index) {
        upd({ cards: state.cards.filter((_, i) => i !== index) });
    }
    function generate() {
        setPreviewHtml(wrapGeneratedHtml('Feature Cards V4', generateFeatureCardsV4Html(state)));
        setActiveTab('preview');
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Feature Cards v4" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Compact mock exam cards with badges and view links" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. Other Mock Exams", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Layout" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Max width (px)", children: _jsx("input", { type: "number", className: "input", min: 320, max: 1600, value: state.maxWidth, onChange: e => upd({ maxWidth: Number(e.target.value) }) }) }), _jsx(Field, { label: "Columns", children: _jsxs("select", { className: "input", value: state.cols, onChange: e => upd({ cols: Number(e.target.value) }), children: [_jsx("option", { value: 2, children: "2 columns" }), _jsx("option", { value: 3, children: "3 columns" }), _jsx("option", { value: 4, children: "4 columns" }), _jsx("option", { value: 5, children: "5 columns" })] }) }), _jsx(Field, { label: "Gap (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 60, value: state.gap, onChange: e => upd({ gap: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad top (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 160, value: state.padTop, onChange: e => upd({ padTop: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad bottom (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 160, value: state.padBottom, onChange: e => upd({ padBottom: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 160, value: state.padLeft, onChange: e => upd({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 160, value: state.padRight, onChange: e => upd({ padRight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Header" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Eyebrow", children: _jsx("input", { className: "input", value: state.eyebrow, onChange: e => upd({ eyebrow: e.target.value }) }) }), _jsx(ColorRow, { label: "Eyebrow colour", value: state.eyebrowTc, onChange: v => upd({ eyebrowTc: v }) }), _jsx(Field, { label: "Heading", className: "col-span-2", children: _jsx("input", { className: "input", value: state.heading, onChange: e => upd({ heading: e.target.value }) }) }), _jsx(ColorRow, { label: "Heading colour", value: state.headingTc, onChange: v => upd({ headingTc: v }) })] }), _jsx("p", { className: "section-label", children: "Cards Style" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Card background", value: state.cardBg, onChange: v => upd({ cardBg: v }) }), _jsx(ColorRow, { label: "Card border", value: state.cardBorder, onChange: v => upd({ cardBorder: v }) }), _jsx(Field, { label: "Radius (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 30, value: state.cardRadius, onChange: e => upd({ cardRadius: Number(e.target.value) }) }) }), _jsx(ColorRow, { label: "Title colour", value: state.titleTc, onChange: v => upd({ titleTc: v }) }), _jsx(ColorRow, { label: "Subtitle colour", value: state.subtitleTc, onChange: v => upd({ subtitleTc: v }) }), _jsx(ColorRow, { label: "CTA colour", value: state.ctaTc, onChange: v => upd({ ctaTc: v }) })] }), _jsx("p", { className: "section-label", children: "Cards" }), _jsx("div", { className: "space-y-3 mb-2", children: state.cards.map((card, index) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeCard(index), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 pr-9", children: [_jsx(Field, { label: "Badge", children: _jsx("input", { className: "input", value: card.badge, onChange: e => updateCard(index, { badge: e.target.value }) }) }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: card.title, onChange: e => updateCard(index, { title: e.target.value }) }) }), _jsx(ColorRow, { label: "Badge bg", value: card.badgeBg, onChange: v => updateCard(index, { badgeBg: v }) }), _jsx(ColorRow, { label: "Badge text", value: card.badgeTc, onChange: v => updateCard(index, { badgeTc: v }) }), _jsx(Field, { label: "Subtitle", children: _jsx("input", { className: "input", value: card.subtitle, onChange: e => updateCard(index, { subtitle: e.target.value }) }) }), _jsx(Field, { label: "CTA text", children: _jsx("input", { className: "input", value: card.ctaText, onChange: e => updateCard(index, { ctaText: e.target.value }) }) }), _jsx(Field, { label: "CTA URL", className: "col-span-2", children: _jsx("input", { className: "input", value: card.ctaUrl, placeholder: "/mock-exams/acca-ma", onChange: e => updateCard(index, { ctaUrl: e.target.value }) }) })] })] }, index))) }), _jsx("button", { onClick: addCard, className: "btn-ghost text-xs w-full mb-4", children: "+ Add card" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
