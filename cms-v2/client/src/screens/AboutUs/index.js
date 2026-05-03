import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateAboutUsHtml } from './generateHtml';
import { ICON_OPTIONS } from './icons';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
let counter = 0;
function td(v, key) {
    return normalize(v, key);
}
function newSection() {
    counter++;
    return {
        id: `aus${counter}`,
        name: `About Us Section ${counter}`,
        padLeft: 24,
        padRight: 24,
        eyebrow: td('ABOUT VERTEX LEARNING SOLUTIONS', 'aboutEyebrow'),
        title: td('What is VLS and who is it for?', 'aboutTitle'),
        paragraphs: [
            td('Vertex Learning Solutions (VLS) is an online tutoring and coaching platform designed for working professionals, career changers, and motivated learners who want structured, expert-guided development without the constraints of a traditional classroom.', 'aboutParagraph'),
            td('Founded on the belief that great coaching changes careers, VLS brings together a vetted community of specialist tutors and coaches who deliver practical, outcome-focused learning across leadership, communication, career planning, wellbeing, and more.', 'aboutParagraph'),
        ],
        ctaText: td('Learn more about VLS →', 'aboutCta'),
        ctaUrl: '#',
        cards: [
            { icon: 'user', title: td('Expert tutors & coaches', 'aboutCardTitle'), desc: td('Every VLS tutor is hand-picked for subject-matter expertise, real-world experience, and proven teaching ability.', 'aboutCard') },
            { icon: 'book', title: td('Structured, outcome-led courses', 'aboutCardTitle'), desc: td('Courses are built around clear goals — not just content. Each module moves you measurably forward.', 'aboutCard') },
            { icon: 'clock', title: td('Learn on your schedule', 'aboutCardTitle'), desc: td('On-demand video content, flexible coaching sessions, and lifetime access — study when it suits you.', 'aboutCard') },
            { icon: 'check', title: td('Certificates & accreditation', 'aboutCardTitle'), desc: td('Complete a course and receive a recognised VLS certificate to add to your CV or LinkedIn profile.', 'aboutCard') },
        ],
    };
}
// ── Section list ──────────────────────────────────────────────────────────────
function SectionList({ sections, activeId, onSelect, onCreate, onDelete }) {
    return (_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Sections" }), _jsx("button", { onClick: onCreate, className: "btn-ghost text-xs py-1 px-2", children: "+ New" })] }), _jsx("div", { className: "space-y-1", children: sections.map(sec => (_jsxs("div", { onClick: () => onSelect(sec.id), className: `flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${sec.id === activeId
                        ? 'bg-brand text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'}`, children: [_jsx("span", { className: "truncate font-medium", children: sec.name || 'Untitled' }), sections.length > 1 && (_jsx("button", { onClick: e => { e.stopPropagation(); onDelete(sec.id); }, className: `ml-2 shrink-0 text-xs ${sec.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u2715" }))] }, sec.id))) })] }));
}
// ── Main screen ───────────────────────────────────────────────────────────────
export default function AboutUs() {
    const [sections, setSections] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [activeTab, setActiveTab] = useState('preview');
    const [previewHtml, setPreviewHtml] = useState('');
    const sec = sections.find(s => s.id === activeId) ?? null;
    useEffect(() => {
        api.get('/content/vls-about-us')
            .then(row => {
            const secs = row?.data?.sections ?? [];
            if (secs.length === 0) {
                const first = newSection();
                setSections([first]);
                setActiveId(first.id);
            }
            else {
                setSections(secs);
                setActiveId(secs[0].id);
            }
        })
            .catch(() => {
            const first = newSection();
            setSections([first]);
            setActiveId(first.id);
        })
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => {
        if (sec)
            setPreviewHtml(generateAboutUsHtml(sec));
    }, [sec]);
    const updateSec = useCallback((patch) => {
        setSections(prev => prev.map(s => s.id === activeId ? { ...s, ...patch } : s));
        setSaved(false);
    }, [activeId]);
    function createSection() {
        const s = newSection();
        setSections(prev => [...prev, s]);
        setActiveId(s.id);
        setSaved(false);
    }
    function deleteSection(id) {
        setSections(prev => {
            const next = prev.filter(s => s.id !== id);
            if (activeId === id)
                setActiveId(next[0]?.id ?? null);
            return next;
        });
        setSaved(false);
    }
    async function save() {
        setSaving(true);
        try {
            await api.put('/content/vls-about-us', { sections });
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "About Us" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Two-column about section with feature cards" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 flex gap-2", children: [_jsx("button", { onClick: save, disabled: saving, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: () => { if (sec) {
                                    setPreviewHtml(generateAboutUsHtml(sec));
                                    setActiveTab('preview');
                                } }, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsx(SectionList, { sections: sections, activeId: activeId, onSelect: setActiveId, onCreate: createSection, onDelete: deleteSection }), sec && _jsx(AboutUsForm, { section: sec, onChange: updateSec })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewHtml
                            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
                            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to see a preview.</p>', className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" })) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [_jsx("button", { onClick: () => navigator.clipboard.writeText(previewHtml), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: previewHtml || '// Click ⚡ Generate HTML first' })] }))] })] }));
}
// ── Form ──────────────────────────────────────────────────────────────────────
function AboutUsForm({ section: s, onChange }) {
    function asTextData(v, key) {
        return normalize(v, key);
    }
    function patchParagraph(i, v) {
        const paragraphs = [...s.paragraphs];
        paragraphs[i] = v;
        onChange({ paragraphs });
    }
    function addParagraph() {
        onChange({ paragraphs: [...s.paragraphs, normalize('', 'aboutParagraph')] });
    }
    function removeParagraph(i) {
        onChange({ paragraphs: s.paragraphs.filter((_, idx) => idx !== i) });
    }
    function patchCard(i, patch) {
        const cards = [...s.cards];
        cards[i] = { ...cards[i], ...patch };
        onChange({ cards });
    }
    function addCard() {
        onChange({
            cards: [...s.cards, {
                    icon: 'star',
                    title: normalize('', 'aboutCardTitle'),
                    desc: normalize('', 'aboutCard'),
                }],
        });
    }
    function removeCard(i) {
        onChange({ cards: s.cards.filter((_, idx) => idx !== i) });
    }
    return (_jsxs(_Fragment, { children: [_jsx("p", { className: "section-label", children: "Section Setup" }), _jsx(Field, { label: "Section name", hint: "CMS only", children: _jsx("input", { className: "input", value: s.name, onChange: e => onChange({ name: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Layout" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: s.padLeft, onChange: e => onChange({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: s.padRight, onChange: e => onChange({ padRight: Number(e.target.value) }) }) })] }), _jsx("p", { className: "section-label", children: "Section Header" }), _jsx(RichTextField, { label: "Eyebrow text", value: asTextData(s.eyebrow, 'aboutEyebrow'), defaultKey: "aboutEyebrow", onChange: v => onChange({ eyebrow: v }) }), _jsx(RichTextField, { label: "Section title", value: asTextData(s.title, 'aboutTitle'), defaultKey: "aboutTitle", onChange: v => onChange({ title: v }) }), _jsx("p", { className: "section-label", children: "Paragraphs" }), _jsx("div", { className: "space-y-2 mb-2", children: s.paragraphs.map((para, i) => (_jsxs("div", { className: "relative rounded-lg border border-slate-100 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeParagraph(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(RichTextField, { label: `Paragraph ${i + 1}`, multiline: true, value: para, defaultKey: "aboutParagraph", onChange: v => patchParagraph(i, v) })] }, i))) }), _jsx("button", { onClick: addParagraph, className: "btn-ghost text-xs w-full mb-1", children: "+ Add paragraph" }), _jsx("p", { className: "section-label", children: "CTA" }), _jsx(RichTextField, { label: "CTA text", value: asTextData(s.ctaText, 'aboutCta'), defaultKey: "aboutCta", onChange: v => onChange({ ctaText: v }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: s.ctaUrl, placeholder: "https://", onChange: e => onChange({ ctaUrl: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Right Panel Feature Cards" }), _jsx("div", { className: "space-y-3 mb-2", children: s.cards.map((card, i) => (_jsxs("div", { className: "relative rounded-lg border border-slate-100 bg-slate-50 p-3", children: [_jsx("button", { onClick: () => removeCard(i), className: "btn-danger absolute right-2 top-2", children: "\u2715" }), _jsx(Field, { label: "Icon", children: _jsx("select", { className: "input", value: card.icon, onChange: e => patchCard(i, { icon: e.target.value }), children: ICON_OPTIONS.map(opt => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }) }), _jsx(RichTextField, { label: "Title", value: asTextData(card.title, 'aboutCardTitle'), defaultKey: "aboutCardTitle", onChange: v => patchCard(i, { title: v }) }), _jsx(RichTextField, { label: "Description", multiline: true, value: asTextData(card.desc, 'aboutCard'), defaultKey: "aboutCard", onChange: v => patchCard(i, { desc: v }) })] }, i))) }), _jsx("button", { onClick: addCard, className: "btn-ghost text-xs w-full mb-4", children: "+ Add feature card" })] }));
}
