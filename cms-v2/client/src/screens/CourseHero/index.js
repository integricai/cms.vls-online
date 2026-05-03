import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateCourseHeroHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function makeDefault() {
    return {
        bg: '#0d1f3c',
        padTop: 48, padBot: 56, padLeft: 60, padRight: 60,
        breadcrumb: '',
        eyebrowTc: '#4a90d9', eyebrowDot: '#4a90d9',
        heading: normalize('', 'chHeading'),
        desc: normalize('', 'chDesc'),
        tags: [],
        pillBg: '#0f2744', pillBorder: '#1e3a5f', pillVc: '#ffffff', pillLc: '#94a3b8',
        pills: [],
        learnLabel: "WHAT YOU'LL LEARN",
        learnLabelTc: '#4a90d9', learnBg: '#132343', learnBorder: '#1e3a5f',
        learnCc: '#4a90d9', learnTitleTc: '#ffffff', learnSubTc: '#f97316',
        learnItems: [],
    };
}
function ColorRow({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
export default function CourseHeroScreen() {
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
        api.get('/content/vls-course-hero-components')
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
                    id = `ch-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `ch-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-course-hero-components', { components: comps });
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
        await api.put('/content/vls-course-hero-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function generate() { setPreviewHtml(wrapGeneratedHtml('Left Hero', generateCourseHeroHtml(state))); setActiveTab('preview'); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    function asTV(v, key) { return normalize(v, key); }
    function updateTag(i, val) {
        const tags = [...state.tags];
        tags[i] = val;
        upd({ tags });
    }
    function addTag() { upd({ tags: [...state.tags, ''] }); }
    function removeTag(i) { upd({ tags: state.tags.filter((_, idx) => idx !== i) }); }
    function updatePill(i, patch) {
        const pills = [...state.pills];
        pills[i] = { ...pills[i], ...patch };
        upd({ pills });
    }
    function addPill() { upd({ pills: [...state.pills, { icon: '', value: '', label: '' }] }); }
    function removePill(i) { upd({ pills: state.pills.filter((_, idx) => idx !== i) }); }
    function updateLearn(i, patch) {
        const items = [...state.learnItems];
        items[i] = { ...items[i], ...patch };
        upd({ learnItems: items });
    }
    function addLearn() { upd({ learnItems: [...state.learnItems, { title: '', subtitle: '', fullWidth: false }] }); }
    function removeLearn(i) { upd({ learnItems: state.learnItems.filter((_, idx) => idx !== i) }); }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Left Hero Section" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Course page hero \u2014 left column content" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. FA1 Course Hero", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Background & Layout" }), _jsx(ColorRow, { label: "Background colour", value: state.bg, onChange: v => upd({ bg: v }) }), _jsx("div", { className: "grid grid-cols-2 gap-2", children: ['padTop', 'padBot', 'padLeft', 'padRight'].map(k => (_jsx(Field, { label: k.replace('pad', 'Pad ').replace('Top', 'top').replace('Bot', 'bottom').replace('Left', 'left').replace('Right', 'right') + ' (px)', children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: state[k], onChange: e => upd({ [k]: Number(e.target.value) }) }) }, k))) }), _jsx("p", { className: "section-label", children: "Breadcrumb" }), _jsx(Field, { label: "Breadcrumb trail", hint: "optional", children: _jsx("input", { className: "input", value: state.breadcrumb, placeholder: "Home \u203A ACCA Courses \u203A FA1", onChange: e => upd({ breadcrumb: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Eyebrow Tags" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorRow, { label: "Tag colour", value: state.eyebrowTc, onChange: v => upd({ eyebrowTc: v }) }), _jsx(ColorRow, { label: "Dot colour", value: state.eyebrowDot, onChange: v => upd({ eyebrowDot: v }) })] }), _jsx("div", { className: "space-y-1.5 mb-2", children: state.tags.map((tag, i) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input flex-1", value: tag, placeholder: "e.g. ACCA", onChange: e => updateTag(i, e.target.value) }), _jsx("button", { onClick: () => removeTag(i), className: "btn-danger", children: "\u2715" })] }, i))) }), _jsx("button", { onClick: addTag, className: "btn-ghost text-xs w-full mb-1", children: "+ Add tag" }), _jsx("p", { className: "section-label", children: "Heading & Description" }), _jsx(RichTextField, { label: "Heading", value: asTV(state.heading, 'chHeading'), defaultKey: "chHeading", onChange: v => upd({ heading: v }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: asTV(state.desc, 'chDesc'), defaultKey: "chDesc", onChange: v => upd({ desc: v }) }), _jsx("p", { className: "section-label", children: "Feature Pills" }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-2", children: [_jsx(ColorRow, { label: "Pill background", value: state.pillBg, onChange: v => upd({ pillBg: v }) }), _jsx(ColorRow, { label: "Pill border", value: state.pillBorder, onChange: v => upd({ pillBorder: v }) }), _jsx(ColorRow, { label: "Value colour", value: state.pillVc, onChange: v => upd({ pillVc: v }) }), _jsx(ColorRow, { label: "Label colour", value: state.pillLc, onChange: v => upd({ pillLc: v }) })] }), _jsx("div", { className: "space-y-2 mb-2", children: state.pills.map((pill, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-2", children: [_jsx("button", { onClick: () => removePill(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsxs("div", { className: "grid grid-cols-3 gap-1.5", children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: pill.icon, placeholder: "\uD83D\uDCC5", onChange: e => updatePill(i, { icon: e.target.value }) }) }), _jsx(Field, { label: "Value (bold)", children: _jsx("input", { className: "input", value: pill.value, placeholder: "12 weeks", onChange: e => updatePill(i, { value: e.target.value }) }) }), _jsx(Field, { label: "Label", children: _jsx("input", { className: "input", value: pill.label, placeholder: "Duration", onChange: e => updatePill(i, { label: e.target.value }) }) })] })] }, i))) }), _jsx("button", { onClick: addPill, className: "btn-ghost text-xs w-full mb-1", children: "+ Add pill" }), _jsx("p", { className: "section-label", children: "What You'll Learn" }), _jsx(Field, { label: "Section label", children: _jsx("input", { className: "input", value: state.learnLabel, onChange: e => upd({ learnLabel: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2 mb-2", children: [_jsx(ColorRow, { label: "Label colour", value: state.learnLabelTc, onChange: v => upd({ learnLabelTc: v }) }), _jsx(ColorRow, { label: "Card background", value: state.learnBg, onChange: v => upd({ learnBg: v }) }), _jsx(ColorRow, { label: "Card border", value: state.learnBorder, onChange: v => upd({ learnBorder: v }) }), _jsx(ColorRow, { label: "Check mark colour", value: state.learnCc, onChange: v => upd({ learnCc: v }) }), _jsx(ColorRow, { label: "Title colour", value: state.learnTitleTc, onChange: v => upd({ learnTitleTc: v }) }), _jsx(ColorRow, { label: "Subtitle colour", value: state.learnSubTc, onChange: v => upd({ learnSubTc: v }) })] }), _jsx("div", { className: "space-y-2 mb-2", children: state.learnItems.map((item, i) => (_jsxs("div", { className: "relative rounded border border-slate-200 bg-slate-50 p-2", children: [_jsx("button", { onClick: () => removeLearn(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: item.title, placeholder: "Learn item title", onChange: e => updateLearn(i, { title: e.target.value }) }) }), _jsx(Field, { label: "Subtitle (optional)", children: _jsx("input", { className: "input", value: item.subtitle, placeholder: "Additional detail", onChange: e => updateLearn(i, { subtitle: e.target.value }) }) }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-500 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: item.fullWidth, onChange: e => updateLearn(i, { fullWidth: e.target.checked }) }), "Full width (spans both columns)"] })] }, i))) }), _jsx("button", { onClick: addLearn, className: "btn-ghost text-xs w-full mb-4", children: "+ Add learn item" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
