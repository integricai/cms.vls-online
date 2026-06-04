import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateHeaderHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
let ctaCounter = 0;
let menuCounter = 0;
function makeDefault() {
    return {
        logoUrl: '', logoAlt: 'VLS Online', logoLink: '/', logoHeight: 56,
        siteTitle: normalize('Vertex Language Solutions', 'headerSiteTitle'),
        subTitle: normalize('', 'headerSubTitle'),
        topbarBg: '#ffffff', topbarText: '#262a32',
        brandBg: '#ffffff', menuBg: '#ffffff',
        menuText: '#204280', menuHover: '#f0f4ff',
        dropBg: '#ffffff', dropText: '#262a32',
        containerWidth: 1280,
        padLeft: 24, padRight: 24, padTop: 8, padBottom: 8, dropSpacing: 10,
        ctas: [], menuItems: [], useZenMenu: false,
    };
}
function newCta() {
    return { id: `hc${++ctaCounter}`, label: normalize('', 'headerCta'), url: '', bgColor: '#204280', textColor: '#ffffff', newTab: false };
}
function newMenuItem() {
    return { id: `hm${++menuCounter}`, label: normalize('', 'headerMenu'), url: '#', newTab: false, children: [] };
}
function ColorInput({ label, value, onChange }) {
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-500 mb-1", children: label }), _jsx("input", { type: "color", value: value, onChange: e => onChange(e.target.value), className: "w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" })] }));
}
function Accordion({ title, defaultOpen = false, children }) {
    const [open, setOpen] = useState(defaultOpen);
    return (_jsxs("div", { className: "rounded-lg border border-slate-200 mb-2 overflow-hidden", children: [_jsxs("button", { onClick: () => setOpen(o => !o), className: "flex w-full items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition text-left", children: [_jsx("span", { className: "text-sm font-semibold text-slate-700", children: title }), _jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: `h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`, children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) })] }), open && _jsx("div", { className: "px-4 py-3", children: children })] }));
}
function MenuItemRow({ item, depth, onUpdate, onDelete, onAddChild }) {
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: `rounded border border-slate-200 bg-white p-2 mb-1.5 ${depth > 0 ? 'ml-6 border-l-2 border-l-brand/30' : ''}`, children: [_jsxs("div", { className: "flex gap-2 items-end mb-1", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: "Label", value: asTV(item.label, 'headerMenu'), defaultKey: "headerMenu", onChange: v => onUpdate({ label: v }) }) }), _jsx("div", { className: "flex-1", children: _jsx(Field, { label: "URL", children: _jsx("input", { className: "input", value: item.url, onChange: e => onUpdate({ url: e.target.value }) }) }) }), _jsxs("div", { className: "flex gap-1", children: [depth === 0 && (_jsx("button", { onClick: onAddChild, title: "Add child item", className: "px-2 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded text-slate-600 border border-slate-200", children: "+ Child" })), _jsx("button", { onClick: onDelete, className: "btn-danger", children: "\u2715" })] })] }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-500 cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: item.newTab, onChange: e => onUpdate({ newTab: e.target.checked }) }), "Open in new tab"] })] }));
}
export function HeaderEditor({ title = 'Header', subtitle = 'Site header with logo, navigation and CTAs', contentKey = 'vls-header-config', generateHtml = generateHeaderHtml, commentName = 'Header', publicPublishPath = '/publish-header' } = {}) {
    const [cfg, setCfg] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    useEffect(() => {
        api.get(`/content/${contentKey}`)
            .then(row => {
            const c = row?.data?.config;
            if (c)
                setCfg(c);
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [contentKey]);
    const update = useCallback((patch) => {
        setCfg(prev => ({ ...prev, ...patch }));
        setSaved(false);
    }, []);
    function addCta() {
        if (cfg.ctas.length >= 2)
            return;
        update({ ctas: [...cfg.ctas, newCta()] });
    }
    function updateCta(id, patch) {
        update({ ctas: cfg.ctas.map(c => c.id === id ? { ...c, ...patch } : c) });
    }
    function deleteCta(id) {
        update({ ctas: cfg.ctas.filter(c => c.id !== id) });
    }
    function addMenuItem() {
        update({ menuItems: [...cfg.menuItems, newMenuItem()] });
    }
    function updateMenuItem(id, patch) {
        function doUpdate(items) {
            return items.map(it => it.id === id
                ? { ...it, ...patch }
                : { ...it, children: doUpdate(it.children) });
        }
        update({ menuItems: doUpdate(cfg.menuItems) });
    }
    function addChildMenuItem(parentId) {
        const child = newMenuItem();
        function doAdd(items) {
            return items.map(it => it.id === parentId
                ? { ...it, children: [...it.children, child] }
                : { ...it, children: doAdd(it.children) });
        }
        update({ menuItems: doAdd(cfg.menuItems) });
    }
    function deleteMenuItem(id) {
        function doDel(items) {
            return items.filter(it => it.id !== id).map(it => ({ ...it, children: doDel(it.children) }));
        }
        update({ menuItems: doDel(cfg.menuItems) });
    }
    async function save() {
        setSaving(true);
        try {
            await api.put(`/content/${contentKey}`, { config: cfg });
            if (publicPublishPath) {
                await api.post(publicPublishPath, { config: cfg });
            }
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    function generate() {
        setPreviewHtml(wrapGeneratedHtml(commentName, generateHtml(cfg)));
        setActiveTab('preview');
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    function asTV(v, key) { return normalize(v, key); }
    function renderMenuItems(items, depth) {
        return items.map(item => (_jsxs("div", { children: [_jsx(MenuItemRow, { item: item, depth: depth, onUpdate: p => updateMenuItem(item.id, p), onDelete: () => deleteMenuItem(item.id), onAddChild: () => addChildMenuItem(item.id) }), item.children.length > 0 && (_jsx("div", { children: renderMenuItems(item.children, depth + 1) }))] }, item.id)));
    }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: title }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: subtitle })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs(Accordion, { title: "Logo", defaultOpen: true, children: [_jsx(Field, { label: "Logo image URL", children: _jsx("input", { className: "input", value: cfg.logoUrl, placeholder: "https://...", onChange: e => update({ logoUrl: e.target.value }) }) }), _jsx(Field, { label: "Alt text", children: _jsx("input", { className: "input", value: cfg.logoAlt, onChange: e => update({ logoAlt: e.target.value }) }) }), _jsx(Field, { label: "Logo link URL", children: _jsx("input", { className: "input", value: cfg.logoLink, onChange: e => update({ logoLink: e.target.value }) }) }), _jsx(Field, { label: "Logo height (px)", children: _jsx("input", { type: "number", className: "input", min: 20, max: 120, value: cfg.logoHeight, onChange: e => update({ logoHeight: Number(e.target.value) }) }) })] }), _jsxs(Accordion, { title: "Site Title", defaultOpen: true, children: [_jsx(RichTextField, { label: "Site title text", value: asTV(cfg.siteTitle, 'headerSiteTitle'), defaultKey: "headerSiteTitle", onChange: v => update({ siteTitle: v }) }), _jsx(RichTextField, { label: "Sub-title / strapline", value: asTV(cfg.subTitle, 'headerSubTitle'), defaultKey: "headerSubTitle", onChange: v => update({ subTitle: v }) })] }), _jsx(Accordion, { title: "Colours", children: _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsx(ColorInput, { label: "Brand bar BG", value: cfg.brandBg, onChange: v => update({ brandBg: v }) }), _jsx(ColorInput, { label: "Menu bar BG", value: cfg.menuBg, onChange: v => update({ menuBg: v }) }), _jsx(ColorInput, { label: "Menu text", value: cfg.menuText, onChange: v => update({ menuText: v }) }), _jsx(ColorInput, { label: "Menu hover BG", value: cfg.menuHover, onChange: v => update({ menuHover: v }) }), _jsx(ColorInput, { label: "Dropdown BG", value: cfg.dropBg, onChange: v => update({ dropBg: v }) }), _jsx(ColorInput, { label: "Dropdown text", value: cfg.dropText, onChange: v => update({ dropText: v }) })] }) }), _jsxs(Accordion, { title: "Layout & Spacing", children: [_jsx(Field, { label: "Container width (px)", hint: "must match your page container", children: _jsx("input", { type: "number", className: "input", min: 600, max: 2400, value: cfg.containerWidth, onChange: e => update({ containerWidth: Number(e.target.value) }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: cfg.padLeft, onChange: e => update({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 300, value: cfg.padRight, onChange: e => update({ padRight: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding top (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 80, value: cfg.padTop, onChange: e => update({ padTop: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding bottom (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 80, value: cfg.padBottom, onChange: e => update({ padBottom: Number(e.target.value) }) }) })] }), _jsx(Field, { label: "Submenu item spacing (px)", children: _jsx("input", { type: "number", className: "input", min: 2, max: 24, value: cfg.dropSpacing, onChange: e => update({ dropSpacing: Number(e.target.value) }) }) })] }), _jsxs(Accordion, { title: "Call to Actions (max 2)", children: [_jsx("div", { className: "space-y-3", children: cfg.ctas.map(cta => (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-3", children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-500", children: ["CTA ", cfg.ctas.indexOf(cta) + 1] }), _jsx("button", { onClick: () => deleteCta(cta.id), className: "btn-danger text-xs", children: "Remove" })] }), _jsx(RichTextField, { label: "Button text", value: asTV(cta.label, 'headerCta'), defaultKey: "headerCta", onChange: v => updateCta(cta.id, { label: v }) }), _jsx(Field, { label: "URL", children: _jsx("input", { className: "input", value: cta.url, placeholder: "https://...", onChange: e => updateCta(cta.id, { url: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-500 mb-1", children: "Button BG" }), _jsx("input", { type: "color", value: cta.bgColor, onChange: e => updateCta(cta.id, { bgColor: e.target.value }), className: "w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-xs font-medium text-slate-500 mb-1", children: "Text colour" }), _jsx("input", { type: "color", value: cta.textColor, onChange: e => updateCta(cta.id, { textColor: e.target.value }), className: "w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" })] })] }), _jsxs("label", { className: "flex items-center gap-2 text-xs text-slate-500 cursor-pointer mt-1", children: [_jsx("input", { type: "checkbox", checked: cta.newTab, onChange: e => updateCta(cta.id, { newTab: e.target.checked }) }), "Open in new tab"] })] }, cta.id))) }), cfg.ctas.length < 2 && (_jsx("button", { onClick: addCta, className: "btn-ghost text-xs w-full mt-2", children: "+ Add CTA" }))] }), _jsxs(Accordion, { title: "Navigation Menu", children: [_jsxs("div", { className: "mb-3 rounded bg-blue-50 border border-blue-200 p-3", children: [_jsxs("label", { className: "flex items-center gap-2 cursor-pointer text-sm font-semibold text-blue-800", children: [_jsx("input", { type: "checkbox", checked: cfg.useZenMenu, onChange: e => update({ useZenMenu: e.target.checked }) }), "Use Zenler's live navigation (auto-sync)"] }), _jsx("p", { className: "text-xs text-slate-500 mt-1 ml-5 leading-relaxed", children: "When enabled, the snippet reads the navigation directly from Zenler's DOM. Menu items below are saved as fallback." })] }), _jsxs("div", { className: cfg.useZenMenu ? 'opacity-50 pointer-events-none' : '', children: [renderMenuItems(cfg.menuItems, 0), _jsx("button", { onClick: addMenuItem, className: "btn-ghost text-xs w-full mt-1", children: "+ Add menu item" })] })] })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}

export default function HeaderScreen() {
    return _jsx(HeaderEditor, {});
}
