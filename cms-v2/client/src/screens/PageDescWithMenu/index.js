import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generatePageDescWithMenuHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function makeDefault() {
    return {
        menuTitle: 'In this guide',
        menuBg: '#f9fafb',
        menuItemTc: '#374151',
        menuActiveBg: '#204280',
        menuActiveTc: '#ffffff',
        menuItems: [],
        icon: '📖',
        title: '',
        titleTc: '#1a1a1a',
        titleSize: 14,
        introBold: normalize('', 'cdescIntroBold'),
        introP1: normalize('', 'cdescDesc'),
        introP2: normalize('', 'cdescDesc'),
        blocks: [],
    };
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function newBlock(type) {
    switch (type) {
        case 'paragraph': return { type, p: normalize('', 'cdescDesc') };
        case 'heading-paragraph': return { type, h: normalize('', 'cdescHeading'), p: normalize('', 'cdescDesc') };
        case 'heading-bullets': return { type, h: normalize('', 'cdescHeading'), bullets: [normalize('', 'cdescBullet')] };
        case 'bullets': return { type, bullets: [normalize('', 'cdescBullet')] };
        case 'items': return { type, h: normalize('', 'cdescHeading'), items: [{ h: normalize('', 'cdescItemHeading'), p: normalize('', 'cdescDesc') }] };
        case 'note': return { type, p: normalize('', 'cdescNote') };
    }
}
const BLOCK_LABELS = {
    paragraph: 'Paragraph',
    'heading-paragraph': 'Heading + Paragraph',
    'heading-bullets': 'Heading + Bullets',
    bullets: 'Bullets only',
    items: 'Item list (heading per item)',
    note: 'Note / callout',
};
function BlockEditor({ block, onUpdate, onRemove }) {
    const [open, setOpen] = useState(true);
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "rounded border border-slate-200 bg-white mb-2", children: [_jsxs("div", { className: "flex items-center justify-between px-3 py-2 bg-slate-50 cursor-pointer", onClick: () => setOpen(o => !o), children: [_jsx("span", { className: "text-xs font-semibold text-slate-600", children: BLOCK_LABELS[block.type] }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("button", { onClick: e => { e.stopPropagation(); onRemove(); }, className: "btn-danger text-xs", children: "\u2715" }), _jsx("svg", { viewBox: "0 0 20 20", fill: "currentColor", className: `h-3.5 w-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`, children: _jsx("path", { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" }) })] })] }), open && (_jsxs("div", { className: "px-3 py-2", children: [(block.type === 'heading-paragraph' || block.type === 'heading-bullets' || block.type === 'items') && (_jsx(RichTextField, { label: "Heading", value: asTV(block.h ?? '', 'cdescHeading'), defaultKey: "cdescHeading", onChange: v => onUpdate({ ...block, h: v }) })), (block.type === 'paragraph' || block.type === 'heading-paragraph') && (_jsx(RichTextField, { label: "Paragraph text", multiline: true, value: asTV(block.p ?? '', 'cdescDesc'), defaultKey: "cdescDesc", onChange: v => onUpdate({ ...block, p: v }) })), block.type === 'note' && (_jsx(RichTextField, { label: "Note text", multiline: true, value: asTV(block.p ?? '', 'cdescNote'), defaultKey: "cdescNote", onChange: v => onUpdate({ ...block, p: v }) })), (block.type === 'heading-bullets' || block.type === 'bullets') && (_jsxs("div", { children: [_jsx("span", { className: "text-xs font-medium text-slate-500", children: "Bullet items" }), _jsx("div", { className: "space-y-1 mt-1", children: (block.bullets ?? []).map((b, bi) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("div", { className: "flex-1", children: _jsx(RichTextField, { label: `Bullet ${bi + 1}`, value: asTV(b, 'cdescBullet'), defaultKey: "cdescBullet", onChange: v => { const bullets = [...(block.bullets ?? [])]; bullets[bi] = v; onUpdate({ ...block, bullets }); } }) }), _jsx("button", { onClick: () => { const bullets = (block.bullets ?? []).filter((_, idx) => idx !== bi); onUpdate({ ...block, bullets }); }, className: "btn-danger mt-5", children: "\u2715" })] }, bi))) }), _jsx("button", { onClick: () => onUpdate({ ...block, bullets: [...(block.bullets ?? []), normalize('', 'cdescBullet')] }), className: "btn-ghost text-xs w-full mt-1", children: "+ Add bullet" })] })), block.type === 'items' && (_jsxs("div", { children: [_jsx("span", { className: "text-xs font-medium text-slate-500", children: "Items" }), _jsx("div", { className: "space-y-2 mt-1", children: (block.items ?? []).map((item, ii) => (_jsxs("div", { className: "rounded border border-slate-100 bg-slate-50 p-2 relative", children: [_jsx("button", { onClick: () => { const items = (block.items ?? []).filter((_, idx) => idx !== ii); onUpdate({ ...block, items }); }, className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(RichTextField, { label: "Item heading", value: asTV(item.h, 'cdescItemHeading'), defaultKey: "cdescItemHeading", onChange: v => { const items = [...(block.items ?? [])]; items[ii] = { ...items[ii], h: v }; onUpdate({ ...block, items }); } }), _jsx(RichTextField, { label: "Item text", multiline: true, value: asTV(item.p, 'cdescDesc'), defaultKey: "cdescDesc", onChange: v => { const items = [...(block.items ?? [])]; items[ii] = { ...items[ii], p: v }; onUpdate({ ...block, items }); } })] }, ii))) }), _jsx("button", { onClick: () => onUpdate({ ...block, items: [...(block.items ?? []), { h: normalize('', 'cdescItemHeading'), p: normalize('', 'cdescDesc') }] }), className: "btn-ghost text-xs w-full mt-1", children: "+ Add item" })] }))] }))] }));
}
export default function PageDescWithMenuScreen() {
    const [components, setComponents] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const [addBlockType, setAddBlockType] = useState('paragraph');
    useEffect(() => {
        api.get('/content/vls-page-desc-menu-components')
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
    function duplicateComponent() {
        setActiveId(`pdm-${Date.now().toString(36)}`);
        setName(`Copy of ${name || 'Page Description'}`);
        setState(clone(state));
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
                    id = `pdm-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `pdm-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-page-desc-menu-components', { components: comps });
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
        await api.put('/content/vls-page-desc-menu-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    function generate() {
        const html = wrapGeneratedHtml('Page Description with Menu', generatePageDescWithMenuHtml(state));
        setPreviewHtml(html);
        setActiveTab('preview');
    }
    function updateBlock(i, b) {
        const blocks = [...state.blocks];
        blocks[i] = b;
        upd({ blocks });
    }
    function removeBlock(i) { upd({ blocks: state.blocks.filter((_, idx) => idx !== i) }); }
    function addBlock() { upd({ blocks: [...state.blocks, newBlock(addBlockType)] }); }
    function patchMenuItem(i, patch) {
        const menuItems = [...state.menuItems];
        menuItems[i] = { ...menuItems[i], ...patch };
        upd({ menuItems });
    }
    function removeMenuItem(i) { upd({ menuItems: state.menuItems.filter((_, idx) => idx !== i) }); }
    function addMenuItem() { upd({ menuItems: [...state.menuItems, { title: '', scrollTarget: '' }] }); }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    function asTV(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Page Description with Menu" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Course-description layout with left sidebar navigation" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generate, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3 mb-4", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Components" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), _jsx("button", { onClick: duplicateComponent, disabled: !name && state.blocks.length === 0, className: "btn-ghost text-xs px-3", children: "Duplicate" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Component name", children: _jsx("input", { className: "input", value: name, placeholder: "e.g. FA1 Course Guide", onChange: e => setName(e.target.value) }) })] }), _jsx("p", { className: "section-label", children: "Section Header" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Icon (emoji)", children: _jsx("input", { className: "input", value: state.icon, placeholder: "\uD83D\uDCD6", onChange: e => upd({ icon: e.target.value }) }) }), _jsx(Field, { label: "Title size (px)", children: _jsx("input", { type: "number", className: "input", min: 10, max: 36, value: state.titleSize, onChange: e => upd({ titleSize: Number(e.target.value) }) }) })] }), _jsx(Field, { label: "Title text", children: _jsx("input", { className: "input", value: state.title, placeholder: "About This Course", onChange: e => upd({ title: e.target.value }) }) }), _jsx(Field, { label: "Title colour", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(state.titleTc) ? state.titleTc : '#1a1a1a', onChange: e => upd({ titleTc: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: state.titleTc, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                                                upd({ titleTc: e.target.value }); } })] }) }), _jsx("p", { className: "section-label", children: "Sidebar Menu" }), _jsx(Field, { label: "Menu section title", hint: "Shown above nav items, e.g. 'In this guide'", children: _jsx("input", { className: "input", value: state.menuTitle, placeholder: "In this guide", onChange: e => upd({ menuTitle: e.target.value }) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Menu background", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(state.menuBg) ? state.menuBg : '#f9fafb', onChange: e => upd({ menuBg: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: state.menuBg, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                                                        upd({ menuBg: e.target.value }); } })] }) }), _jsx(Field, { label: "Item hover colour", children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(state.menuActiveBg) ? state.menuActiveBg : '#204280', onChange: e => upd({ menuActiveBg: e.target.value }), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: state.menuActiveBg, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                                                        upd({ menuActiveBg: e.target.value }); } })] }) })] }), _jsx("p", { className: "section-label mt-4", children: "Menu Items" }), _jsx("p", { className: "text-xs text-slate-400 mb-3", children: "Each item scrolls to a section on the page. Use a CSS class or ID as the scroll target." }), state.menuItems.map((item, i) => (_jsxs("div", { className: "rounded border border-slate-200 bg-white p-3 mb-2", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("span", { className: "text-xs font-semibold text-slate-600", children: ["Item ", i + 1] }), _jsx("button", { onClick: () => removeMenuItem(i), className: "btn-danger text-xs", children: "\u2715" })] }), _jsx(Field, { label: "Link title", children: _jsx("input", { className: "input", value: item.title, placeholder: "Overview", onChange: e => patchMenuItem(i, { title: e.target.value }) }) }), _jsx(Field, { label: "Scroll target", hint: "CSS selector \u2014 e.g. .section-overview or #overview", children: _jsx("input", { className: "input", value: item.scrollTarget, placeholder: ".section-overview or #overview", onChange: e => patchMenuItem(i, { scrollTarget: e.target.value }) }) })] }, i))), _jsx("button", { onClick: addMenuItem, className: "btn-ghost text-xs w-full mb-4", children: "+ Add menu item" }), _jsx("p", { className: "section-label", children: "Always-visible Intro" }), _jsx(RichTextField, { label: "Bold intro paragraph", multiline: true, value: asTV(state.introBold, 'cdescIntroBold'), defaultKey: "cdescIntroBold", onChange: v => upd({ introBold: v }) }), _jsx(RichTextField, { label: "Intro paragraph 1", multiline: true, value: asTV(state.introP1, 'cdescDesc'), defaultKey: "cdescDesc", onChange: v => upd({ introP1: v }) }), _jsx(RichTextField, { label: "Intro paragraph 2", multiline: true, value: asTV(state.introP2, 'cdescDesc'), defaultKey: "cdescDesc", onChange: v => upd({ introP2: v }) }), _jsx("p", { className: "section-label", children: "Expandable Blocks" }), _jsx("p", { className: "text-xs text-slate-400 mb-3", children: "These blocks are hidden behind \"Read more\"." }), state.blocks.map((block, i) => (_jsx(BlockEditor, { block: block, onUpdate: b => updateBlock(i, b), onRemove: () => removeBlock(i) }, i))), _jsxs("div", { className: "flex gap-2 mt-2", children: [_jsx("select", { className: "input flex-1", value: addBlockType, onChange: e => setAddBlockType(e.target.value), children: Object.keys(BLOCK_LABELS).map(t => (_jsx("option", { value: t, children: BLOCK_LABELS[t] }, t))) }), _jsx("button", { onClick: addBlock, className: "btn-ghost text-xs px-4", children: "+ Add block" })] })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;padding:24px;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
