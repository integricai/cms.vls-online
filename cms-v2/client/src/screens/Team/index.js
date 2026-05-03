import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateTeamHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
function getStr(v) {
    if (!v)
        return '';
    if (typeof v === 'string')
        return v;
    return v.text || '';
}
function normalizeCard(raw) {
    return {
        id: raw.id || `tm-${Date.now().toString(36)}`,
        eyebrow: raw.eyebrow || 'MEET YOUR TUTOR',
        name: raw.name || '',
        designation: raw.designation || '',
        imgUrl: raw.imgUrl || '',
        features: (raw.features || []).map((f) => ({ value: getStr(f?.value), label: getStr(f?.label) })),
        paras: (raw.paras || []).map(getStr).filter(Boolean),
        tags: (raw.tags || []).map(getStr).filter(Boolean),
    };
}
function makeCard() {
    return {
        id: `tm-${Date.now().toString(36)}`,
        eyebrow: normalize('MEET YOUR TUTOR', 'teamEyebrow'),
        name: normalize('', 'teamName'),
        designation: normalize('', 'teamDesignation'),
        imgUrl: '',
        features: [],
        paras: [''],
        tags: [],
    };
}
export default function TeamScreen() {
    const [cards, setCards] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const [expanded, setExpanded] = useState(new Set());
    useEffect(() => {
        api.get('/content/vls-team')
            .then(row => {
            const raw = row?.data;
            const rawCards = raw?.cards || [];
            const loaded = rawCards.map(normalizeCard);
            setCards(loaded);
            if (loaded.length > 0)
                setExpanded(new Set([loaded[0].id]));
        })
            .catch(e => setLoadError(e instanceof Error ? e.message : String(e)))
            .finally(() => setLoading(false));
    }, []);
    const upd = useCallback((patch) => { setCards(patch); setSaved(false); }, []);
    function toggleExpand(id) {
        setExpanded(prev => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    }
    function updateCard(i, patch) {
        const a = [...cards];
        a[i] = { ...a[i], ...patch };
        upd(a);
    }
    function addCard() { const c = makeCard(); upd([...cards, c]); setExpanded(prev => new Set([...prev, c.id])); }
    function removeCard(i) { upd(cards.filter((_, idx) => idx !== i)); }
    function moveCard(i, dir) {
        const j = i + dir;
        if (j < 0 || j >= cards.length)
            return;
        const a = [...cards];
        [a[i], a[j]] = [a[j], a[i]];
        upd(a);
    }
    function addFeature(i) { updateCard(i, { features: [...cards[i].features, { value: '', label: '' }] }); }
    function removeFeature(i, fi) { updateCard(i, { features: cards[i].features.filter((_, idx) => idx !== fi) }); }
    function updateFeature(i, fi, patch) {
        const features = [...cards[i].features];
        features[fi] = { ...features[fi], ...patch };
        updateCard(i, { features });
    }
    function addPara(i) { updateCard(i, { paras: [...cards[i].paras, ''] }); }
    function removePara(i, pi) { updateCard(i, { paras: cards[i].paras.filter((_, idx) => idx !== pi) }); }
    function updatePara(i, pi, val) {
        const paras = [...cards[i].paras];
        paras[pi] = val;
        updateCard(i, { paras });
    }
    function addTag(i) { updateCard(i, { tags: [...cards[i].tags, ''] }); }
    function removeTag(i, ti) { updateCard(i, { tags: cards[i].tags.filter((_, idx) => idx !== ti) }); }
    function updateTag(i, ti, val) {
        const tags = [...cards[i].tags];
        tags[ti] = val;
        updateCard(i, { tags });
    }
    async function save() {
        setSaving(true);
        try {
            await api.put('/content/vls-team', { cards });
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    if (loadError)
        return (_jsx("div", { className: "flex h-full items-center justify-center p-8", children: _jsxs("div", { className: "rounded-lg border border-red-200 bg-red-50 p-6 max-w-md text-center", children: [_jsx("p", { className: "text-sm font-semibold text-red-700 mb-1", children: "Failed to load team data" }), _jsx("p", { className: "text-xs text-red-500 font-mono break-all", children: loadError }), _jsx("button", { onClick: () => window.location.reload(), className: "mt-4 btn-primary text-xs", children: "Reload page" })] }) }));
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Team" }), _jsxs("p", { className: "text-xs text-slate-400 mt-0.5", children: [cards.length, " team member", cards.length !== 1 ? 's' : ''] })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { setPreviewHtml(wrapGeneratedHtml('Team', generateTeamHtml(cards))); setActiveTab('preview'); }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4 space-y-3", children: [cards.map((card, i) => {
                                const nameText = getStr(card.name) || '(unnamed)';
                                const isOpen = expanded.has(card.id);
                                return (_jsxs("div", { className: "rounded border border-slate-200 bg-white", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-t border-b border-slate-200", children: [_jsxs("button", { onClick: () => toggleExpand(card.id), className: "flex-1 text-left text-sm font-semibold text-slate-700 truncate", children: [isOpen ? '▼' : '▶', " ", nameText] }), _jsx("button", { onClick: () => moveCard(i, -1), disabled: i === 0, className: "btn-ghost text-xs px-2 disabled:opacity-30", children: "\u2191" }), _jsx("button", { onClick: () => moveCard(i, 1), disabled: i === cards.length - 1, className: "btn-ghost text-xs px-2 disabled:opacity-30", children: "\u2193" }), _jsx("button", { onClick: () => removeCard(i), className: "btn-danger text-xs px-2", children: "\u2715" })] }), isOpen && (_jsxs("div", { className: "p-3 space-y-1", children: [_jsx(Field, { label: "Photo URL", children: card.imgUrl.startsWith('data:') ? (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("img", { src: card.imgUrl, alt: "preview", className: "h-10 w-10 rounded-full object-cover border border-slate-200 shrink-0" }), _jsx("span", { className: "text-xs text-slate-500 flex-1", children: "Embedded base64 photo" }), _jsx("button", { onClick: () => updateCard(i, { imgUrl: '' }), className: "btn-danger text-xs px-2", children: "Remove" })] })) : (_jsx("input", { className: "input", value: card.imgUrl, placeholder: "https://\u2026", onChange: e => updateCard(i, { imgUrl: e.target.value }) })) }), _jsx(RichTextField, { label: "Eyebrow", value: normalize(card.eyebrow, 'teamEyebrow'), defaultKey: "teamEyebrow", onChange: v => updateCard(i, { eyebrow: v }) }), _jsx(RichTextField, { label: "Name", value: normalize(card.name, 'teamName'), defaultKey: "teamName", onChange: v => updateCard(i, { name: v }) }), _jsx(RichTextField, { label: "Designation / Role", value: normalize(card.designation, 'teamDesignation'), defaultKey: "teamDesignation", onChange: v => updateCard(i, { designation: v }) }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Stat Features (left panel)" }), _jsx("div", { className: "space-y-1.5 mb-1", children: card.features.map((feat, fi) => (_jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { className: "input w-24 shrink-0 text-center font-bold", value: feat.value, placeholder: "20+", onChange: e => updateFeature(i, fi, { value: e.target.value }) }), _jsx("input", { className: "input flex-1", value: feat.label, placeholder: "Years Exp.", onChange: e => updateFeature(i, fi, { label: e.target.value }) }), _jsx("button", { onClick: () => removeFeature(i, fi), className: "btn-danger", children: "\u2715" })] }, fi))) }), _jsx("button", { onClick: () => addFeature(i), className: "btn-ghost text-xs w-full", children: "+ Add stat" }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Bio Paragraphs" }), _jsx("div", { className: "space-y-1.5 mb-1", children: card.paras.map((para, pi) => (_jsxs("div", { className: "flex gap-2 items-start", children: [_jsx("textarea", { className: "input flex-1", rows: 2, value: para, onChange: e => updatePara(i, pi, e.target.value) }), _jsx("button", { onClick: () => removePara(i, pi), className: "btn-danger mt-1", children: "\u2715" })] }, pi))) }), _jsx("button", { onClick: () => addPara(i), className: "btn-ghost text-xs w-full", children: "+ Add paragraph" }), _jsx("p", { className: "text-xs font-semibold text-slate-500 mt-2 mb-1", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-1.5 mb-1", children: card.tags.map((tag, ti) => (_jsxs("div", { className: "flex gap-1 items-center", children: [_jsx("input", { className: "input w-32", value: tag, onChange: e => updateTag(i, ti, e.target.value) }), _jsx("button", { onClick: () => removeTag(i, ti), className: "btn-danger", children: "\u2715" })] }, ti))) }), _jsx("button", { onClick: () => addTag(i), className: "btn-ghost text-xs w-full", children: "+ Add tag" })] }))] }, card.id));
                            }), _jsx("button", { onClick: addCard, className: "btn-ghost text-xs w-full", children: "+ Add team member" })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"><style>body{padding:24px;background:#f8fafc;}</style></head><body>${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin allow-scripts" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
