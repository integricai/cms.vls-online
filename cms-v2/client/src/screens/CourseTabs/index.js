import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateCourseTabsHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
function makeDefault() {
    return { tabs: [] };
}
function makeCard() {
    return { icon: '📚', title: normalize('', 'ctabsCardTitle'), desc: normalize('', 'ctabsCardDesc') };
}
function makeStep() {
    return { icon: '', title: normalize('', 'ctabsStepTitle'), desc: normalize('', 'ctabsStepDesc') };
}
function makeSupportRow() {
    return { cols: 2, cards: [makeCard(), makeCard()] };
}
function makeBlock(type) {
    const base = {};
    if (type === 'paragraph')
        return { type, data: { para: normalize('', 'ctabsPara') } };
    if (type === 'heading-para')
        return { type, data: { headingRich: normalize('', 'ctabsHeading'), para: normalize('', 'ctabsPara') } };
    if (type === 'bullets')
        return { type, data: { headingRich: normalize('', 'ctabsHeading'), items: [] } };
    if (type === 'panel-intro')
        return { type, data: { eyebrow: '', heading: '', desc: '' } };
    if (type === 'assurance')
        return { type, data: { icon: '🛡️', eyebrow: '', heading: '', desc: '' } };
    if (type === 'inc-cards')
        return { type, data: { cards: [makeCard(), makeCard()] } };
    if (type === 'steps')
        return { type, data: { steps: [makeStep()] } };
    if (type === 'support-cards')
        return { type, data: { rows: [makeSupportRow()] } };
    if (type === 'more-cards')
        return { type, data: { cards: [makeCard(), makeCard(), makeCard()] } };
    if (type === 'banner')
        return { type, data: { bg: '#204280', eyebrow: '', title: '', desc: '', cta: '', url: '#' } };
    return { type, data: base };
}
function makeTab() {
    return { id: 'tab-' + Date.now().toString(36), icon: '', label: 'New Tab', blocks: [] };
}
const BLOCK_LABELS = {
    'panel-intro': 'Panel Intro (dark header)',
    'paragraph': 'Paragraph',
    'heading-para': 'Heading + Paragraph',
    'bullets': 'Bullet List',
    'assurance': 'Assurance Card',
    'inc-cards': 'Included Cards (2-col)',
    'steps': 'Steps / Timeline',
    'support-cards': 'Support Cards',
    'more-cards': 'More Cards (3-col)',
    'banner': 'CTA Banner',
};
function asTV(v, key) {
    return normalize(v, key);
}
// ── Card editor ───────────────────────────────────────────────────────────────
function CardEditor({ card, onChange, showSubtitle = false }) {
    return (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-2 space-y-1", children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: card.icon, onChange: e => onChange({ ...card, icon: e.target.value }) }) }), showSubtitle && (_jsx(Field, { label: "Subtitle (italic, optional)", children: _jsx("input", { className: "input", value: card.subtitle ?? '', onChange: e => onChange({ ...card, subtitle: e.target.value }) }) })), _jsx(RichTextField, { label: "Title", value: asTV(card.title, 'ctabsCardTitle'), defaultKey: "ctabsCardTitle", onChange: v => onChange({ ...card, title: v }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: asTV(card.desc, 'ctabsCardDesc'), defaultKey: "ctabsCardDesc", onChange: v => onChange({ ...card, desc: v }) }), _jsx(Field, { label: "Badge (optional)", children: _jsx("input", { className: "input", value: card.badge ?? '', placeholder: "e.g. 46 hours", onChange: e => onChange({ ...card, badge: e.target.value }) }) }), _jsx(Field, { label: "CTA text (optional)", children: _jsx("input", { className: "input", value: card.cta ?? '', placeholder: "Learn more", onChange: e => onChange({ ...card, cta: e.target.value }) }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: card.url ?? '', placeholder: "https://...", onChange: e => onChange({ ...card, url: e.target.value }) }) })] }));
}
// ── Step editor ───────────────────────────────────────────────────────────────
function StepEditor({ step, index, onChange }) {
    return (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-2 space-y-1", children: [_jsx(Field, { label: `Step ${index + 1} icon (emoji/number)`, children: _jsx("input", { className: "input", value: step.icon ?? '', placeholder: String(index + 1), onChange: e => onChange({ ...step, icon: e.target.value }) }) }), _jsx(RichTextField, { label: "Title", value: asTV(step.title, 'ctabsStepTitle'), defaultKey: "ctabsStepTitle", onChange: v => onChange({ ...step, title: v }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: asTV(step.desc, 'ctabsStepDesc'), defaultKey: "ctabsStepDesc", onChange: v => onChange({ ...step, desc: v }) }), _jsx(Field, { label: "CTA text (optional)", children: _jsx("input", { className: "input", value: step.cta ?? '', placeholder: "Get started", onChange: e => onChange({ ...step, cta: e.target.value }) }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: step.url ?? '', placeholder: "https://...", onChange: e => onChange({ ...step, url: e.target.value }) }) })] }));
}
// ── Block editor ─────────────────────────────────────────────────────────────
function BlockEditor({ block, onUpdate, onRemove, onMoveUp, onMoveDown }) {
    const [open, setOpen] = useState(true);
    const d = block.data;
    function updCards(cards) { onUpdate({ ...d, cards }); }
    function updSteps(steps) { onUpdate({ ...d, steps }); }
    function updRows(rows) { onUpdate({ ...d, rows }); }
    return (_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 mb-2", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2", children: [_jsxs("div", { className: "flex flex-col gap-0.5", children: [_jsx("button", { onClick: onMoveUp, className: "text-slate-400 hover:text-slate-700 text-[10px] leading-none", children: "\u25B2" }), _jsx("button", { onClick: onMoveDown, className: "text-slate-400 hover:text-slate-700 text-[10px] leading-none", children: "\u25BC" })] }), _jsxs("button", { onClick: () => setOpen(o => !o), className: "flex-1 text-left text-xs font-semibold text-slate-700", children: [open ? '▾' : '▸', " ", BLOCK_LABELS[block.type]] }), _jsx("button", { onClick: onRemove, className: "btn-danger text-xs", children: "\u2715" })] }), open && (_jsxs("div", { className: "px-3 pb-3 space-y-2", children: [block.type === 'panel-intro' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: d.eyebrow ?? '', onChange: e => onUpdate({ ...d, eyebrow: e.target.value }) }) }), _jsx(Field, { label: "Heading", children: _jsx("input", { className: "input", value: d.heading ?? '', onChange: e => onUpdate({ ...d, heading: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input min-h-[72px]", value: d.desc ?? '', onChange: e => onUpdate({ ...d, desc: e.target.value }) }) })] })), block.type === 'paragraph' && (_jsx(RichTextField, { label: "Paragraph", multiline: true, value: asTV(d.para, 'ctabsPara'), defaultKey: "ctabsPara", onChange: v => onUpdate({ ...d, para: v }) })), block.type === 'heading-para' && (_jsxs(_Fragment, { children: [_jsx(RichTextField, { label: "Heading", value: asTV(d.headingRich, 'ctabsHeading'), defaultKey: "ctabsHeading", onChange: v => onUpdate({ ...d, headingRich: v }) }), _jsx(RichTextField, { label: "Paragraph", multiline: true, value: asTV(d.para, 'ctabsPara'), defaultKey: "ctabsPara", onChange: v => onUpdate({ ...d, para: v }) })] })), block.type === 'bullets' && (_jsxs(_Fragment, { children: [_jsx(RichTextField, { label: "Heading (optional)", value: asTV(d.headingRich, 'ctabsHeading'), defaultKey: "ctabsHeading", onChange: v => onUpdate({ ...d, headingRich: v }) }), _jsx("p", { className: "text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1", children: "Bullet items" }), _jsx("div", { className: "space-y-1", children: (d.items ?? []).map((item, i) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Item ${i + 1}`, value: asTV(item, 'ctabsBullet'), defaultKey: "ctabsBullet", onChange: v => { const items = [...(d.items ?? [])]; items[i] = v; onUpdate({ ...d, items }); } }) }), _jsx("button", { onClick: () => { const items = (d.items ?? []).filter((_, idx) => idx !== i); onUpdate({ ...d, items }); }, className: "btn-danger mt-5 text-xs", children: "\u2715" })] }, i))) }), _jsx("button", { onClick: () => onUpdate({ ...d, items: [...(d.items ?? []), normalize('', 'ctabsBullet')] }), className: "btn-ghost text-xs w-full", children: "+ Add bullet" })] })), block.type === 'assurance' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: d.icon ?? '', onChange: e => onUpdate({ ...d, icon: e.target.value }) }) }), _jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: d.eyebrow ?? '', onChange: e => onUpdate({ ...d, eyebrow: e.target.value }) }) }), _jsx(Field, { label: "Heading", children: _jsx("input", { className: "input", value: d.heading ?? '', onChange: e => onUpdate({ ...d, heading: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input min-h-[72px]", value: d.desc ?? '', onChange: e => onUpdate({ ...d, desc: e.target.value }) }) })] })), block.type === 'inc-cards' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[11px] font-semibold text-slate-500 uppercase tracking-wide", children: "Cards (2-column grid)" }), _jsx("div", { className: "space-y-2", children: (d.cards ?? []).map((card, i) => (_jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => updCards((d.cards ?? []).filter((_, idx) => idx !== i)), className: "btn-danger absolute right-1 top-1 z-10 text-xs", children: "\u2715" }), _jsx(CardEditor, { card: card, onChange: c => { const cards = [...(d.cards ?? [])]; cards[i] = c; updCards(cards); } })] }, i))) }), _jsx("button", { onClick: () => updCards([...(d.cards ?? []), makeCard()]), className: "btn-ghost text-xs w-full", children: "+ Add card" })] })), block.type === 'steps' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[11px] font-semibold text-slate-500 uppercase tracking-wide", children: "Steps" }), _jsx("div", { className: "space-y-2", children: (d.steps ?? []).map((step, i) => (_jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => updSteps((d.steps ?? []).filter((_, idx) => idx !== i)), className: "btn-danger absolute right-1 top-1 z-10 text-xs", children: "\u2715" }), _jsx(StepEditor, { step: step, index: i, onChange: s => { const steps = [...(d.steps ?? [])]; steps[i] = s; updSteps(steps); } })] }, i))) }), _jsx("button", { onClick: () => updSteps([...(d.steps ?? []), makeStep()]), className: "btn-ghost text-xs w-full", children: "+ Add step" })] })), block.type === 'support-cards' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[11px] font-semibold text-slate-500 uppercase tracking-wide", children: "Rows" }), _jsx("div", { className: "space-y-3", children: (d.rows ?? []).map((row, ri) => (_jsxs("div", { className: "rounded border border-slate-300 bg-white p-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx(Field, { label: "Columns", children: _jsxs("select", { className: "input", value: row.cols, onChange: e => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cols: Number(e.target.value) }; updRows(rows); }, children: [_jsx("option", { value: 1, children: "1 column (full width)" }), _jsx("option", { value: 2, children: "2 columns" })] }) }), _jsx("button", { onClick: () => updRows((d.rows ?? []).filter((_, idx) => idx !== ri)), className: "btn-danger text-xs ml-2 mt-4", children: "\u2715 Row" })] }), _jsx("div", { className: "space-y-2", children: row.cards.map((card, ci) => (_jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cards: row.cards.filter((_, idx) => idx !== ci) }; updRows(rows); }, className: "btn-danger absolute right-1 top-1 z-10 text-xs", children: "\u2715" }), _jsx(CardEditor, { card: card, showSubtitle: true, onChange: c => { const rows = [...(d.rows ?? [])]; const cards = [...row.cards]; cards[ci] = c; rows[ri] = { ...row, cards }; updRows(rows); } })] }, ci))) }), _jsx("button", { onClick: () => { const rows = [...(d.rows ?? [])]; rows[ri] = { ...row, cards: [...row.cards, makeCard()] }; updRows(rows); }, className: "btn-ghost text-xs w-full mt-1", children: "+ Add card to row" })] }, ri))) }), _jsx("button", { onClick: () => updRows([...(d.rows ?? []), makeSupportRow()]), className: "btn-ghost text-xs w-full", children: "+ Add row" })] })), block.type === 'more-cards' && (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-[11px] font-semibold text-slate-500 uppercase tracking-wide", children: "Cards (3-column grid)" }), _jsx("div", { className: "space-y-2", children: (d.cards ?? []).map((card, i) => (_jsxs("div", { className: "relative", children: [_jsx("button", { onClick: () => updCards((d.cards ?? []).filter((_, idx) => idx !== i)), className: "btn-danger absolute right-1 top-1 z-10 text-xs", children: "\u2715" }), _jsx(CardEditor, { card: card, onChange: c => { const cards = [...(d.cards ?? [])]; cards[i] = c; updCards(cards); } })] }, i))) }), _jsx("button", { onClick: () => updCards([...(d.cards ?? []), makeCard()]), className: "btn-ghost text-xs w-full", children: "+ Add card" })] })), block.type === 'banner' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Background colour", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(d.bg ?? '') ? d.bg : '#204280', onChange: e => onUpdate({ ...d, bg: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", className: "input", value: d.bg ?? '#204280', onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                                                onUpdate({ ...d, bg: e.target.value }); } })] }) }), _jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: d.eyebrow ?? '', onChange: e => onUpdate({ ...d, eyebrow: e.target.value }) }) }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: d.title ?? '', onChange: e => onUpdate({ ...d, title: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input min-h-[72px]", value: d.desc ?? '', onChange: e => onUpdate({ ...d, desc: e.target.value }) }) }), _jsx(Field, { label: "CTA text (optional)", children: _jsx("input", { className: "input", value: d.cta ?? '', placeholder: "Enrol Now", onChange: e => onUpdate({ ...d, cta: e.target.value }) }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: d.url ?? '', placeholder: "https://...", onChange: e => onUpdate({ ...d, url: e.target.value }) }) })] }))] }))] }));
}
// ── Main screen ───────────────────────────────────────────────────────────────
export default function CourseTabsScreen() {
    const [components, setComponents] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const [activeTabIdx, setActiveTabIdx] = useState(0);
    const [newBlockType, setNewBlockType] = useState('paragraph');
    useEffect(() => {
        api.get('/content/vls-course-tabs-components')
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
        setActiveTabIdx(0);
        setSaved(false);
    }
    function newComponent() { setActiveId(null); setName(''); setState(makeDefault()); setActiveTabIdx(0); setSaved(false); }
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
                    id = `ctb-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `ctb-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-course-tabs-components', { components: comps });
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
        await api.put('/content/vls-course-tabs-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    // Tab management
    function addTab() {
        const tabs = [...state.tabs, makeTab()];
        upd({ tabs });
        setActiveTabIdx(tabs.length - 1);
    }
    function removeTab(i) {
        const tabs = state.tabs.filter((_, idx) => idx !== i);
        upd({ tabs });
        setActiveTabIdx(Math.min(activeTabIdx, tabs.length - 1));
    }
    function updateTab(i, patch) {
        const tabs = [...state.tabs];
        tabs[i] = { ...tabs[i], ...patch };
        upd({ tabs });
    }
    // Block management for active tab
    const currentTab = state.tabs[activeTabIdx];
    function updateBlocks(blocks) {
        const tabs = [...state.tabs];
        tabs[activeTabIdx] = { ...tabs[activeTabIdx], blocks };
        upd({ tabs });
    }
    function addBlock() {
        if (!currentTab)
            return;
        updateBlocks([...currentTab.blocks, makeBlock(newBlockType)]);
    }
    function updateBlock(bi, data) {
        const blocks = [...currentTab.blocks];
        blocks[bi] = { ...blocks[bi], data };
        updateBlocks(blocks);
    }
    function removeBlock(bi) { updateBlocks(currentTab.blocks.filter((_, i) => i !== bi)); }
    function moveBlock(bi, dir) {
        const blocks = [...currentTab.blocks];
        const ni = bi + dir;
        if (ni < 0 || ni >= blocks.length)
            return;
        [blocks[bi], blocks[ni]] = [blocks[ni], blocks[bi]];
        updateBlocks(blocks);
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Course Tabs" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Tab panel content for course pages" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(generateCourseTabsHtml(state)); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. FA1 Course Tabs", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Tabs" }), _jsx("div", { className: "space-y-1.5 mb-2", children: state.tabs.map((tab, i) => (_jsxs("div", { className: `flex gap-2 items-center rounded-lg px-2 py-1.5 cursor-pointer transition ${activeTabIdx === i ? 'bg-brand/10 border border-brand/30' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'}`, onClick: () => setActiveTabIdx(i), children: [_jsx("input", { className: "input w-10 text-center p-1", value: tab.icon, placeholder: "\uD83D\uDCDA", onClick: e => e.stopPropagation(), onChange: e => { e.stopPropagation(); updateTab(i, { icon: e.target.value }); } }), _jsx("input", { className: "input flex-1 py-1", value: tab.label, placeholder: `Tab ${i + 1}`, onClick: e => e.stopPropagation(), onChange: e => { e.stopPropagation(); updateTab(i, { label: e.target.value }); } }), _jsxs("span", { className: "text-xs text-slate-400 shrink-0", children: [tab.blocks.length, " blocks"] }), _jsx("button", { onClick: e => { e.stopPropagation(); removeTab(i); }, className: "btn-danger text-xs shrink-0", children: "\u2715" })] }, tab.id))) }), _jsx("button", { onClick: addTab, className: "btn-ghost text-xs w-full mb-4", children: "+ Add tab" }), currentTab ? (_jsxs(_Fragment, { children: [_jsx("div", { className: "flex items-center justify-between mb-2", children: _jsxs("p", { className: "section-label mb-0", children: ["Blocks \u2014 ", _jsx("span", { className: "font-normal text-brand", children: currentTab.label || `Tab ${activeTabIdx + 1}` })] }) }), _jsx("div", { children: currentTab.blocks.map((blk, bi) => (_jsx(BlockEditor, { block: blk, onUpdate: d => updateBlock(bi, d), onRemove: () => removeBlock(bi), onMoveUp: () => moveBlock(bi, -1), onMoveDown: () => moveBlock(bi, 1) }, bi))) }), _jsxs("div", { className: "flex gap-2 mt-2", children: [_jsx("select", { className: "input flex-1 text-xs", value: newBlockType, onChange: e => setNewBlockType(e.target.value), children: Object.keys(BLOCK_LABELS).map(t => (_jsx("option", { value: t, children: BLOCK_LABELS[t] }, t))) }), _jsx("button", { onClick: addBlock, className: "btn-ghost text-xs px-4", children: "+ Add block" })] })] })) : (_jsx("p", { className: "text-xs text-slate-400 text-center py-6", children: "Add a tab above to start editing blocks." }))] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
