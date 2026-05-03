import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { generateLegalPageHtml } from './generateHtml';
import Field from '../../components/Field';
const BLOCK_TYPES = [
    { value: 'paragraph', label: 'Paragraph' },
    { value: 'bullets', label: 'Bullets' },
    { value: 'table', label: 'Table' },
    { value: 'cards', label: 'Info Cards' },
    { value: 'rights', label: 'Rights Cards' },
    { value: 'definitions', label: 'Definitions' },
    { value: 'alpha-list', label: 'Alpha List (A, B, C…)' },
    { value: 'tags', label: 'Tag Chips' },
    { value: 'icon-cards', label: 'Icon Cards' },
    { value: 'link-cards', label: 'Link Cards' },
    { value: 'cta-banner', label: 'CTA Banner' },
    { value: 'callout', label: 'Callout Box' },
];
function makeDefault() {
    return { hdrBg: '#0d1f3c', eyebrow: '', title: '', navWidth: 220, navBg: '#f8fafc', accent: '#1a56a3', meta: [], sections: [] };
}
function makeSection() {
    return { id: `sec-${Date.now().toString(36)}`, title: 'New Section', bg: '#ffffff', blocks: [] };
}
function makeBlock(type) {
    const defaults = {
        bullets: { items: [''] },
        table: { headers: 'Column 1|Column 2', rows: 'Row 1 A|Row 1 B' },
        cards: { cols: 2, items: [{ label: '', text: '' }] },
        rights: { cols: 2, items: [{ icon: '📋', title: '', text: '' }] },
        definitions: { items: [{ term: '', desc: '' }] },
        'alpha-list': { items: [''] },
        tags: { cols: 4, items: [''] },
        'icon-cards': { cols: 2, items: [{ icon: '🔑', iconBg: '#fef3c7', title: '', desc: '' }] },
        'link-cards': { cols: 2, items: [{ icon: '📄', title: '', desc: '', linkText: 'Read →', url: '' }] },
        'cta-banner': { bg: '#0d1f3c', titleColor: '#ffffff', descColor: '#94a3b8', btnBg: '#1a56a3', btnColor: '#ffffff', title: '', desc: '', btnText: 'Contact us →', btnUrl: '#' },
        callout: { icon: '⚠️', bg: '#fff7ed', color: '#b45309', text: '' },
    };
    return { type, text: '', ...defaults[type] };
}
function ColorInput({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#000000', onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function BlockEditor({ block, onChange }) {
    const updItems = (idx, patch) => {
        const items = [...(block.items || [])];
        items[idx] = { ...items[idx], ...patch };
        onChange({ items });
    };
    const addItem = (template) => onChange({ items: [...(block.items || []), template] });
    const delItem = (idx) => onChange({ items: (block.items || []).filter((_, i) => i !== idx) });
    const setStrItems = (val) => onChange({ items: val.split('\n') });
    if (block.type === 'paragraph') {
        return (_jsx("textarea", { className: "input", rows: 4, value: block.text || '', onChange: e => onChange({ text: e.target.value }), placeholder: "Paragraph text\u2026" }));
    }
    if (block.type === 'bullets' || block.type === 'tags' || block.type === 'alpha-list') {
        const label = block.type === 'bullets' ? 'Items (one per line)' : block.type === 'tags' ? 'Tags (one per line)' : 'Items A, B, C… (one per line)';
        return (_jsxs("div", { className: "space-y-2", children: [_jsx("textarea", { className: "input", rows: 4, value: (block.items || []).join('\n'), onChange: e => setStrItems(e.target.value), placeholder: label }), block.type === 'tags' && (_jsx(Field, { label: "Columns", children: _jsx("input", { type: "number", className: "input", min: 1, max: 6, value: block.cols || 4, onChange: e => onChange({ cols: Number(e.target.value) }) }) }))] }));
    }
    if (block.type === 'table') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(Field, { label: "Headers (pipe-separated)", children: _jsx("input", { className: "input", value: block.headers || '', placeholder: "Name|Role|Details", onChange: e => onChange({ headers: e.target.value }) }) }), _jsx(Field, { label: "Rows (one per line, pipe-separated)", children: _jsx("textarea", { className: "input", rows: 4, value: block.rows || '', placeholder: "John|Admin|Full access\nJane|Editor|Limited", onChange: e => onChange({ rows: e.target.value }) }) })] }));
    }
    if (block.type === 'cards') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(Field, { label: "Columns", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: block.cols || 2, onChange: e => onChange({ cols: Number(e.target.value) }) }) }), (block.items || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2 items-start border border-slate-200 rounded p-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsx("input", { className: "input", value: item.label || '', placeholder: "Label (eyebrow)", onChange: e => updItems(idx, { label: e.target.value }) }), _jsx("textarea", { className: "input", rows: 2, value: item.text || '', placeholder: "Card text", onChange: e => updItems(idx, { text: e.target.value }) })] }), _jsx("button", { onClick: () => delItem(idx), className: "btn-danger mt-1", children: "\u2715" })] }, idx))), _jsx("button", { onClick: () => addItem({ label: '', text: '' }), className: "btn-ghost text-xs w-full", children: "+ Add card" })] }));
    }
    if (block.type === 'rights') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(Field, { label: "Columns", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: block.cols || 2, onChange: e => onChange({ cols: Number(e.target.value) }) }) }), (block.items || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2 items-start border border-slate-200 rounded p-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input w-16 text-center", value: item.icon || '📋', placeholder: "Icon", onChange: e => updItems(idx, { icon: e.target.value }) }), _jsx("input", { className: "input flex-1", value: item.title || '', placeholder: "Right title", onChange: e => updItems(idx, { title: e.target.value }) })] }), _jsx("textarea", { className: "input", rows: 2, value: item.text || '', placeholder: "Description", onChange: e => updItems(idx, { text: e.target.value }) })] }), _jsx("button", { onClick: () => delItem(idx), className: "btn-danger mt-1", children: "\u2715" })] }, idx))), _jsx("button", { onClick: () => addItem({ icon: '📋', title: '', text: '' }), className: "btn-ghost text-xs w-full", children: "+ Add right" })] }));
    }
    if (block.type === 'definitions') {
        return (_jsxs("div", { className: "space-y-2", children: [(block.items || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2 items-start border border-slate-200 rounded p-2", children: [_jsxs("div", { className: "flex-1 grid grid-cols-2 gap-2", children: [_jsx("input", { className: "input", value: item.term || '', placeholder: "Term", onChange: e => updItems(idx, { term: e.target.value }) }), _jsx("input", { className: "input", value: item.desc || '', placeholder: "Definition", onChange: e => updItems(idx, { desc: e.target.value }) })] }), _jsx("button", { onClick: () => delItem(idx), className: "btn-danger mt-1", children: "\u2715" })] }, idx))), _jsx("button", { onClick: () => addItem({ term: '', desc: '' }), className: "btn-ghost text-xs w-full", children: "+ Add definition" })] }));
    }
    if (block.type === 'icon-cards') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(Field, { label: "Columns", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: block.cols || 2, onChange: e => onChange({ cols: Number(e.target.value) }) }) }), (block.items || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2 items-start border border-slate-200 rounded p-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input w-16 text-center", value: item.icon || '🔑', placeholder: "Icon", onChange: e => updItems(idx, { icon: e.target.value }) }), _jsxs("div", { className: "flex gap-1 items-center", children: [_jsx("input", { type: "color", value: /^#[0-9a-fA-F]{6}$/.test(item.iconBg || '') ? item.iconBg : '#fef3c7', onChange: e => updItems(idx, { iconBg: e.target.value }), className: "w-8 h-8 p-0.5 border border-slate-300 rounded cursor-pointer" }), _jsx("span", { className: "text-xs text-slate-400", children: "bg" })] })] }), _jsx("input", { className: "input", value: item.title || '', placeholder: "Card title", onChange: e => updItems(idx, { title: e.target.value }) }), _jsx("textarea", { className: "input", rows: 2, value: item.desc || '', placeholder: "Description", onChange: e => updItems(idx, { desc: e.target.value }) })] }), _jsx("button", { onClick: () => delItem(idx), className: "btn-danger mt-1", children: "\u2715" })] }, idx))), _jsx("button", { onClick: () => addItem({ icon: '🔑', iconBg: '#fef3c7', title: '', desc: '' }), className: "btn-ghost text-xs w-full", children: "+ Add icon card" })] }));
    }
    if (block.type === 'link-cards') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsx(Field, { label: "Columns", children: _jsx("input", { type: "number", className: "input", min: 1, max: 4, value: block.cols || 2, onChange: e => onChange({ cols: Number(e.target.value) }) }) }), (block.items || []).map((item, idx) => (_jsxs("div", { className: "flex gap-2 items-start border border-slate-200 rounded p-2", children: [_jsxs("div", { className: "flex-1 space-y-1", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input w-16 text-center", value: item.icon || '📄', placeholder: "Icon", onChange: e => updItems(idx, { icon: e.target.value }) }), _jsx("input", { className: "input flex-1", value: item.title || '', placeholder: "Title", onChange: e => updItems(idx, { title: e.target.value }) })] }), _jsx("textarea", { className: "input", rows: 2, value: item.desc || '', placeholder: "Description", onChange: e => updItems(idx, { desc: e.target.value }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { className: "input flex-1", value: item.linkText || '', placeholder: "Link text (Read \u2192)", onChange: e => updItems(idx, { linkText: e.target.value }) }), _jsx("input", { className: "input flex-1", value: item.url || '', placeholder: "URL", onChange: e => updItems(idx, { url: e.target.value }) })] })] }), _jsx("button", { onClick: () => delItem(idx), className: "btn-danger mt-1", children: "\u2715" })] }, idx))), _jsx("button", { onClick: () => addItem({ icon: '📄', title: '', desc: '', linkText: 'Read →', url: '' }), className: "btn-ghost text-xs w-full", children: "+ Add link card" })] }));
    }
    if (block.type === 'cta-banner') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Banner bg", value: block.bg || '#0d1f3c', onChange: v => onChange({ bg: v }) }), _jsx(ColorInput, { label: "Title colour", value: block.titleColor || '#ffffff', onChange: v => onChange({ titleColor: v }) }), _jsx(ColorInput, { label: "Desc colour", value: block.descColor || '#94a3b8', onChange: v => onChange({ descColor: v }) }), _jsx(ColorInput, { label: "Button bg", value: block.btnBg || '#1a56a3', onChange: v => onChange({ btnBg: v }) })] }), _jsx(Field, { label: "Title", children: _jsx("input", { className: "input", value: block.title || '', onChange: e => onChange({ title: e.target.value }) }) }), _jsx(Field, { label: "Description", children: _jsx("textarea", { className: "input", rows: 2, value: block.desc || '', onChange: e => onChange({ desc: e.target.value }) }) }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Field, { label: "Button text", className: "flex-1", children: _jsx("input", { className: "input", value: block.btnText || '', onChange: e => onChange({ btnText: e.target.value }) }) }), _jsx(Field, { label: "Button URL", className: "flex-1", children: _jsx("input", { className: "input", value: block.btnUrl || '#', onChange: e => onChange({ btnUrl: e.target.value }) }) })] })] }));
    }
    if (block.type === 'callout') {
        return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Field, { label: "Icon", className: "w-20", children: _jsx("input", { className: "input text-center", value: block.icon || '⚠️', onChange: e => onChange({ icon: e.target.value }) }) }), _jsx(ColorInput, { label: "Background", value: block.bg || '#fff7ed', onChange: v => onChange({ bg: v }) }), _jsx(ColorInput, { label: "Text colour", value: block.color || '#b45309', onChange: v => onChange({ color: v }) })] }), _jsx(Field, { label: "Text", children: _jsx("textarea", { className: "input", rows: 3, value: block.text || '', onChange: e => onChange({ text: e.target.value }) }) })] }));
    }
    return _jsxs("p", { className: "text-xs text-slate-400", children: ["Unknown block type: ", block.type] });
}
export default function LegalPageScreen() {
    const [components, setComponents] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [name, setName] = useState('');
    const [state, setState] = useState(makeDefault());
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const [expandedSections, setExpandedSections] = useState(new Set());
    useEffect(() => {
        api.get('/content/vls-policy-components')
            .then(row => {
            const raw = row?.data;
            const comps = (raw?.components || []).map((c) => ({
                ...c,
                data: c.data ? {
                    ...c.data,
                    sections: (c.data.sections || []).map((s, si) => s.id ? s : { ...s, id: `sec-${c.id || si}-${si}` }),
                } : makeDefault(),
            }));
            setComponents(comps);
            if (comps.length > 0) {
                setActiveId(comps[0].id);
                setName(comps[0].name);
                setState(comps[0].data || makeDefault());
            }
        })
            .catch(e => setLoadError(e instanceof Error ? e.message : String(e)))
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
        const data = c.data ? {
            ...c.data,
            sections: (c.data.sections || []).map((s, si) => s.id ? s : { ...s, id: `sec-${c.id}-${si}` }),
        } : makeDefault();
        setActiveId(c.id);
        setName(c.name);
        setState(data);
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
                    id = `pol-${Date.now().toString(36)}`;
                    comps.push({ id, name, data: state });
                }
            }
            else {
                id = `pol-${Date.now().toString(36)}`;
                comps.push({ id, name, data: state });
            }
            await api.put('/content/vls-policy-components', { components: comps });
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
        await api.put('/content/vls-policy-components', { components: comps });
        setComponents(comps);
        newComponent();
    }
    // Section helpers
    const updSection = (si, patch) => {
        const sections = [...state.sections];
        sections[si] = { ...sections[si], ...patch };
        upd({ sections });
    };
    const addSection = () => {
        const s = makeSection();
        upd({ sections: [...state.sections, s] });
        setExpandedSections(prev => new Set([...prev, s.id]));
    };
    const removeSection = (si) => upd({ sections: state.sections.filter((_, i) => i !== si) });
    const toggleSection = (id) => setExpandedSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    // Block helpers
    const updBlock = (si, bi, patch) => {
        const sections = [...state.sections];
        const blocks = [...sections[si].blocks];
        blocks[bi] = { ...blocks[bi], ...patch };
        sections[si] = { ...sections[si], blocks };
        upd({ sections });
    };
    const addBlock = (si, type) => {
        const sections = [...state.sections];
        sections[si] = { ...sections[si], blocks: [...sections[si].blocks, makeBlock(type)] };
        upd({ sections });
    };
    const removeBlock = (si, bi) => {
        const sections = [...state.sections];
        sections[si] = { ...sections[si], blocks: sections[si].blocks.filter((_, i) => i !== bi) };
        upd({ sections });
    };
    // Meta helpers
    const updMeta = (idx, val) => {
        const meta = [...state.meta];
        meta[idx] = val;
        upd({ meta });
    };
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    if (loadError)
        return (_jsx("div", { className: "flex h-full items-center justify-center p-8", children: _jsxs("div", { className: "rounded-lg border border-red-200 bg-red-50 p-6 max-w-md text-center", children: [_jsx("p", { className: "text-sm font-semibold text-red-700 mb-1", children: "Failed to load content" }), _jsx("p", { className: "text-xs text-red-500 font-mono break-all", children: loadError }), _jsx("button", { onClick: () => window.location.reload(), className: "mt-4 btn-primary text-xs", children: "Reload page" })] }) }));
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Legal Page" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Scrollable legal doc with sticky sidebar nav" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(generateLegalPageHtml(state)); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4 space-y-4", children: [_jsxs("div", { className: "rounded-lg border border-slate-200 bg-slate-50 p-3", children: [_jsx("p", { className: "section-label mt-0", children: "Saved Pages" }), _jsxs("div", { className: "flex gap-2 mb-3", children: [_jsxs("select", { className: "input flex-1", value: activeId || '', onChange: e => loadComponent(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 select to load \u2014" }), components.map(c => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsx("button", { onClick: newComponent, className: "btn-ghost text-xs px-3", children: "+ New" }), activeId && _jsx("button", { onClick: deleteComponent, className: "btn-danger text-xs px-3", children: "Delete" })] }), _jsx(Field, { label: "Page name (e.g. Privacy Policy)", children: _jsx("input", { className: "input", value: name, placeholder: "Privacy Policy", onChange: e => setName(e.target.value) }) })] }), _jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Header" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Header background", value: state.hdrBg, onChange: v => upd({ hdrBg: v }) }), _jsx(ColorInput, { label: "Accent colour", value: state.accent, onChange: v => upd({ accent: v }) })] }), _jsx(Field, { label: "Eyebrow text", children: _jsx("input", { className: "input", value: state.eyebrow, placeholder: "LEGAL", onChange: e => upd({ eyebrow: e.target.value }) }) }), _jsx(Field, { label: "Page title", children: _jsx("input", { className: "input", value: state.title, placeholder: "Privacy Policy", onChange: e => upd({ title: e.target.value }) }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Meta dots (e.g. \"Last updated: 2025\")" }), _jsx("div", { className: "space-y-1.5 mb-1", children: state.meta.map((m, idx) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input flex-1", value: m, placeholder: "Last updated: 2025", onChange: e => updMeta(idx, e.target.value) }), _jsx("button", { onClick: () => upd({ meta: state.meta.filter((_, i) => i !== idx) }), className: "btn-danger", children: "\u2715" })] }, idx))) }), _jsx("button", { onClick: () => upd({ meta: [...state.meta, ''] }), className: "btn-ghost text-xs w-full", children: "+ Add meta dot" })] }), _jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Sidebar Navigation" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorInput, { label: "Nav background", value: state.navBg, onChange: v => upd({ navBg: v }) }), _jsx(Field, { label: "Nav width (px)", children: _jsx("input", { type: "number", className: "input", min: 140, max: 340, value: state.navWidth, onChange: e => upd({ navWidth: Number(e.target.value) }) }) })] })] }), _jsxs("div", { children: [_jsx("p", { className: "section-label", children: "Sections" }), _jsx("div", { className: "space-y-3 mb-2", children: state.sections.map((sec, si) => {
                                            const isOpen = expandedSections.has(sec.id);
                                            return (_jsxs("div", { className: "rounded border border-slate-200 bg-white", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t border-b border-slate-200", children: [_jsxs("button", { onClick: () => toggleSection(sec.id), className: "flex-1 text-left text-sm font-semibold text-slate-700 truncate", children: [isOpen ? '▼' : '▶', " ", si + 1, ". ", sec.title || '(untitled)'] }), _jsx("button", { onClick: () => removeSection(si), className: "btn-danger text-xs px-2", children: "\u2715" })] }), isOpen && (_jsxs("div", { className: "p-3 space-y-3", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx(Field, { label: "Section title", className: "flex-1", children: _jsx("input", { className: "input", value: sec.title, onChange: e => updSection(si, { title: e.target.value }) }) }), _jsx(ColorInput, { label: "Background", value: sec.bg, onChange: v => updSection(si, { bg: v }) })] }), _jsx("div", { className: "space-y-2", children: sec.blocks.map((block, bi) => {
                                                                    const typeLabel = BLOCK_TYPES.find(t => t.value === block.type)?.label || block.type;
                                                                    return (_jsxs("div", { className: "rounded border border-slate-200 bg-slate-50 p-2", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500 bg-white border border-slate-200 rounded px-2 py-0.5", children: typeLabel }), _jsx("button", { onClick: () => removeBlock(si, bi), className: "btn-danger ml-auto text-xs px-2", children: "\u2715" })] }), _jsx(BlockEditor, { block: block, onChange: patch => updBlock(si, bi, patch) })] }, bi));
                                                                }) }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("select", { id: `add-block-${si}`, className: "input flex-1", children: BLOCK_TYPES.map(t => _jsx("option", { value: t.value, children: t.label }, t.value)) }), _jsx("button", { onClick: () => {
                                                                            const sel = document.getElementById(`add-block-${si}`);
                                                                            addBlock(si, sel.value);
                                                                        }, className: "btn-ghost text-xs px-3", children: "+ Add block" })] })] }))] }, sec.id));
                                        }) }), _jsx("button", { onClick: addSection, className: "btn-ghost text-xs w-full", children: "+ Add section" })] })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh;overflow:hidden;">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
