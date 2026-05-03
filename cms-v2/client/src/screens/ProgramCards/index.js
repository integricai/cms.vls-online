import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateProgramCardsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
let _cardCounter = 0;
function makeCard() {
    return { id: `pc-${Date.now().toString(36)}-${++_cardCounter}`, title: normalize('', 'programCardTitle'), desc: normalize('', 'programDesc'), url: '#', cta: normalize('View Course →', 'programCta'), cardBg: '#204280', badge: '', rating: '', hours: '' };
}
function makeTopic() {
    return { id: `pt-${Date.now().toString(36)}`, title: normalize('New Topic', 'programCardTitle'), topicColor: '#204280', badgeBg: '#ffffff', badgeOpacity: 0.22, badgeTextStyle: normalize('', 'programBadge'), cards: [] };
}
function cloneTopic(topic) {
    return {
        ...topic,
        id: `pt-${Date.now().toString(36)}-copy`,
        cards: topic.cards.map(c => ({ ...c, id: `pc-${Date.now().toString(36)}-${++_cardCounter}` })),
    };
}
function makeDefault() { return { topics: [] }; }
function asTV(v, key) { return normalize(v, key); }
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function FontFormatter({ label, value, onChange }) {
    const td = normalize(value, 'programBadge');
    function patch(partial) {
        onChange({ ...td, ...partial });
    }
    return (_jsxs("div", { className: "mb-3", children: [_jsx("label", { className: "field-label", children: label }), _jsxs("div", { className: "flex flex-wrap gap-1.5 rounded-lg border border-slate-100 bg-slate-50 p-1.5", children: [_jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Size" }), _jsx("input", { type: "number", value: td.size, min: 8, max: 40, onChange: e => patch({ size: Number(e.target.value) }), className: "w-14 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Color" }), _jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(td.color) ? td.color : '#ffffff', onChange: e => patch({ color: e.target.value }), className: "h-6 w-8 cursor-pointer rounded border border-slate-200 p-0" }), _jsx("input", { type: "text", value: td.color, maxLength: 7, onChange: e => patch({ color: e.target.value }), className: "w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand" })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Weight" }), _jsxs("select", { value: td.weight, onChange: e => patch({ weight: e.target.value }), className: "rounded border border-slate-200 bg-white px-1 py-0.5 text-xs outline-none focus:border-brand", children: [_jsx("option", { value: "400", children: "Regular" }), _jsx("option", { value: "500", children: "Medium" }), _jsx("option", { value: "600", children: "Semi-bold" }), _jsx("option", { value: "700", children: "Bold" })] })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("span", { className: "text-[10px] text-slate-400", children: "Spacing" }), _jsx("input", { type: "number", value: td.letterSpacing, min: 0, max: 0.5, step: 0.01, onChange: e => patch({ letterSpacing: Number(e.target.value) }), className: "w-16 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-xs outline-none focus:border-brand" })] })] })] }));
}
export default function ProgramCardsScreen() {
    const [components, setComponents] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const [expandedTopics, setExpandedTopics] = useState(new Set());
    const [copyStatus, setCopyStatus] = useState('');
    const [copyingTopicId, setCopyingTopicId] = useState(null);
    useEffect(() => {
        api.get('/content/vls-programs')
            .then(row => {
            const raw = row?.data;
            let comps = [];
            if (raw?.components) {
                comps = raw.components;
            }
            else if (raw?.sections) {
                comps = raw.sections.map((s, i) => ({
                    id: s.id || `prog-${i}`,
                    name: s.name || `Section ${i + 1}`,
                    data: { topics: s.topics || [] },
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
    async function saveComps(comps) {
        await api.put('/content/vls-programs', { components: comps });
        setComponents(comps);
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
                    id = `prog-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `prog-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await saveComps(comps);
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
        await saveComps(comps);
        newComponent();
    }
    function updateTopic(ti, patch) { const a = [...state.topics]; a[ti] = { ...a[ti], ...patch }; upd({ topics: a }); }
    function addTopic() { const t = makeTopic(); upd({ topics: [...state.topics, t] }); setExpandedTopics(prev => new Set([...prev, t.id])); }
    function removeTopic(ti) { upd({ topics: state.topics.filter((_, idx) => idx !== ti) }); }
    function toggleTopic(id) { setExpandedTopics(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; }); }
    function moveTopic(ti, dir) {
        const nextIndex = ti + dir;
        if (nextIndex < 0 || nextIndex >= state.topics.length)
            return;
        const topics = [...state.topics];
        [topics[ti], topics[nextIndex]] = [topics[nextIndex], topics[ti]];
        upd({ topics });
    }
    function updateCard(ti, ci, patch) { const topics = [...state.topics]; const cards = [...topics[ti].cards]; cards[ci] = { ...cards[ci], ...patch }; topics[ti] = { ...topics[ti], cards }; upd({ topics }); }
    function addCard(ti) { const topics = [...state.topics]; topics[ti] = { ...topics[ti], cards: [...topics[ti].cards, makeCard()] }; upd({ topics }); }
    function removeCard(ti, ci) { const topics = [...state.topics]; topics[ti] = { ...topics[ti], cards: topics[ti].cards.filter((_, idx) => idx !== ci) }; upd({ topics }); }
    function moveCard(ti, ci, dir) {
        const topic = state.topics[ti];
        const nextIndex = ci + dir;
        if (!topic || nextIndex < 0 || nextIndex >= topic.cards.length)
            return;
        const topics = [...state.topics];
        const cards = [...topic.cards];
        [cards[ci], cards[nextIndex]] = [cards[nextIndex], cards[ci]];
        topics[ti] = { ...topic, cards };
        upd({ topics });
    }
    async function copyTopicToComponent(ti, targetCompId) {
        const targetComp = components.find(c => c.id === targetCompId);
        if (!targetComp)
            return;
        setCopyingTopicId(state.topics[ti].id);
        try {
            const cloned = cloneTopic(state.topics[ti]);
            const updatedComps = components.map(c => {
                if (c.id !== targetCompId)
                    return c;
                return { ...c, data: { topics: [...(c.data?.topics || []), cloned] } };
            });
            await saveComps(updatedComps);
            const topicLabel = normalize(state.topics[ti].title, 'programCardTitle').text || 'Topic';
            setCopyStatus(`"${topicLabel}" copied to "${targetComp.name}"`);
            setTimeout(() => setCopyStatus(''), 3000);
        }
        finally {
            setCopyingTopicId(null);
        }
    }
    function generate() {
        if (!activeId && !name) {
            alert('Save the component first.');
            return;
        }
        const id = activeId || 'preview';
        const html = generateProgramCardsHtml(id, name || 'Preview', state);
        setPreviewHtml(html);
        setActiveTab('preview');
    }
    const otherComponents = components.filter(c => c.id !== activeId);
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Program Cards" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Filterable grid with sidebar topics, search & pagination" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Section name (shown in filter pills)", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. ACCA Courses", onChange: e => setName(e.target.value) }) })] }), copyStatus && (_jsxs("div", { className: "mb-3 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2 text-xs text-indigo-700", children: ["\u2713 ", copyStatus] })), _jsx("p", { className: "section-label", children: "Topics" }), _jsx("div", { className: "space-y-2 mb-2", children: state.topics.map((topic, ti) => {
                                    const isOpen = expandedTopics.has(topic.id);
                                    const topicLabel = normalize(topic.title, 'programCardTitle').text || `Topic ${ti + 1}`;
                                    const isCopying = copyingTopicId === topic.id;
                                    return (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50", children: [_jsxs("div", { className: "flex items-center gap-1.5 px-3 py-2", children: [_jsx("span", { className: "flex-1 text-sm font-medium text-slate-700 cursor-pointer truncate", onClick: () => toggleTopic(topic.id), children: topicLabel }), _jsxs("span", { className: "text-xs text-slate-400 shrink-0", children: [topic.cards.length, "c"] }), otherComponents.length > 0 && (_jsx("div", { className: "relative shrink-0", children: _jsxs("select", { className: "text-xs border border-slate-300 rounded px-1.5 py-0.5 bg-white text-indigo-700 cursor-pointer", value: "", disabled: isCopying, onChange: e => { if (e.target.value)
                                                                copyTopicToComponent(ti, e.target.value); }, title: "Copy topic to another component", children: [_jsx("option", { value: "", children: isCopying ? 'Copying…' : '⧉ Copy to…' }), otherComponents.map(c => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }) })), _jsx("button", { onClick: e => { e.stopPropagation(); moveTopic(ti, -1); }, disabled: ti === 0, title: "Move topic up", className: "btn-ghost text-xs px-2 py-1 shrink-0", children: "\u25B2" }), _jsx("button", { onClick: e => { e.stopPropagation(); moveTopic(ti, 1); }, disabled: ti === state.topics.length - 1, title: "Move topic down", className: "btn-ghost text-xs px-2 py-1 shrink-0", children: "\u25BC" }), _jsx("button", { onClick: e => { e.stopPropagation(); removeTopic(ti); }, className: "btn-danger text-xs px-2 shrink-0", children: "\u2715" }), _jsx("span", { className: "text-slate-400 text-xs cursor-pointer shrink-0", onClick: () => toggleTopic(topic.id), children: isOpen ? '▲' : '▼' })] }), isOpen && (_jsxs("div", { className: "border-t border-slate-200 p-3 space-y-2", children: [_jsx(RichTextField, { label: "Topic title", value: asTV(topic.title, 'programCardTitle'), defaultKey: "programCardTitle", onChange: v => updateTopic(ti, { title: v }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Topic colour", value: topic.topicColor, onChange: v => updateTopic(ti, { topicColor: v }) }), _jsx(ColorRow, { label: "Badge background", value: topic.badgeBg, onChange: v => updateTopic(ti, { badgeBg: v }) }), _jsx(Field, { label: "Badge opacity (0\u20131)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 1, step: 0.05, value: topic.badgeOpacity, onChange: e => updateTopic(ti, { badgeOpacity: parseFloat(e.target.value) }) }) })] }), _jsx(FontFormatter, { label: "Badge formatter", value: topic.badgeTextStyle, onChange: v => updateTopic(ti, { badgeTextStyle: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2", children: "Cards" }), _jsx("div", { className: "space-y-2", children: topic.cards.map((card, ci) => (_jsxs("div", { className: "relative rounded border border-slate-100 bg-white p-3", children: [_jsxs("div", { className: "absolute right-2 top-2 flex gap-1", children: [_jsx("button", { onClick: () => moveCard(ti, ci, -1), disabled: ci === 0, title: "Move card up", className: "btn-ghost text-xs px-2 py-1", children: "\u25B2" }), _jsx("button", { onClick: () => moveCard(ti, ci, 1), disabled: ci === topic.cards.length - 1, title: "Move card down", className: "btn-ghost text-xs px-2 py-1", children: "\u25BC" }), _jsx("button", { onClick: () => removeCard(ti, ci), className: "btn-danger text-xs px-2", children: "\u2715" })] }), _jsx(RichTextField, { label: "Card title", value: asTV(card.title, 'programCardTitle'), defaultKey: "programCardTitle", onChange: v => updateCard(ti, ci, { title: v }) }), _jsx(RichTextField, { label: "Description", value: asTV(card.desc, 'programDesc'), defaultKey: "programDesc", onChange: v => updateCard(ti, ci, { desc: v }), multiline: true }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Card URL", children: _jsx("input", { className: "input", value: card.url, placeholder: "https://\u2026", onChange: e => updateCard(ti, ci, { url: e.target.value }) }) }), _jsx(Field, { label: "Badge text", children: _jsx("input", { className: "input", value: card.badge, placeholder: "NEW", onChange: e => updateCard(ti, ci, { badge: e.target.value }) }) }), _jsx(Field, { label: "Video hours", children: _jsx("input", { className: "input", value: card.hours, placeholder: "12h", onChange: e => updateCard(ti, ci, { hours: e.target.value }) }) }), _jsx(Field, { label: "Rating", children: _jsx("input", { className: "input", value: card.rating, placeholder: "4.8", onChange: e => updateCard(ti, ci, { rating: e.target.value }) }) }), _jsx(ColorRow, { label: "Card background", value: card.cardBg, onChange: v => updateCard(ti, ci, { cardBg: v }) })] }), _jsx(RichTextField, { label: "CTA text", value: asTV(card.cta, 'programCta'), defaultKey: "programCta", onChange: v => updateCard(ti, ci, { cta: v }) })] }, card.id || ci))) }), _jsx("button", { onClick: () => addCard(ti), className: "btn-ghost text-xs w-full mt-1", children: "+ Add card" })] }))] }, topic.id));
                                }) }), _jsx("button", { onClick: addTopic, className: "btn-ghost text-xs w-full mb-4", children: "+ Add topic" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
