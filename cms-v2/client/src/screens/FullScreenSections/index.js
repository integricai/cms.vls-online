import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateDcsHtml, generateDcs2Html, generateDcs3Html, generateReachHtml, generatePhbHtml, generatePhv2Html, } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function tv(v, k) { return normalize(v, k); }
function hex(v, fb = '#ffffff') { return /^#[0-9a-fA-F]{6}$/.test(v) ? v : fb; }
// ── Default states ─────────────────────────────────────────────────────────────
function makeDcs() {
    return { padTop: 60, padBot: 60, padLeft: 20, padRight: 20, leftWidth: 50, leftBg: '#ffffff', rightBg: '#132239', cardBg: '#1e3550', leftLabel: normalize('', 'dcsLabel'), leftTitle: normalize('', 'dcsTitle'), leftParas: [normalize('', 'dcsPara')], rightLabel: normalize('', 'dcsLabel'), cards: [] };
}
function makeDcs2() {
    return { padTop: 60, padBot: 60, padLeft: 20, padRight: 20, leftWidth: 50, leftBg: '#132239', rightBg: '#f9fafb', leftLabel: normalize('', 'dcs2Label'), leftTitle: normalize('', 'dcs2Title'), leftParas: [normalize('', 'dcs2Para')], bulletColor: '#eef2f8', leftBullets: [], rightLabel: normalize('', 'dcs2RLabel'), statBg: '#ffffff', statBorder: '#e5e7eb', statsPerRow: 2, stats: [], quoteShow: false, quoteBg: '#eef2f8', quoteText: normalize('', 'dcs2Quote'), quoteAttrib: normalize('', 'dcs2Attrib') };
}
function makeDcs3() {
    return { padTop: 60, padBot: 60, leftPadH: 20, rightPadH: 20, leftWidth: 60, leftBg: '#f8fafc', rightBg: '#1a56a3', checkColor: '#1a56a3', featBg: '#ffffff', featCols: 2, tagBg: '#ffffff26', ctaUrl: '', ctaColor: '#ffffff', ctaBorder: '#ffffff', ctaFill: '#1a56a3', leftLabel: normalize('', 'dcs3Label'), leftTitle: normalize('', 'dcs3Title'), leftPara: normalize('', 'dcs3Para'), rightLabel: normalize('', 'dcs3RLabel'), rightTitle: normalize('', 'dcs3RTitle'), rightPara: normalize('', 'dcs3RPara'), ctaText: normalize('', 'dcs3Cta'), features: [], tags: [] };
}
function makeReach() {
    return { padTop: 60, padBot: 60, padLeft: 48, padRight: 48, bg: '#0d1f3c', leftWidth: 45, statBg: '#1e3550', imgHeight: 300, imgBg: '#1e3550', imgUrl: '', imgAlt: '', imgPlaceholder: 'Map image', regionBg: '#1e3550', label: normalize('', 'reachLabel'), title: normalize('', 'reachTitle'), para: normalize('', 'reachPara'), stats: [], regions: [] };
}
function makePhb() {
    return { bg: '#0d1f3c', radius: 0, padTop: 40, padBot: 40, padLeft: 60, padRight: 60, eyebrow: '', eyebrowTc: '#4a90d9', showDot: true, dotColor: '#4a90d9', heading: normalize('', 'phbHeading'), bulletTc: '#c7d2e0', sepColor: '#4a90d9', bullets: [], showBadge: false, badgeBg: '#1a3a6e', badgeRadius: 12, badgeEyebrow: '', badgeEyebrowTc: '#c7d2e0', badgeMain: normalize('', 'phbBadgeMain'), badgeSub: '', badgeSubTc: '#c7d2e0' };
}
function makePhv2() {
    return { bg: '#0d1f3c', padTop: 48, padBot: 48, padLeft: 60, padRight: 60, split: 60, colGap: 48, breadcrumb: '', breadcrumbTc: '#94a3b8', eyebrowTc: '#4a90d9', eyebrowDot: '#4a90d9', eyebrowLabels: [], heading: normalize('', 'phv2Heading'), headingAccent: '', headingAccentColor: '#4a90d9', headingPost: '', desc: normalize('', 'phv2Desc'), trustTc: '#94a3b8', trustDot: '#4a90d9', trustItems: [], cardBg: '#0f2744', cardBorder: '#1e3a5f', cardRadius: 10, cardVc: '#ffffff', cardLc: '#94a3b8', cards: [] };
}
function normalizeNum(v, fb) { const n = Number(v); return isNaN(n) ? fb : n; }
function normDcs(raw) {
    return {
        padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
        padLeft: normalizeNum(raw.padLeft, 20), padRight: normalizeNum(raw.padRight, 20),
        leftWidth: normalizeNum(raw.leftWidth, 50), leftBg: raw.leftBg || '#ffffff',
        rightBg: raw.rightBg || '#132239', cardBg: raw.cardBg || '#1e3550',
        leftLabel: raw.leftLabel || normalize('', 'dcsLabel'),
        leftTitle: raw.leftTitle || normalize('', 'dcsTitle'),
        leftParas: (raw.leftParas || [normalize('', 'dcsPara')]),
        rightLabel: raw.rightLabel || normalize('', 'dcsLabel'),
        cards: (raw.cards || []),
    };
}
function normDcs2(raw) {
    return {
        padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
        padLeft: normalizeNum(raw.padLeft, 20), padRight: normalizeNum(raw.padRight, 20),
        leftWidth: normalizeNum(raw.leftWidth, 50), leftBg: raw.leftBg || '#132239', rightBg: raw.rightBg || '#f9fafb',
        leftLabel: raw.leftLabel || normalize('', 'dcs2Label'),
        leftTitle: raw.leftTitle || normalize('', 'dcs2Title'),
        leftParas: raw.leftParas || [normalize('', 'dcs2Para')],
        bulletColor: raw.bulletColor || '#eef2f8',
        leftBullets: raw.leftBullets || [],
        rightLabel: raw.rightLabel || normalize('', 'dcs2RLabel'),
        statBg: raw.statBg || '#ffffff', statBorder: raw.statBorder || '#e5e7eb',
        statsPerRow: normalizeNum(raw.statsPerRow, 2), stats: raw.stats || [],
        quoteShow: !!raw.quoteShow, quoteBg: raw.quoteBg || '#eef2f8',
        quoteText: raw.quoteText || normalize('', 'dcs2Quote'),
        quoteAttrib: raw.quoteAttrib || normalize('', 'dcs2Attrib'),
    };
}
function normDcs3(raw) {
    return {
        padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
        leftPadH: normalizeNum(raw.leftPadH, 20), rightPadH: normalizeNum(raw.rightPadH, 20),
        leftWidth: normalizeNum(raw.leftWidth, 60), leftBg: raw.leftBg || '#f8fafc', rightBg: raw.rightBg || '#1a56a3',
        checkColor: raw.checkColor || '#1a56a3', featBg: raw.featBg || '#ffffff',
        featCols: normalizeNum(raw.featCols, 2), tagBg: raw.tagBg || '#ffffff26',
        ctaUrl: raw.ctaUrl || '', ctaColor: raw.ctaColor || '#ffffff',
        ctaBorder: raw.ctaBorder || '#ffffff', ctaFill: raw.ctaFill || '#1a56a3',
        leftLabel: raw.leftLabel || normalize('', 'dcs3Label'),
        leftTitle: raw.leftTitle || normalize('', 'dcs3Title'),
        leftPara: raw.leftPara || normalize('', 'dcs3Para'),
        rightLabel: raw.rightLabel || normalize('', 'dcs3RLabel'),
        rightTitle: raw.rightTitle || normalize('', 'dcs3RTitle'),
        rightPara: raw.rightPara || normalize('', 'dcs3RPara'),
        ctaText: raw.ctaText || normalize('', 'dcs3Cta'),
        features: raw.features || [], tags: raw.tags || [],
    };
}
function normReach(raw) {
    return {
        padTop: normalizeNum(raw.padTop, 60), padBot: normalizeNum(raw.padBot, 60),
        padLeft: normalizeNum(raw.padLeft, 48), padRight: normalizeNum(raw.padRight, 48),
        bg: raw.bg || '#0d1f3c', leftWidth: normalizeNum(raw.leftWidth, 45),
        statBg: raw.statBg || '#1e3550',
        imgHeight: normalizeNum(raw.imgHeight, 300), imgBg: raw.imgBg || '#1e3550',
        imgUrl: raw.imgUrl || '', imgAlt: raw.imgAlt || '', imgPlaceholder: raw.imgPlaceholder || '',
        regionBg: raw.regionBg || '#1e3550',
        label: raw.label || normalize('', 'reachLabel'),
        title: raw.title || normalize('', 'reachTitle'),
        para: raw.para || normalize('', 'reachPara'),
        stats: raw.stats || [], regions: raw.regions || [],
    };
}
function normPhb(raw) {
    return {
        bg: raw.bg || '#0d1f3c', radius: normalizeNum(raw.radius, 0),
        padTop: normalizeNum(raw.padTop, 40), padBot: normalizeNum(raw.padBot, 40),
        padLeft: normalizeNum(raw.padLeft, 60), padRight: normalizeNum(raw.padRight, 60),
        eyebrow: raw.eyebrow || '', eyebrowTc: raw.eyebrowTc || '#4a90d9',
        showDot: raw.showDot !== false, dotColor: raw.dotColor || '#4a90d9',
        heading: raw.heading || normalize('', 'phbHeading'),
        bulletTc: raw.bulletTc || '#c7d2e0', sepColor: raw.sepColor || '#4a90d9',
        bullets: raw.bullets || [],
        showBadge: !!raw.showBadge, badgeBg: raw.badgeBg || '#1a3a6e',
        badgeRadius: normalizeNum(raw.badgeRadius, 12),
        badgeEyebrow: raw.badgeEyebrow || '', badgeEyebrowTc: raw.badgeEyebrowTc || '#c7d2e0',
        badgeMain: raw.badgeMain || normalize('', 'phbBadgeMain'),
        badgeSub: raw.badgeSub || '', badgeSubTc: raw.badgeSubTc || '#c7d2e0',
    };
}
function normPhv2(raw) {
    return {
        bg: raw.bg || '#0d1f3c',
        padTop: normalizeNum(raw.padTop, 48), padBot: normalizeNum(raw.padBot, 48),
        padLeft: normalizeNum(raw.padLeft, 60), padRight: normalizeNum(raw.padRight, 60),
        split: normalizeNum(raw.split, 60), colGap: normalizeNum(raw.colGap, 48),
        breadcrumb: raw.breadcrumb || '', breadcrumbTc: raw.breadcrumbTc || '#94a3b8',
        eyebrowTc: raw.eyebrowTc || '#4a90d9', eyebrowDot: raw.eyebrowDot || '#4a90d9',
        eyebrowLabels: raw.eyebrowLabels || [],
        heading: raw.heading || normalize('', 'phv2Heading'),
        headingAccent: raw.headingAccent || '', headingAccentColor: raw.headingAccentColor || '#4a90d9',
        headingPost: raw.headingPost || '',
        desc: raw.desc || normalize('', 'phv2Desc'),
        trustTc: raw.trustTc || '#94a3b8', trustDot: raw.trustDot || '#4a90d9',
        trustItems: raw.trustItems || [],
        cardBg: raw.cardBg || '#0f2744', cardBorder: raw.cardBorder || '#1e3a5f',
        cardRadius: normalizeNum(raw.cardRadius, 10),
        cardVc: raw.cardVc || '#ffffff', cardLc: raw.cardLc || '#94a3b8',
        cards: raw.cards || [],
    };
}
// ── Shared helpers ─────────────────────────────────────────────────────────────
function ColorInput({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: hex(value), onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value) || e.target.value.length <= 9)
                        onChange(e.target.value); } })] }) }));
}
function PaddingRow({ value, onChange }) {
    return (_jsx("div", { className: "grid grid-cols-4 gap-2 mb-3", children: ['padTop', 'padBot', 'padLeft', 'padRight'].map(k => (_jsx(Field, { label: k.replace('pad', 'Pad ').trim(), children: _jsx("input", { type: "number", className: "input", min: 0, max: 240, value: value[k], onChange: e => onChange({ [k]: Number(e.target.value) }) }) }, k))) }));
}
function CmpMgr({ components, activeId, name, saving, saved, onSelect, onNew, onDelete, onNameChange, onSave, onGenerate }) {
    return (_jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-3", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-2", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => onSelect(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: onNew, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: onDelete, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. About Us", onChange: e => onNameChange(e.target.value) }) })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: onSave, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: onGenerate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] })] }));
}
// ── Tab sub-screens ────────────────────────────────────────────────────────────
function DcsTab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDcs());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-dcs2-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normDcs(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makeDcs());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `dcs-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-dcs2-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete this component?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-dcs2-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makeDcs());
    }
    function updCard(i, p) { const a = [...state.cards]; a[i] = { ...a[i], ...p }; upd({ cards: a }); }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Two Column v1', generateDcsHtml(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsx(PaddingRow, { value: state, onChange: upd }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Left width %", children: _jsx("input", { type: "number", className: "input", min: 20, max: 80, value: state.leftWidth, onChange: e => upd({ leftWidth: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Card bg", value: state.cardBg, onChange: v => upd({ cardBg: v }) }), _jsx(ColorInput, { label: "Left bg", value: state.leftBg, onChange: v => upd({ leftBg: v }) }), _jsx(ColorInput, { label: "Right bg", value: state.rightBg, onChange: v => upd({ rightBg: v }) })] }), _jsx("p", { className: "section-label mt-3", children: "Left Column" }), _jsx(RichTextField, { label: "Label", value: tv(state.leftLabel, 'dcsLabel'), defaultKey: "dcsLabel", onChange: v => upd({ leftLabel: v }) }), _jsx(RichTextField, { label: "Title", value: tv(state.leftTitle, 'dcsTitle'), defaultKey: "dcsTitle", onChange: v => upd({ leftTitle: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Paragraphs" }), state.leftParas.map((p, i) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Para ${i + 1}`, value: tv(p, 'dcsPara'), defaultKey: "dcsPara", multiline: true, onChange: v => { const a = [...state.leftParas]; a[i] = v; upd({ leftParas: a }); } }) }), _jsx("button", { onClick: () => upd({ leftParas: state.leftParas.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ leftParas: [...state.leftParas, normalize('', 'dcsPara')] }), className: "btn-ghost text-xs w-full", children: "+ Add paragraph" }), _jsx("p", { className: "section-label mt-3", children: "Right Column" }), _jsx(RichTextField, { label: "Label", value: tv(state.rightLabel, 'dcsLabel'), defaultKey: "dcsLabel", onChange: v => upd({ rightLabel: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Icon Cards" }), state.cards.map((card, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 mb-2", children: [_jsxs("div", { className: "flex gap-2 items-center mb-2", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-500 flex-1", children: ["Card ", i + 1] }), _jsx("button", { onClick: () => upd({ cards: state.cards.filter((_, idx) => idx !== i) }), className: "btn-danger text-xs", children: "\u2715" })] }), _jsxs("div", { className: "flex gap-2 mb-2", children: [_jsx(Field, { label: "Icon emoji", className: "w-24", children: _jsx("input", { className: "input text-center text-lg", value: card.icon, onChange: e => updCard(i, { icon: e.target.value }) }) }), _jsx(ColorInput, { label: "Icon bg", value: card.iconBg, onChange: v => updCard(i, { iconBg: v }) })] }), _jsx(RichTextField, { label: "Title", value: tv(card.title, 'dcsCardTitle'), defaultKey: "dcsCardTitle", onChange: v => updCard(i, { title: v }) }), _jsx(RichTextField, { label: "Description", value: tv(card.desc, 'dcsCardDesc'), defaultKey: "dcsCardDesc", multiline: true, onChange: v => updCard(i, { desc: v }) })] }, i))), _jsx("button", { onClick: () => upd({ cards: [...state.cards, { icon: '⭐', iconBg: '#3b82f6', title: normalize('', 'dcsCardTitle'), desc: normalize('', 'dcsCardDesc') }] }), className: "btn-ghost text-xs w-full", children: "+ Add card" })] })] }));
}
function Dcs2Tab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDcs2());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-dcs-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normDcs2(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makeDcs2());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `dcs2-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-dcs-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-dcs-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makeDcs2());
    }
    function updStat(i, p) { const a = [...state.stats]; a[i] = { ...a[i], ...p }; upd({ stats: a }); }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Two Column v2', generateDcs2Html(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsx(PaddingRow, { value: state, onChange: upd }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Left width %", children: _jsx("input", { type: "number", className: "input", min: 20, max: 80, value: state.leftWidth, onChange: e => upd({ leftWidth: Number(e.target.value) }) }) }), _jsx(Field, { label: "Stats per row", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: state.statsPerRow, onChange: e => upd({ statsPerRow: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Left bg", value: state.leftBg, onChange: v => upd({ leftBg: v }) }), _jsx(ColorInput, { label: "Right bg", value: state.rightBg, onChange: v => upd({ rightBg: v }) }), _jsx(ColorInput, { label: "Stat bg", value: state.statBg, onChange: v => upd({ statBg: v }) }), _jsx(ColorInput, { label: "Stat border", value: state.statBorder, onChange: v => upd({ statBorder: v }) })] }), _jsx("p", { className: "section-label mt-3", children: "Left Column" }), _jsx(RichTextField, { label: "Label", value: tv(state.leftLabel, 'dcs2Label'), defaultKey: "dcs2Label", onChange: v => upd({ leftLabel: v }) }), _jsx(RichTextField, { label: "Title", value: tv(state.leftTitle, 'dcs2Title'), defaultKey: "dcs2Title", onChange: v => upd({ leftTitle: v }) }), state.leftParas.map((p, i) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Para ${i + 1}`, value: tv(p, 'dcs2Para'), defaultKey: "dcs2Para", multiline: true, onChange: v => { const a = [...state.leftParas]; a[i] = v; upd({ leftParas: a }); } }) }), _jsx("button", { onClick: () => upd({ leftParas: state.leftParas.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ leftParas: [...state.leftParas, normalize('', 'dcs2Para')] }), className: "btn-ghost text-xs w-full", children: "+ Add paragraph" }), _jsx("div", { className: "flex gap-2 items-center mt-2", children: _jsx(ColorInput, { label: "Bullet colour", value: state.bulletColor, onChange: v => upd({ bulletColor: v }) }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Bullet Points" }), state.leftBullets.map((b, i) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Bullet ${i + 1}`, value: tv(b, 'dcs2Bullet'), defaultKey: "dcs2Bullet", onChange: v => { const a = [...state.leftBullets]; a[i] = v; upd({ leftBullets: a }); } }) }), _jsx("button", { onClick: () => upd({ leftBullets: state.leftBullets.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ leftBullets: [...state.leftBullets, normalize('', 'dcs2Bullet')] }), className: "btn-ghost text-xs w-full", children: "+ Add bullet" }), _jsx("p", { className: "section-label mt-3", children: "Right Column \u2014 Stats" }), _jsx(RichTextField, { label: "Label", value: tv(state.rightLabel, 'dcs2RLabel'), defaultKey: "dcs2RLabel", onChange: v => upd({ rightLabel: v }) }), state.stats.map((st, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2 items-start", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsx(RichTextField, { label: "Value", value: tv(st.value, 'dcs2StatVal'), defaultKey: "dcs2StatVal", onChange: v => updStat(i, { value: v }) }), _jsx(RichTextField, { label: "Label", value: tv(st.label, 'dcs2StatLbl'), defaultKey: "dcs2StatLbl", onChange: v => updStat(i, { label: v }) })] }), _jsx("button", { onClick: () => upd({ stats: state.stats.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ stats: [...state.stats, { value: normalize('', 'dcs2StatVal'), label: normalize('', 'dcs2StatLbl') }] }), className: "btn-ghost text-xs w-full", children: "+ Add stat" }), _jsx("p", { className: "section-label mt-3", children: "Quote (optional)" }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-slate-600 mb-2 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: state.quoteShow, onChange: e => upd({ quoteShow: e.target.checked }) }), "Show quote block"] }), state.quoteShow && (_jsxs(_Fragment, { children: [_jsx(ColorInput, { label: "Quote bg", value: state.quoteBg, onChange: v => upd({ quoteBg: v }) }), _jsx(RichTextField, { label: "Quote text", value: tv(state.quoteText, 'dcs2Quote'), defaultKey: "dcs2Quote", multiline: true, onChange: v => upd({ quoteText: v }) }), _jsx(RichTextField, { label: "Attribution", value: tv(state.quoteAttrib, 'dcs2Attrib'), defaultKey: "dcs2Attrib", onChange: v => upd({ quoteAttrib: v }) })] }))] })] }));
}
function Dcs3Tab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDcs3());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-dcs3-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normDcs3(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makeDcs3());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `dcs3-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-dcs3-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-dcs3-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makeDcs3());
    }
    function updFeat(i, p) { const a = [...state.features]; a[i] = { ...a[i], ...p }; upd({ features: a }); }
    function updTag(i, p) { const a = [...state.tags]; a[i] = { ...a[i], ...p }; upd({ tags: a }); }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Two Column v3', generateDcs3Html(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Pad top", children: _jsx("input", { type: "number", className: "input", value: state.padTop, onChange: e => upd({ padTop: Number(e.target.value) }) }) }), _jsx(Field, { label: "Pad bot", children: _jsx("input", { type: "number", className: "input", value: state.padBot, onChange: e => upd({ padBot: Number(e.target.value) }) }) }), _jsx(Field, { label: "Left pad H", children: _jsx("input", { type: "number", className: "input", value: state.leftPadH, onChange: e => upd({ leftPadH: Number(e.target.value) }) }) }), _jsx(Field, { label: "Right pad H", children: _jsx("input", { type: "number", className: "input", value: state.rightPadH, onChange: e => upd({ rightPadH: Number(e.target.value) }) }) }), _jsx(Field, { label: "Left width %", children: _jsx("input", { type: "number", className: "input", min: 20, max: 80, value: state.leftWidth, onChange: e => upd({ leftWidth: Number(e.target.value) }) }) }), _jsx(Field, { label: "Feature cols", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: state.featCols, onChange: e => upd({ featCols: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Left bg", value: state.leftBg, onChange: v => upd({ leftBg: v }) }), _jsx(ColorInput, { label: "Right bg", value: state.rightBg, onChange: v => upd({ rightBg: v }) }), _jsx(ColorInput, { label: "Check colour", value: state.checkColor, onChange: v => upd({ checkColor: v }) }), _jsx(ColorInput, { label: "Feature bg", value: state.featBg, onChange: v => upd({ featBg: v }) })] }), _jsx("p", { className: "section-label mt-3", children: "Left Column" }), _jsx(RichTextField, { label: "Label", value: tv(state.leftLabel, 'dcs3Label'), defaultKey: "dcs3Label", onChange: v => upd({ leftLabel: v }) }), _jsx(RichTextField, { label: "Title", value: tv(state.leftTitle, 'dcs3Title'), defaultKey: "dcs3Title", onChange: v => upd({ leftTitle: v }) }), _jsx(RichTextField, { label: "Paragraph", value: tv(state.leftPara, 'dcs3Para'), defaultKey: "dcs3Para", multiline: true, onChange: v => upd({ leftPara: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Features" }), state.features.map((f, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsx(RichTextField, { label: "Title", value: tv(f.title, 'dcs3FeatTitle'), defaultKey: "dcs3FeatTitle", onChange: v => updFeat(i, { title: v }) }), _jsx(RichTextField, { label: "Desc", value: tv(f.desc, 'dcs3FeatDesc'), defaultKey: "dcs3FeatDesc", onChange: v => updFeat(i, { desc: v }) })] }), _jsx("button", { onClick: () => upd({ features: state.features.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ features: [...state.features, { title: normalize('', 'dcs3FeatTitle'), desc: normalize('', 'dcs3FeatDesc') }] }), className: "btn-ghost text-xs w-full", children: "+ Add feature" }), _jsx("p", { className: "section-label mt-3", children: "Right Column" }), _jsx(RichTextField, { label: "Label", value: tv(state.rightLabel, 'dcs3RLabel'), defaultKey: "dcs3RLabel", onChange: v => upd({ rightLabel: v }) }), _jsx(RichTextField, { label: "Title", value: tv(state.rightTitle, 'dcs3RTitle'), defaultKey: "dcs3RTitle", onChange: v => upd({ rightTitle: v }) }), _jsx(RichTextField, { label: "Paragraph", value: tv(state.rightPara, 'dcs3RPara'), defaultKey: "dcs3RPara", multiline: true, onChange: v => upd({ rightPara: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Tags" }), _jsx("div", { className: "flex gap-2 items-center mb-2", children: _jsx(Field, { label: "Tag bg (CSS colour)", children: _jsx("input", { className: "input", value: state.tagBg, onChange: e => upd({ tagBg: e.target.value }), placeholder: "#ffffff26" }) }) }), state.tags.map((tag, i) => (_jsxs("div", { className: "flex gap-2 items-center mb-1", children: [_jsx(Field, { label: "Icon", className: "w-20", children: _jsx("input", { className: "input text-center", value: tag.icon, onChange: e => updTag(i, { icon: e.target.value }) }) }), _jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: "Text", value: tv(tag.text, 'dcs3Tag'), defaultKey: "dcs3Tag", onChange: v => updTag(i, { text: v }) }) }), _jsx("button", { onClick: () => upd({ tags: state.tags.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ tags: [...state.tags, { icon: '🖥️', text: normalize('', 'dcs3Tag') }] }), className: "btn-ghost text-xs w-full", children: "+ Add tag" }), _jsx("p", { className: "section-label mt-3", children: "CTA Button" }), _jsx(Field, { label: "URL", children: _jsx("input", { className: "input", value: state.ctaUrl, onChange: e => upd({ ctaUrl: e.target.value }), placeholder: "/courses/" }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Text colour", value: state.ctaColor, onChange: v => upd({ ctaColor: v }) }), _jsx(ColorInput, { label: "Border colour", value: state.ctaBorder, onChange: v => upd({ ctaBorder: v }) }), _jsx(ColorInput, { label: "Fill colour", value: state.ctaFill, onChange: v => upd({ ctaFill: v }) })] }), _jsx(RichTextField, { label: "CTA text", value: tv(state.ctaText, 'dcs3Cta'), defaultKey: "dcs3Cta", onChange: v => upd({ ctaText: v }) })] })] }));
}
function ReachTab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeReach());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-reach-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normReach(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makeReach());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `reach-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-reach-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-reach-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makeReach());
    }
    function updStat(i, p) { const a = [...state.stats]; a[i] = { ...a[i], ...p }; upd({ stats: a }); }
    function updRegion(i, p) { const a = [...state.regions]; a[i] = { ...a[i], ...p }; upd({ regions: a }); }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Global Reach', generateReachHtml(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsx(PaddingRow, { value: state, onChange: upd }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Left width %", children: _jsx("input", { type: "number", className: "input", min: 20, max: 80, value: state.leftWidth, onChange: e => upd({ leftWidth: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Stat bg", value: state.statBg, onChange: v => upd({ statBg: v }) }), _jsx(ColorInput, { label: "Region bg", value: state.regionBg, onChange: v => upd({ regionBg: v }) })] }), _jsx("p", { className: "section-label mt-3", children: "Left Column \u2014 Text" }), _jsx(RichTextField, { label: "Label", value: tv(state.label, 'reachLabel'), defaultKey: "reachLabel", onChange: v => upd({ label: v }) }), _jsx(RichTextField, { label: "Title", value: tv(state.title, 'reachTitle'), defaultKey: "reachTitle", onChange: v => upd({ title: v }) }), _jsx(RichTextField, { label: "Paragraph", value: tv(state.para, 'reachPara'), defaultKey: "reachPara", multiline: true, onChange: v => upd({ para: v }) }), _jsx("p", { className: "section-label mt-3", children: "Right Column \u2014 Stats" }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Stats" }), state.stats.map((st, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-2 mb-2 flex gap-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsx(RichTextField, { label: "Value", value: tv(st.value, 'reachStatVal'), defaultKey: "reachStatVal", onChange: v => updStat(i, { value: v }) }), _jsx(RichTextField, { label: "Label", value: tv(st.label, 'reachStatLbl'), defaultKey: "reachStatLbl", onChange: v => updStat(i, { label: v }) })] }), _jsx("button", { onClick: () => upd({ stats: state.stats.filter((_, idx) => idx !== i) }), className: "btn-danger mt-6", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ stats: [...state.stats, { value: normalize('', 'reachStatVal'), label: normalize('', 'reachStatLbl') }] }), className: "btn-ghost text-xs w-full", children: "+ Add stat" }), _jsx("p", { className: "section-label mt-3", children: "Full-width \u2014 Regions Row" }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Regions" }), state.regions.map((r, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-2 mb-2", children: [_jsxs("div", { className: "flex gap-2 items-center mb-1", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-500 flex-1", children: ["Region ", i + 1] }), _jsx("button", { onClick: () => upd({ regions: state.regions.filter((_, idx) => idx !== i) }), className: "btn-danger text-xs", children: "\u2715" })] }), _jsxs("div", { className: "flex gap-2 mb-1", children: [_jsx(Field, { label: "Flag", className: "w-20", children: _jsx("input", { className: "input text-center text-lg", value: r.flag, onChange: e => updRegion(i, { flag: e.target.value }) }) }), _jsx(Field, { label: "Code", className: "flex-1", children: _jsx("input", { className: "input", value: r.code, placeholder: "UK", onChange: e => updRegion(i, { code: e.target.value }) }) })] }), _jsx(RichTextField, { label: "Name", value: tv(r.name, 'reachRegName'), defaultKey: "reachRegName", onChange: v => updRegion(i, { name: v }) }), _jsx(RichTextField, { label: "Sub-label", value: tv(r.sub, 'reachRegSub'), defaultKey: "reachRegSub", onChange: v => updRegion(i, { sub: v }) })] }, i))), _jsx("button", { onClick: () => upd({ regions: [...state.regions, { flag: '🌐', code: '', name: normalize('', 'reachRegName'), sub: normalize('', 'reachRegSub') }] }), className: "btn-ghost text-xs w-full", children: "+ Add region" }), _jsx("p", { className: "section-label mt-3", children: "Full-width \u2014 Image Block" }), _jsx(Field, { label: "Image URL", children: _jsx("input", { className: "input", value: state.imgUrl, placeholder: "https://\u2026", onChange: e => upd({ imgUrl: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Alt text", children: _jsx("input", { className: "input", value: state.imgAlt, onChange: e => upd({ imgAlt: e.target.value }) }) }), _jsx(Field, { label: "Height (px)", children: _jsx("input", { type: "number", className: "input", value: state.imgHeight, onChange: e => upd({ imgHeight: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Image bg", value: state.imgBg, onChange: v => upd({ imgBg: v }) }), _jsx(Field, { label: "Placeholder text", children: _jsx("input", { className: "input", value: state.imgPlaceholder, onChange: e => upd({ imgPlaceholder: e.target.value }) }) })] })] })] }));
}
function PhbTab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makePhb());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-page-hero-banner-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normPhb(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makePhb());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `phb-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-page-hero-banner-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-page-hero-banner-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makePhb());
    }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Hero Banner', generatePhbHtml(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsx(PaddingRow, { value: state, onChange: upd }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Border radius", children: _jsx("input", { type: "number", className: "input", min: 0, max: 40, value: state.radius, onChange: e => upd({ radius: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label mt-3", children: "Eyebrow" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: state.eyebrow, onChange: e => upd({ eyebrow: e.target.value }) }) }), _jsx(ColorInput, { label: "Eyebrow colour", value: state.eyebrowTc, onChange: v => upd({ eyebrowTc: v }) })] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-slate-600 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: state.showDot, onChange: e => upd({ showDot: e.target.checked }) }), "Show dot"] }), state.showDot && _jsx(ColorInput, { label: "Dot colour", value: state.dotColor, onChange: v => upd({ dotColor: v }) }), _jsx("p", { className: "section-label mt-3", children: "Heading" }), _jsx(RichTextField, { label: "Heading", value: tv(state.heading, 'phbHeading'), defaultKey: "phbHeading", onChange: v => upd({ heading: v }) }), _jsx("p", { className: "section-label mt-3", children: "Feature Bullets" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Bullet colour", value: state.bulletTc, onChange: v => upd({ bulletTc: v }) }), _jsx(ColorInput, { label: "Separator colour", value: state.sepColor, onChange: v => upd({ sepColor: v }) })] }), state.bullets.map((b, i) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input flex-1", value: b, onChange: e => { const a = [...state.bullets]; a[i] = e.target.value; upd({ bullets: a }); } }), _jsx("button", { onClick: () => upd({ bullets: state.bullets.filter((_, idx) => idx !== i) }), className: "btn-danger text-xs", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ bullets: [...state.bullets, ''] }), className: "btn-ghost text-xs w-full", children: "+ Add bullet" }), _jsx("p", { className: "section-label mt-3", children: "Badge Card (optional)" }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-slate-600 cursor-pointer mb-2", children: [_jsx("input", { type: "checkbox", checked: state.showBadge, onChange: e => upd({ showBadge: e.target.checked }) }), "Show badge card"] }), state.showBadge && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Card bg", value: state.badgeBg, onChange: v => upd({ badgeBg: v }) }), _jsx(Field, { label: "Border radius", children: _jsx("input", { type: "number", className: "input", min: 0, max: 30, value: state.badgeRadius, onChange: e => upd({ badgeRadius: Number(e.target.value) }) }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Badge eyebrow", children: _jsx("input", { className: "input", value: state.badgeEyebrow, onChange: e => upd({ badgeEyebrow: e.target.value }) }) }), _jsx(ColorInput, { label: "Eyebrow colour", value: state.badgeEyebrowTc, onChange: v => upd({ badgeEyebrowTc: v }) })] }), _jsx(RichTextField, { label: "Main value", value: tv(state.badgeMain, 'phbBadgeMain'), defaultKey: "phbBadgeMain", onChange: v => upd({ badgeMain: v }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Subtitle", children: _jsx("input", { className: "input", value: state.badgeSub, onChange: e => upd({ badgeSub: e.target.value }) }) }), _jsx(ColorInput, { label: "Subtitle colour", value: state.badgeSubTc, onChange: v => upd({ badgeSubTc: v }) })] })] }))] })] }));
}
function Phv2Tab({ onHtml }) {
    const [comps, setComps] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makePhv2());
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        api.get('/content/vls-page-hero-v2-components').then(row => {
            const raw = row?.data;
            const cs = (raw?.components || []).map((c) => ({ ...c, data: normPhv2(c.data || {}) }));
            setComps(cs);
            if (cs.length) {
                setActiveId(cs[0].id);
                setName(cs[0].name);
                setState(cs[0].data);
            }
            setLoaded(true);
        }).catch(() => setLoaded(true));
    }, []);
    const upd = useCallback((p) => { setState(prev => ({ ...prev, ...p })); setSaved(false); }, []);
    function load(id) {
        if (!id) {
            setActiveId(null);
            setName('');
            setState(makePhv2());
            setSaved(false);
            return;
        }
        const c = comps.find(c => c.id === id);
        if (c) {
            setActiveId(c.id);
            setName(c.name);
            setState(c.data);
            setSaved(false);
        }
    }
    async function save() {
        if (!name.trim()) {
            alert('Enter a component name.');
            return;
        }
        setSaving(true);
        const id = activeId || `phv2-${Date.now().toString(36)}`;
        const updated = activeId ? comps.map(c => c.id === id ? { id, name, data: state } : c) : [...comps, { id, name, data: state }];
        await api.put('/content/vls-page-hero-v2-components', { components: updated });
        setComps(updated);
        setActiveId(id);
        setSaved(true);
        setSaving(false);
    }
    async function del() {
        if (!activeId || !confirm('Delete?'))
            return;
        const updated = comps.filter(c => c.id !== activeId);
        await api.put('/content/vls-page-hero-v2-components', { components: updated });
        setComps(updated);
        setActiveId(null);
        setName('');
        setState(makePhv2());
    }
    function updCard(i, p) { const a = [...state.cards]; a[i] = { ...a[i], ...p }; upd({ cards: a }); }
    function updTrust(i, p) { const a = [...state.trustItems]; a[i] = { ...a[i], ...p }; upd({ trustItems: a }); }
    if (!loaded)
        return _jsx("div", { className: "p-5 text-xs text-slate-400", children: "Loading\u2026" });
    return (_jsxs("div", { className: "flex flex-col", children: [_jsx(CmpMgr, { components: comps, activeId: activeId, name: name, saving: saving, saved: saved, onSelect: load, onNew: () => load(''), onDelete: del, onNameChange: setName, onSave: save, onGenerate: () => onHtml(wrapGeneratedHtml('Hero Banner V2', generatePhv2Html(state))) }), _jsxs("div", { className: "px-5 py-4 space-y-1 overflow-y-auto", children: [_jsx("p", { className: "section-label", children: "Layout" }), _jsx(PaddingRow, { value: state, onChange: upd }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Background", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx(Field, { label: "Left width %", children: _jsx("input", { type: "number", className: "input", min: 30, max: 80, value: state.split, onChange: e => upd({ split: Number(e.target.value) }) }) }), _jsx(Field, { label: "Column gap (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 120, value: state.colGap, onChange: e => upd({ colGap: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label mt-3", children: "Left Column" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Breadcrumb", children: _jsx("input", { className: "input", value: state.breadcrumb, placeholder: "Home \u203A Section", onChange: e => upd({ breadcrumb: e.target.value }) }) }), _jsx(ColorInput, { label: "Breadcrumb colour", value: state.breadcrumbTc, onChange: v => upd({ breadcrumbTc: v }) }), _jsx(ColorInput, { label: "Eyebrow colour", value: state.eyebrowTc, onChange: v => upd({ eyebrowTc: v }) }), _jsx(ColorInput, { label: "Eyebrow dot colour", value: state.eyebrowDot, onChange: v => upd({ eyebrowDot: v }) })] }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Eyebrow Labels" }), state.eyebrowLabels.map((l, i) => (_jsxs("div", { className: "flex gap-2 items-center mb-1", children: [_jsx("input", { className: "input flex-1", value: l, onChange: e => { const a = [...state.eyebrowLabels]; a[i] = e.target.value; upd({ eyebrowLabels: a }); } }), _jsx("button", { onClick: () => upd({ eyebrowLabels: state.eyebrowLabels.filter((_, idx) => idx !== i) }), className: "btn-danger text-xs", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ eyebrowLabels: [...state.eyebrowLabels, ''] }), className: "btn-ghost text-xs w-full", children: "+ Add label" }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-3 mb-1", children: "Heading" }), _jsx(RichTextField, { label: "Heading (pre-accent)", value: tv(state.heading, 'phv2Heading'), defaultKey: "phv2Heading", onChange: v => upd({ heading: v }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Accent phrase", children: _jsx("input", { className: "input", value: state.headingAccent, onChange: e => upd({ headingAccent: e.target.value }) }) }), _jsx(ColorInput, { label: "Accent colour", value: state.headingAccentColor, onChange: v => upd({ headingAccentColor: v }) })] }), _jsx(Field, { label: "Post-accent text", children: _jsx("input", { className: "input", value: state.headingPost, onChange: e => upd({ headingPost: e.target.value }) }) }), _jsx(RichTextField, { label: "Description", value: tv(state.desc, 'phv2Desc'), defaultKey: "phv2Desc", multiline: true, onChange: v => upd({ desc: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Trust Strip" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Text colour", value: state.trustTc, onChange: v => upd({ trustTc: v }) }), _jsx(ColorInput, { label: "Dot colour", value: state.trustDot, onChange: v => upd({ trustDot: v }) })] }), state.trustItems.map((item, i) => (_jsxs("div", { className: "flex gap-2 items-center mb-1", children: [_jsx(Field, { label: "Icon", className: "w-20", children: _jsx("input", { className: "input text-center", value: item.icon, onChange: e => updTrust(i, { icon: e.target.value }) }) }), _jsx(Field, { label: "Text", className: "flex-1", children: _jsx("input", { className: "input", value: item.text, onChange: e => updTrust(i, { text: e.target.value }) }) }), _jsx("button", { onClick: () => upd({ trustItems: state.trustItems.filter((_, idx) => idx !== i) }), className: "btn-danger mt-5 text-xs", children: "\u2715" })] }, i))), _jsx("button", { onClick: () => upd({ trustItems: [...state.trustItems, { icon: '', text: '' }] }), className: "btn-ghost text-xs w-full", children: "+ Add trust item" }), _jsx("p", { className: "section-label mt-3", children: "Right Column \u2014 Cards" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Card bg", value: state.cardBg, onChange: v => upd({ cardBg: v }) }), _jsx(ColorInput, { label: "Card border", value: state.cardBorder, onChange: v => upd({ cardBorder: v }) }), _jsx(Field, { label: "Border radius", children: _jsx("input", { type: "number", className: "input", min: 0, max: 30, value: state.cardRadius, onChange: e => upd({ cardRadius: Number(e.target.value) }) }) }), _jsx(ColorInput, { label: "Value colour", value: state.cardVc, onChange: v => upd({ cardVc: v }) }), _jsx(ColorInput, { label: "Label colour", value: state.cardLc, onChange: v => upd({ cardLc: v }) })] }), state.cards.map((card, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3 mb-2", children: [_jsxs("div", { className: "flex gap-2 items-center mb-2", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-500 flex-1", children: ["Card ", i + 1] }), _jsx("button", { onClick: () => upd({ cards: state.cards.filter((_, idx) => idx !== i) }), className: "btn-danger text-xs", children: "\u2715" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-2", children: [_jsx(Field, { label: "Type", children: _jsxs("select", { className: "input", value: card.type, onChange: e => updCard(i, { type: e.target.value }), children: [_jsx("option", { value: "stat", children: "Stat (number + label)" }), _jsx("option", { value: "info", children: "Info (title + subtitle)" }), _jsx("option", { value: "tags", children: "Tags (title + tag list)" })] }) }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-slate-600 cursor-pointer mt-5", children: [_jsx("input", { type: "checkbox", checked: card.full, onChange: e => updCard(i, { full: e.target.checked }) }), "Full width"] })] }), _jsx(Field, { label: "Value / Title", children: _jsx("input", { className: "input", value: card.value, onChange: e => updCard(i, { value: e.target.value }) }) }), _jsx(Field, { label: "Label / Subtitle / Tags", children: _jsx("input", { className: "input", value: card.label, onChange: e => updCard(i, { label: e.target.value }) }) })] }, i))), _jsx("button", { onClick: () => upd({ cards: [...state.cards, { type: 'stat', full: false, value: '', label: '' }] }), className: "btn-ghost text-xs w-full", children: "+ Add card" })] })] }));
}
// ── Section titles ─────────────────────────────────────────────────────────────
const SECTION_TITLES = {
    'dcs': { title: 'Two Column v1', desc: 'Left text + right icon cards' },
    'dcs2': { title: 'Two Column v2', desc: 'Left text/bullets + right stats/quote' },
    'dcs3': { title: 'Two Column v3', desc: 'Left features + right tags/CTA' },
    'reach': { title: 'Global Reach', desc: 'Text + stats + world map + regions' },
    'hero-banner': { title: 'Hero Banner', desc: 'Eyebrow + heading + bullets + badge card' },
    'hero-banner-v2': { title: 'Hero Banner v2', desc: 'Two-column: text left + info cards right' },
};
// ── Main screen ────────────────────────────────────────────────────────────────
export default function FullScreenSections() {
    const { type } = useParams();
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    function handleHtml(html) { setPreviewHtml(html); setActiveTab('preview'); }
    const meta = SECTION_TITLES[type || ''] ?? { title: 'Full Screen Section', desc: '' };
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[520px] shrink-0 flex flex-col border-r border-slate-200 bg-white overflow-hidden", children: [_jsxs("div", { className: "shrink-0 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: meta.title }), meta.desc && _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: meta.desc })] }), _jsxs("div", { className: "flex-1 overflow-y-auto", children: [type === 'dcs' && _jsx(DcsTab, { onHtml: handleHtml }), type === 'dcs2' && _jsx(Dcs2Tab, { onHtml: handleHtml }), type === 'dcs3' && _jsx(Dcs3Tab, { onHtml: handleHtml }), type === 'reach' && _jsx(ReachTab, { onHtml: handleHtml }), type === 'hero-banner' && _jsx(PhbTab, { onHtml: handleHtml }), type === 'hero-banner-v2' && _jsx(Phv2Tab, { onHtml: handleHtml }), !type && _jsx("div", { className: "p-6 text-sm text-slate-400", children: "Select a section type from the sidebar." })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
