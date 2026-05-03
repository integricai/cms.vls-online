import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateBannerHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
let idCounter = 0;
function newBanner() {
    idCounter++;
    return {
        id: `bn${idCounter}`,
        name: '',
        visible: true,
        title: normalize('', 'bannerTitle'),
        sub: normalize('', 'bannerSubtitle'),
        ctaText: normalize('', 'bannerCta'),
        ctaUrl: '',
        days: 0, hours: 0, mins: 0, secs: 0,
        bg: '#204280', fg: '#ffffff', btnBg: '#e63946', btnFg: '#ffffff',
        padLeft: 24, padRight: 24,
    };
}
function ColorPair({ label, value, onChange }) {
    return (_jsx(Field, { label: label, children: _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "color", value: value, onChange: e => onChange(e.target.value), className: "w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" }), _jsx("input", { type: "text", value: value, className: "input", onChange: e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value))
                        onChange(e.target.value); } })] }) }));
}
function BannerForm({ banner: b, onChange }) {
    function asTextData(v, key) { return normalize(v, key); }
    return (_jsxs("div", { className: "space-y-0", children: [_jsx("p", { className: "section-label", children: "Identity" }), _jsx(Field, { label: "Banner name", hint: "CMS only", children: _jsx("input", { className: "input", value: b.name, placeholder: "e.g. March Promo Banner", onChange: e => onChange({ name: e.target.value }) }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: "input", value: String(b.visible), onChange: e => onChange({ visible: e.target.value === 'true' }), children: [_jsx("option", { value: "true", children: "Visible \u2014 show on all pages" }), _jsx("option", { value: "false", children: "Hidden \u2014 do not show" })] }) }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(RichTextField, { label: "Banner title / message", value: asTextData(b.title, 'bannerTitle'), defaultKey: "bannerTitle", onChange: v => onChange({ title: v }) }), _jsx(RichTextField, { label: "Sub-message (optional)", value: asTextData(b.sub, 'bannerSubtitle'), defaultKey: "bannerSubtitle", onChange: v => onChange({ sub: v }) }), _jsx(RichTextField, { label: "CTA button label", value: asTextData(b.ctaText, 'bannerCta'), defaultKey: "bannerCta", onChange: v => onChange({ ctaText: v }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: b.ctaUrl, placeholder: "https://...", onChange: e => onChange({ ctaUrl: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Countdown timer" }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: ['days', 'hours', 'mins', 'secs'].map(k => (_jsx(Field, { label: k.charAt(0).toUpperCase() + k.slice(1), children: _jsx("input", { type: "number", className: "input", min: 0, max: k === 'days' ? 9999 : 59, value: b[k], onChange: e => onChange({ [k]: parseInt(e.target.value) || 0 }) }) }, k))) }), _jsx("p", { className: "section-label", children: "Colours" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorPair, { label: "Background", value: b.bg, onChange: v => onChange({ bg: v }) }), _jsx(ColorPair, { label: "Text colour", value: b.fg, onChange: v => onChange({ fg: v }) }), _jsx(ColorPair, { label: "Button background", value: b.btnBg, onChange: v => onChange({ btnBg: v }) }), _jsx(ColorPair, { label: "Button text", value: b.btnFg, onChange: v => onChange({ btnFg: v }) })] }), _jsx("p", { className: "section-label", children: "Spacing" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: b.padLeft, onChange: e => onChange({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: b.padRight, onChange: e => onChange({ padRight: Number(e.target.value) }) }) })] })] }));
}
export default function BannerScreen() {
    const [banners, setBanners] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [previewHtml, setPreviewHtml] = useState('');
    const active = banners.find(b => b.id === activeId) ?? null;
    useEffect(() => {
        api.get('/content/vls-banners')
            .then(row => {
            const bns = row?.data?.banners ?? [];
            bns.forEach(b => {
                const n = parseInt(b.id.replace('bn', ''), 10);
                if (n > idCounter)
                    idCounter = n;
            });
            if (bns.length > 0) {
                setBanners(bns);
                setActiveId(bns[0].id);
            }
        })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        if (active) {
            const totalMs = ((active.days || 0) * 86400 + (active.hours || 0) * 3600 + (active.mins || 0) * 60 + (active.secs || 0)) * 1000;
            setPreviewHtml(generateBannerHtml(active, Date.now() + totalMs));
        }
    }, [active]);
    const updateActive = useCallback((patch) => {
        setBanners(prev => prev.map(b => b.id === activeId ? { ...b, ...patch } : b));
        setSaved(false);
        setPublished(false);
    }, [activeId]);
    function addBanner() {
        const b = newBanner();
        setBanners(prev => [...prev, b]);
        setActiveId(b.id);
        setSaved(false);
        setPublished(false);
    }
    function deleteBanner(id) {
        setBanners(prev => {
            const next = prev.filter(b => b.id !== id);
            if (activeId === id)
                setActiveId(next[0]?.id ?? null);
            return next;
        });
        setSaved(false);
        setPublished(false);
    }
    async function save() {
        setSaving(true);
        try {
            await api.put('/content/vls-banners', { banners });
            setSaved(true);
            if (active) {
                const totalMs = ((active.days || 0) * 86400 + (active.hours || 0) * 3600 + (active.mins || 0) * 60 + (active.secs || 0)) * 1000;
                setPreviewHtml(generateBannerHtml(active, Date.now() + totalMs));
            }
        }
        finally {
            setSaving(false);
        }
    }
    async function publish() {
        setPublishing(true);
        try {
            await api.put('/content/vls-banners', { banners });
            setPublished(true);
        }
        finally {
            setPublishing(false);
        }
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Banners" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Countdown banners shown across all pages" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: publish, disabled: publishing, className: "btn-success flex-1 justify-center", children: publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish' })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Banners" }), _jsx("button", { onClick: addBanner, className: "btn-ghost text-xs py-1 px-2", children: "+ New" })] }), banners.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-4", children: "No banners yet." })) : (_jsx("div", { className: "space-y-1", children: banners.map(b => (_jsxs("div", { onClick: () => setActiveId(b.id), className: `flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${b.id === activeId
                                                ? 'bg-brand text-white'
                                                : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'}`, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: `text-xs ${b.id === activeId ? 'text-white/70' : 'text-slate-400'}`, children: b.visible ? '●' : '○' }), _jsx("span", { className: "truncate font-medium", children: b.name || 'Untitled' })] }), _jsx("button", { onClick: e => { e.stopPropagation(); deleteBanner(b.id); }, className: `ml-2 shrink-0 text-xs ${b.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u2715" })] }, b.id))) }))] }), active && _jsx(BannerForm, { banner: active, onChange: updateActive })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "border-b border-slate-200 bg-white px-4 py-3", children: _jsx("span", { className: "text-sm font-medium text-slate-500", children: "Live Preview" }) }), _jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a banner and click 💾 Save to preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })] })] }));
}
