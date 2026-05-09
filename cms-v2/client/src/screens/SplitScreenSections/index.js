import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { makeLeftGeneric, makeLeftHero, makeRightPane } from './defaults';
import { generateLeftHeroHtml, generatePanelHtml } from './generateHtml';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
const CONFIG = {
    'left-hero': {
        title: 'Left Hero Section',
        key: 'vls-page-left-hero-components',
        dataKey: 'components',
        mode: 'hero',
    },
    'left-generic': {
        title: 'Left Generic Section',
        key: 'vls-left-generic-section',
        dataKey: 'sections',
        mode: 'panel',
        panelMode: 'left',
    },
    'right-pane': {
        title: 'Right Pane Section',
        key: 'vls-right-pane-section',
        dataKey: 'sections',
        mode: 'panel',
        panelMode: 'right',
    },
};
function ColorInput({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "h-9 w-10 shrink-0 rounded border border-slate-200 p-0.5" }), _jsx("input", { className: "input", value: value, onChange: e => onChange(e.target.value) })] }) }));
}
function NumberInput({ label, value, min = 0, max = 240, onChange }) {
    return (_jsx(Field, { label: label, children: _jsx("input", { type: "number", className: "input", min: min, max: max, value: value, onChange: e => onChange(Number(e.target.value)) }) }));
}
function LinesField({ label, value, onChange, placeholder }) {
    return (_jsx(Field, { label: label, hint: "one per line", children: _jsx("textarea", { className: "input min-h-24 resize-y", value: (value || []).join('\n'), placeholder: placeholder, onChange: e => onChange(e.target.value.split('\n')) }) }));
}
function OutputPane({ html, tab, setTab }) {
    return (_jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(t => (_jsx("button", { onClick: () => setTab(t), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium transition ${tab === t ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: t === 'html' ? 'HTML' : 'Preview' }, t))) }), tab === 'preview' ? (_jsx("iframe", { title: "Split screen preview", srcDoc: html ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${html}</body></html>` : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview this section.</p>', className: "h-full w-full flex-1 border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(html), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300", children: html || '// Generate HTML first' })] }))] }));
}
function SavedSelector({ title, items, activeId, name, saving, saved, onSelect, onNew, onDuplicate, onDelete, onName, onSave, onGenerate, }) {
    return (_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: title }), _jsx("p", { className: "mt-0.5 text-xs text-slate-400", children: "Page Builder / Split Screen" }), _jsxs("div", { className: "mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Items" }), _jsxs("div", { className: "mb-2 flex gap-2", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => onSelect(e.target.value), children: [_jsx("option", { value: "", children: "- select -" }), items.map(item => _jsx("option", { value: item.id, children: item.name }, item.id))] }), _jsx("button", { onClick: onNew, className: "btn-ghost text-xs", children: "+ New" }), activeId && _jsx("button", { onClick: onDuplicate, className: "btn-ghost text-xs", children: "Duplicate" }), activeId && _jsx("button", { onClick: onDelete, className: "btn-danger text-xs", children: "Delete" })] }), _jsx(Field, { label: "Name", children: _jsx("input", { className: "input", value: name, onChange: e => onName(e.target.value), placeholder: "Saved item name" }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onSave, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving...' : saved ? 'Saved' : 'Save' }), _jsx("button", { onClick: onGenerate, className: "btn-success flex-1 justify-center", children: "Generate HTML" })] })] })] }));
}
function addId(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}
function HeroEditor() {
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeLeftHero());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [html, setHtml] = useState('');
    const [tab, setTab] = useState('preview');
    useEffect(() => {
        api.get('/content/vls-page-left-hero-components')
            .then(row => {
            const next = (row?.data?.components || []).map(c => ({ ...c, data: { ...makeLeftHero(), ...(c.data || {}) } }));
            setItems(next);
            if (next[0]) {
                setActiveId(next[0].id);
                setName(next[0].name);
                setState(next[0].data);
            }
        })
            .finally(() => setLoading(false));
    }, []);
    function patch(p) {
        setState(prev => ({ ...prev, ...p }));
        setSaved(false);
    }
    function updatePathway(index, partial) {
        const next = [...state.pathwayItems];
        next[index] = { ...next[index], ...partial };
        patch({ pathwayItems: next });
    }
    function updateStat(index, partial) {
        const next = [...state.statsItems];
        next[index] = { ...next[index], ...partial };
        patch({ statsItems: next });
    }
    function updateTrust(index, partial) {
        const next = [...state.trustItems];
        next[index] = { ...next[index], ...partial };
        patch({ trustItems: next });
    }
    function load(id) {
        if (!id)
            return;
        const item = items.find(i => i.id === id);
        if (!item)
            return;
        setActiveId(item.id);
        setName(item.name);
        setState({ ...makeLeftHero(), ...(item.data || {}) });
        setSaved(false);
    }
    function newItem() {
        setActiveId(null);
        setName('');
        setState(makeLeftHero());
        setSaved(false);
    }
    function duplicate() {
        const id = addId('plh');
        const nextName = name ? `Copy of ${name}` : 'Copy of Left Hero Section';
        const next = [...items, { id, name: nextName, data: structuredClone(state) }];
        setItems(next);
        setActiveId(id);
        setName(nextName);
        setSaved(false);
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a name before saving.');
            return;
        }
        setSaving(true);
        const id = activeId || addId('plh');
        const next = activeId
            ? items.map(item => item.id === id ? { id, name, data: state } : item)
            : [...items, { id, name, data: state }];
        if (!next.some(item => item.id === id))
            next.push({ id, name, data: state });
        await api.put('/content/vls-page-left-hero-components', { components: next });
        setItems(next);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete this left hero section?'))
            return;
        const next = items.filter(item => item.id !== activeId);
        await api.put('/content/vls-page-left-hero-components', { components: next });
        setItems(next);
        newItem();
    }
    if (loading)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsx(SavedSelector, { title: "Left Hero Section", items: items, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: newItem, onDuplicate: duplicate, onDelete: del, onName: setName, onSave: save, onGenerate: () => { setHtml(wrapGeneratedHtml('Left Hero', generateLeftHeroHtml(state))); setTab('preview'); } }), _jsxs("div", { className: "px-5 py-4", children: [_jsx("p", { className: "section-label mt-0", children: "Layout" }), _jsx(ColorInput, { label: "Background", value: state.bg, onChange: bg => patch({ bg }) }), _jsxs("div", { className: "grid grid-cols-4 gap-2", children: [_jsx(NumberInput, { label: "Top", value: state.padTop, onChange: padTop => patch({ padTop }) }), _jsx(NumberInput, { label: "Bottom", value: state.padBot, onChange: padBot => patch({ padBot }) }), _jsx(NumberInput, { label: "Left", value: state.padLeft, onChange: padLeft => patch({ padLeft }) }), _jsx(NumberInput, { label: "Right", value: state.padRight, onChange: padRight => patch({ padRight }) })] }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(Field, { label: "Breadcrumb", children: _jsx("input", { className: "input", value: state.breadcrumb, onChange: e => patch({ breadcrumb: e.target.value }) }) }), _jsx(RichTextField, { label: "Heading", value: normalize(state.heading, 'plhHeading'), defaultKey: "plhHeading", onChange: heading => patch({ heading }) }), _jsx(Field, { label: "Heading accent", children: _jsx("input", { className: "input", value: state.headingAccent, onChange: e => patch({ headingAccent: e.target.value }) }) }), _jsx(LinesField, { label: "Eyebrow labels", value: state.eyebrowLabels, onChange: eyebrowLabels => patch({ eyebrowLabels }) }), _jsx(LinesField, { label: "Descriptions", value: state.descs, onChange: descs => patch({ descs }) }), _jsx("p", { className: "section-label", children: "Calls to Action" }), _jsx(Field, { label: "Primary CTA title", children: _jsx("input", { className: "input", value: state.primaryCta, onChange: e => patch({ primaryCta: e.target.value }) }) }), _jsx(Field, { label: "Primary CTA URL", children: _jsx("input", { className: "input", value: state.primaryCtaUrl, onChange: e => patch({ primaryCtaUrl: e.target.value }) }) }), _jsx(Field, { label: "Primary CTA scroll target", hint: "CSS selector or class \u2014 overrides URL, e.g. .section-faq or #my-id", children: _jsx("input", { className: "input", value: state.primaryCtaScroll, placeholder: ".section-name or #section-id", onChange: e => patch({ primaryCtaScroll: e.target.value }) }) }), _jsx(Field, { label: "Secondary CTA title", children: _jsx("input", { className: "input", value: state.secondaryCta, onChange: e => patch({ secondaryCta: e.target.value }) }) }), _jsx(Field, { label: "Secondary CTA URL", children: _jsx("input", { className: "input", value: state.secondaryCtaUrl, onChange: e => patch({ secondaryCtaUrl: e.target.value }) }) }), _jsx(Field, { label: "Secondary CTA scroll target", hint: "CSS selector or class \u2014 overrides URL, e.g. .section-faq or #my-id", children: _jsx("input", { className: "input", value: state.secondaryCtaScroll, placeholder: ".section-name or #section-id", onChange: e => patch({ secondaryCtaScroll: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Pathway" }), state.pathwayItems.map((item, i) => (_jsxs("div", { className: "mb-2 grid grid-cols-[70px_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2", children: [_jsx("input", { className: "input", value: item.icon, placeholder: "icon", onChange: e => updatePathway(i, { icon: e.target.value }) }), _jsx("input", { className: "input", value: item.text, placeholder: "Text", onChange: e => updatePathway(i, { text: e.target.value }) }), _jsx("button", { className: "btn-danger", onClick: () => patch({ pathwayItems: state.pathwayItems.filter((_, idx) => idx !== i) }), children: "Remove" })] }, i))), _jsx("button", { className: "btn-ghost mb-3 w-full justify-center", onClick: () => patch({ pathwayItems: [...state.pathwayItems, { icon: '', text: '' }] }), children: "+ Add pathway item" }), _jsx("p", { className: "section-label", children: "Stats" }), state.statsItems.map((item, i) => (_jsxs("div", { className: "mb-2 grid grid-cols-[1fr_1fr_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2", children: [_jsx("input", { className: "input", value: item.value, placeholder: "Value", onChange: e => updateStat(i, { value: e.target.value }) }), _jsx("input", { className: "input", value: item.label1, placeholder: "Label 1", onChange: e => updateStat(i, { label1: e.target.value }) }), _jsx("input", { className: "input", value: item.label2, placeholder: "Label 2", onChange: e => updateStat(i, { label2: e.target.value }) }), _jsx("button", { className: "btn-danger", onClick: () => patch({ statsItems: state.statsItems.filter((_, idx) => idx !== i) }), children: "Remove" })] }, i))), _jsx("button", { className: "btn-ghost mb-3 w-full justify-center", onClick: () => patch({ statsItems: [...state.statsItems, { value: '', label1: '', label2: '' }] }), children: "+ Add stat" }), _jsx("p", { className: "section-label", children: "Trust Strip" }), state.trustItems.map((item, i) => (_jsxs("div", { className: "mb-2 grid grid-cols-[70px_1fr_auto] gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2", children: [_jsx("input", { className: "input", value: item.icon, placeholder: "icon", onChange: e => updateTrust(i, { icon: e.target.value }) }), _jsx("input", { className: "input", value: item.text, placeholder: "Text", onChange: e => updateTrust(i, { text: e.target.value }) }), _jsx("button", { className: "btn-danger", onClick: () => patch({ trustItems: state.trustItems.filter((_, idx) => idx !== i) }), children: "Remove" })] }, i))), _jsx("button", { className: "btn-ghost mb-6 w-full justify-center", onClick: () => patch({ trustItems: [...state.trustItems, { icon: '', text: '' }] }), children: "+ Add trust item" })] })] }), _jsx(OutputPane, { html: html, tab: tab, setTab: setTab })] }));
}
function CardEditor({ card, mode, onChange, onRemove }) {
    const titleKey = mode === 'left' ? 'lgsCardTitle' : 'rpsCardTitle';
    const descKey = mode === 'left' ? 'lgsCardDesc' : 'rpsCardDesc';
    return (_jsxs("div", { className: "mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center gap-2", children: [_jsxs("select", { className: "input", value: card.type || 'card', onChange: e => onChange({ type: e.target.value }), children: [_jsx("option", { value: "card", children: "Card" }), _jsx("option", { value: "card-image", children: "Card + Image" }), _jsx("option", { value: "image", children: "Image" })] }), _jsx("button", { className: "btn-danger shrink-0", onClick: onRemove, children: "Remove" })] }), mode === 'left' && (_jsx(Field, { label: "Row width", children: _jsxs("select", { className: "input", value: card.halfWidth ? 'half' : 'full', onChange: e => onChange({ halfWidth: e.target.value === 'half' }), children: [_jsx("option", { value: "full", children: "Full width (1 per row)" }), _jsx("option", { value: "half", children: "Half width (2 per row)" })] }) })), card.type === 'image' ? (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Image URL", children: _jsx("input", { className: "input", value: card.imageUrl || '', onChange: e => onChange({ imageUrl: e.target.value }) }) }), _jsx(Field, { label: "Alt text", children: _jsx("input", { className: "input", value: card.imageAlt || '', onChange: e => onChange({ imageAlt: e.target.value }) }) })] })) : (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Card background", value: card.cardBg || (mode === 'left' ? '#f8f9fa' : '#1a2d4a'), onChange: cardBg => onChange({ cardBg }) }), _jsx(ColorInput, { label: "Card border", value: card.cardBorder || (mode === 'left' ? '#e5e7eb' : '#1e3a5f'), onChange: cardBorder => onChange({ cardBorder }) })] }), card.type === 'card-image' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Image URL", children: _jsx("input", { className: "input", value: card.imageUrl || '', onChange: e => onChange({ imageUrl: e.target.value }) }) }), _jsx(Field, { label: "Alt text", children: _jsx("input", { className: "input", value: card.imageAlt || '', onChange: e => onChange({ imageAlt: e.target.value }) }) })] })), card.type !== 'card-image' && (_jsxs("div", { className: "grid grid-cols-3 gap-2", children: [_jsx(Field, { label: "Icon", children: _jsx("input", { className: "input", value: card.icon || '', onChange: e => onChange({ icon: e.target.value }) }) }), _jsx(ColorInput, { label: "Icon bg", value: card.iconBg || (mode === 'left' ? '#e8edf5' : '#1e3a5f'), onChange: iconBg => onChange({ iconBg }) }), _jsx(ColorInput, { label: "Icon color", value: card.iconColor || (mode === 'left' ? '#204280' : '#f59e0b'), onChange: iconColor => onChange({ iconColor }) })] })), _jsx(RichTextField, { label: "Title", value: normalize(card.title, titleKey), defaultKey: titleKey, onChange: title => onChange({ title }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: normalize(card.desc, descKey), defaultKey: descKey, onChange: desc => onChange({ desc }) }), card.type === 'card-image' && (_jsxs(_Fragment, { children: [_jsx(RichTextField, { label: "CTA text", value: normalize(card.ctaText, mode === 'left' ? 'lgsCardCta' : 'rpsCardCta'), defaultKey: mode === 'left' ? 'lgsCardCta' : 'rpsCardCta', onChange: ctaText => onChange({ ctaText }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: card.ctaUrl || '', onChange: e => onChange({ ctaUrl: e.target.value }) }) })] })), mode === 'right' && card.type !== 'card-image' && (_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Stat value", children: _jsx("input", { className: "input", value: card.statValue || '', onChange: e => onChange({ statValue: e.target.value }) }) }), _jsx(Field, { label: "Stat label", children: _jsx("input", { className: "input", value: card.statLabel || '', onChange: e => onChange({ statLabel: e.target.value }) }) })] }))] }))] }));
}
function PanelEditor({ type }) {
    const config = CONFIG[type];
    const mode = config.panelMode;
    const [items, setItems] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(() => mode === 'left' ? makeLeftGeneric() : makeRightPane());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [html, setHtml] = useState('');
    const [tab, setTab] = useState('preview');
    const blank = useMemo(() => mode === 'left' ? makeLeftGeneric(items.length + 1) : makeRightPane(items.length + 1), [items.length, mode]);
    useEffect(() => {
        api.get(`/content/${config.key}`)
            .then(row => {
            const next = (row?.data?.sections || []).map(s => ({
                ...blank,
                ...s,
                imageBoxWidth: Number(s.imageBoxWidth ?? blank.imageBoxWidth ?? 100),
                imageBoxHeight: Number(s.imageBoxHeight ?? blank.imageBoxHeight ?? 180),
                cards: (s.cards || []).map(card => ({ ...card, type: card.type || 'card' })),
            }));
            setItems(next);
            if (next[0]) {
                setActiveId(next[0].id);
                setName(next[0].name);
                setState(next[0]);
            }
        })
            .finally(() => setLoading(false));
    }, [blank, config.key]);
    function patch(p) {
        setState(prev => ({ ...prev, ...p }));
        setSaved(false);
    }
    function patchCard(index, partial) {
        const next = [...(state.cards || [])];
        next[index] = { ...next[index], ...partial };
        patch({ cards: next });
    }
    function load(id) {
        const item = items.find(i => i.id === id);
        if (!item)
            return;
        setActiveId(item.id);
        setName(item.name);
        setState(item);
        setSaved(false);
    }
    function newItem() {
        const next = mode === 'left' ? makeLeftGeneric(items.length + 1) : makeRightPane(items.length + 1);
        setActiveId(null);
        setName(next.name);
        setState(next);
        setSaved(false);
    }
    function duplicate() {
        const id = addId(mode === 'left' ? 'lgs' : 'rps');
        const nextName = name ? `Copy of ${name}` : `Copy of ${config.title}`;
        const nextItem = { ...structuredClone(state), id, name: nextName };
        setItems(prev => [...prev, nextItem]);
        setActiveId(id);
        setName(nextName);
        setState(nextItem);
        setSaved(false);
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a name before saving.');
            return;
        }
        setSaving(true);
        const id = activeId || state.id || addId(mode === 'left' ? 'lgs' : 'rps');
        const item = { ...state, id, name };
        const next = activeId ? items.map(s => s.id === id ? item : s) : [...items, item];
        if (!next.some(s => s.id === id))
            next.push(item);
        await api.put(`/content/${config.key}`, { sections: next });
        setItems(next);
        setActiveId(id);
        setState(item);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm(`Delete this ${config.title.toLowerCase()}?`))
            return;
        const next = items.filter(item => item.id !== activeId);
        await api.put(`/content/${config.key}`, { sections: next });
        setItems(next);
        newItem();
    }
    if (loading)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[500px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsx(SavedSelector, { title: config.title, items: items, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: newItem, onDuplicate: duplicate, onDelete: del, onName: setName, onSave: save, onGenerate: () => { setHtml(wrapGeneratedHtml(config.title, generatePanelHtml(state, mode))); setTab('preview'); } }), _jsxs("div", { className: "px-5 py-4", children: [_jsx("p", { className: "section-label mt-0", children: "Section" }), _jsx(ColorInput, { label: "Background", value: state.bg, onChange: bg => patch({ bg }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(NumberInput, { label: "Image width (%)", value: state.imageBoxWidth ?? 100, min: 10, max: 100, onChange: imageBoxWidth => patch({ imageBoxWidth }) }), _jsx(NumberInput, { label: "Image height (px)", value: state.imageBoxHeight ?? 180, min: 40, max: 800, onChange: imageBoxHeight => patch({ imageBoxHeight }) })] }), _jsx(RichTextField, { label: "Eyebrow", value: normalize(state.eyebrow, mode === 'left' ? 'lgsEyebrow' : 'rpsEyebrow'), defaultKey: mode === 'left' ? 'lgsEyebrow' : 'rpsEyebrow', onChange: (eyebrow) => patch({ eyebrow }) }), _jsx(RichTextField, { label: "Heading", value: normalize(state.heading, mode === 'left' ? 'lgsHeading' : 'rpsHeading'), defaultKey: mode === 'left' ? 'lgsHeading' : 'rpsHeading', onChange: (heading) => patch({ heading }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: normalize(state.desc, mode === 'left' ? 'lgsDesc' : 'rpsDesc'), defaultKey: mode === 'left' ? 'lgsDesc' : 'rpsDesc', onChange: (desc) => patch({ desc }) }), _jsx("p", { className: "section-label", children: "Cards and Blocks" }), (state.cards || []).map((card, i) => (_jsx(CardEditor, { card: card, mode: mode, onChange: partial => patchCard(i, partial), onRemove: () => patch({ cards: state.cards.filter((_, idx) => idx !== i) }) }, i))), _jsx("button", { className: "btn-ghost mb-6 w-full justify-center", onClick: () => patch({ cards: [...(state.cards || []), { type: 'card', cardBg: mode === 'left' ? '#f8f9fa' : '#1a2d4a', cardBorder: mode === 'left' ? '#e5e7eb' : '#1e3a5f', title: normalize('', mode === 'left' ? 'lgsCardTitle' : 'rpsCardTitle'), desc: normalize('', mode === 'left' ? 'lgsCardDesc' : 'rpsCardDesc') }] }), children: "+ Add card" })] })] }), _jsx(OutputPane, { html: html, tab: tab, setTab: setTab })] }));
}
export default function SplitScreenSections() {
    const params = useParams();
    const type = params.type;
    if (!type || !(type in CONFIG))
        return _jsx(Navigate, { to: "/split-screen/left-hero", replace: true });
    if (type === 'left-hero')
        return _jsx(HeroEditor, {});
    return _jsx(PanelEditor, { type: type });
}
