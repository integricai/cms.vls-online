import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateCfHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function makeDefault() {
    return {
        padTop: 24, padBot: 24, padLeft: 48, padRight: 48,
        bg: '#ffffff', border: '#e5e7eb', leftWidth: 55,
        label: normalize('GET IN TOUCH', 'cfLabel'),
        company: normalize('Vertex Learning Solutions Ltd', 'cfCompany'),
        address: normalize('Kemp House, 128 City Road, London, EC1V 2NX, United Kingdom', 'cfAddress'),
        items: [
            { icon: '📞', iconBg: '#1e3a5f', title: normalize('Call / WhatsApp', 'cfItemTitle'), value: normalize('+44 7446 426261', 'cfItemValue'), href: 'tel:+447446426261' },
            { icon: '✉️', iconBg: '#1e3a5f', title: normalize('Email us', 'cfItemTitle'), value: normalize('office@vls-online.com', 'cfItemValue'), href: 'mailto:office@vls-online.com' },
            { icon: '📍', iconBg: '#2d1f5e', title: normalize('Registered office', 'cfItemTitle'), value: normalize('London, United Kingdom', 'cfItemValue'), href: '' },
        ],
    };
}
function ColorPair({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: value, onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function ItemRow({ item, onRemove, onChange }) {
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "relative rounded-lg border border-slate-100 bg-slate-50 p-3 mb-2", children: [_jsx("button", { onClick: onRemove, className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: item.icon, placeholder: "\uD83D\uDCDE", onChange: e => onChange({ icon: e.target.value }) }) }), _jsx(ColorPair, { label: "Icon background", value: item.iconBg || '#1e3a5f', onChange: v => onChange({ iconBg: v }) })] }), _jsx(RichTextField, { label: "Title", value: asTV(item.title, 'cfItemTitle'), defaultKey: "cfItemTitle", onChange: v => onChange({ title: v }) }), _jsx(RichTextField, { label: "Value", value: asTV(item.value, 'cfItemValue'), defaultKey: "cfItemValue", onChange: v => onChange({ value: v }) }), _jsx(Field, { label: "Link URL", hint: "optional \u2014 tel:, mailto:, or https://", children: _jsx("input", { className: "input", value: item.href, placeholder: "tel:+447446426261", onChange: e => onChange({ href: e.target.value }) }) })] }));
}
export default function ContactFooter() {
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
        api.get('/content/vls-cf-components')
            .then(row => {
            const comps = row?.data?.components ?? [];
            setComponents(comps);
            if (comps.length > 0) {
                const first = comps[0];
                setActiveId(first.id);
                setName(first.name);
                setState(first.data || makeDefault());
            }
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    const updateState = useCallback((patch) => {
        setState(prev => ({ ...prev, ...patch }));
        setSaved(false);
    }, []);
    function updateItem(i, patch) {
        setState(prev => {
            const items = [...prev.items];
            items[i] = { ...items[i], ...patch };
            return { ...prev, items };
        });
        setSaved(false);
    }
    function addItem() {
        setState(prev => ({
            ...prev,
            items: [...prev.items, { icon: '📌', iconBg: '#1e3a5f', title: normalize('', 'cfItemTitle'), value: normalize('', 'cfItemValue'), href: '' }],
        }));
        setSaved(false);
    }
    function removeItem(i) {
        setState(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
        setSaved(false);
    }
    function loadComponent(id) {
        if (!id) {
            newComponent();
            return;
        }
        const comp = components.find(c => c.id === id);
        if (!comp)
            return;
        setActiveId(comp.id);
        setName(comp.name);
        setState(comp.data || makeDefault());
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
            alert('Please enter a component name before saving.');
            return;
        }
        setSaving(true);
        try {
            let id = activeId;
            let comps = [...components];
            if (id) {
                comps = comps.map(c => c.id === id ? { id, name, data: state } : c);
                if (!comps.find(c => c.id === id)) {
                    id = `cf-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `cf-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-cf-components', { components: comps });
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
        const comp = components.find(c => c.id === activeId);
        if (!window.confirm(`Delete "${comp?.name || 'this component'}"?`))
            return;
        const comps = components.filter(c => c.id !== activeId);
        await api.put('/content/vls-cf-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[460px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Contact Footer" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Two-column contact strip with icon items" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save Component' }), _jsx("button", { onClick: () => { setPreviewHtml(wrapGeneratedHtml('Contact Footer', generateCfHtml(state))); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. VLS \u2014 Contact Footer", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Section Styling" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding top (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padTop, onChange: e => updateState({ padTop: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding bottom (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: state.padBot, onChange: e => updateState({ padBot: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: state.padLeft, onChange: e => updateState({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: state.padRight, onChange: e => updateState({ padRight: Number(e.target.value) }) }) })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorPair, { label: "Background", value: state.bg, onChange: v => updateState({ bg: v }) }), _jsx(ColorPair, { label: "Border top", value: state.border, onChange: v => updateState({ border: v }) })] }), _jsx(Field, { label: "Left column width %", children: _jsx("select", { className: "input", value: String(state.leftWidth), onChange: e => updateState({ leftWidth: Number(e.target.value) }), children: [40, 45, 50, 55, 60].map(v => (_jsxs("option", { value: String(v), children: [v, " / ", 100 - v] }, v))) }) }), _jsx("p", { className: "section-label", children: "Left Column \u2014 Company Info" }), _jsx(RichTextField, { label: "Eyebrow label", value: asTV(state.label, 'cfLabel'), defaultKey: "cfLabel", onChange: v => updateState({ label: v }) }), _jsx(RichTextField, { label: "Company name", value: asTV(state.company, 'cfCompany'), defaultKey: "cfCompany", onChange: v => updateState({ company: v }) }), _jsx(RichTextField, { label: "Address / tagline", multiline: true, value: asTV(state.address, 'cfAddress'), defaultKey: "cfAddress", onChange: v => updateState({ address: v }) }), _jsx("p", { className: "section-label", children: "Right Column \u2014 Contact Items" }), state.items.map((item, i) => (_jsx(ItemRow, { item: item, onRemove: () => removeItem(i), onChange: p => updateItem(i, p) }, i))), _jsx("button", { onClick: addItem, className: "btn-ghost text-xs w-full mb-4", children: "+ Add contact item" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
