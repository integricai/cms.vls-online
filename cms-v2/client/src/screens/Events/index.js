import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { normalize } from '../../utils/text';
import { buildEventEmbedCode, buildEventsListEmbedCode, eventText, renderEventsListPreview } from './generateHtml';
const TIMEZONES = [
    'UTC',
    'Europe/London',
    'Europe/Dublin',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Istanbul',
    'Africa/Cairo',
    'Asia/Dubai',
    'Asia/Karachi',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Singapore',
    'Asia/Tokyo',
    'Australia/Sydney',
    'Pacific/Auckland',
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Sao_Paulo',
];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function pad(n) {
    return String(n).padStart(2, '0');
}
function todayDate() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function newEvent(date = todayDate()) {
    return {
        id: `evt_${Date.now()}`,
        name: normalize('', 'eventName'),
        startsAt: `${date}T09:00`,
        endsAt: `${date}T10:00`,
        timezone: 'Europe/London',
        description: [],
        venue: normalize('', 'eventMeta'),
        hosts: normalize('', 'eventMeta'),
        ctaText: normalize('', 'eventCta'),
        ctaUrl: '',
        createdAt: new Date().toISOString(),
    };
}
function dateLabel(value) {
    if (!value)
        return '';
    try {
        return new Date(value).toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }
    catch {
        return value;
    }
}
function publicEventsUrl() {
    const apiBase = import.meta.env.VITE_API_URL ?? '';
    return `${apiBase}/api/public/events`;
}
export default function Events() {
    const [events, setEvents] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [calDate, setCalDate] = useState(() => new Date());
    const [mode, setMode] = useState('preview');
    const [embedCode, setEmbedCode] = useState(() => buildEventsListEmbedCode(publicEventsUrl()));
    const sorted = useMemo(() => {
        return events.slice().sort((a, b) => (a.startsAt || '') < (b.startsAt || '') ? 1 : -1);
    }, [events]);
    useEffect(() => {
        api.get('/content/vls-events')
            .then(row => {
            const next = Array.isArray(row?.data?.events) ? row.data.events : [];
            setEvents(next);
        })
            .finally(() => setLoading(false));
    }, []);
    function patch(partial) {
        setDraft(prev => prev ? { ...prev, ...partial } : prev);
        setSaved(false);
        setPublished(false);
    }
    function selectEvent(event) {
        setSelectedId(event.id);
        setDraft(JSON.parse(JSON.stringify(event)));
        setSaved(false);
        setPublished(false);
        if (event.startsAt) {
            const d = new Date(event.startsAt);
            if (!Number.isNaN(d.getTime()))
                setCalDate(d);
        }
    }
    function startNew(date) {
        const event = newEvent(date);
        setSelectedId(null);
        setDraft(event);
        setSaved(false);
        setPublished(false);
        setMode('preview');
    }
    function generateListHtml() {
        setEmbedCode(buildEventsListEmbedCode(publicEventsUrl()));
        setMode('code');
    }
    async function saveEvent() {
        if (!draft)
            return;
        const name = normalize(draft.name, 'eventName');
        if (!name.text.trim()) {
            alert('Please enter an event name.');
            return;
        }
        setSaving(true);
        try {
            const next = selectedId
                ? events.map(event => event.id === selectedId ? draft : event)
                : [...events, draft];
            await api.put('/content/vls-events', { events: next });
            setEvents(next);
            setSelectedId(draft.id);
            setSaved(true);
        }
        finally {
            setSaving(false);
        }
    }
    async function publish() {
        if (!draft)
            return;
        const name = normalize(draft.name, 'eventName');
        if (!name.text.trim()) {
            alert('Please enter an event name.');
            return;
        }
        setPublishing(true);
        try {
            const next = selectedId
                ? events.map(event => event.id === selectedId ? draft : event)
                : [...events, draft];
            await api.put('/content/vls-events', { events: next });
            setEvents(next);
            setSelectedId(draft.id);
            setSaved(true);
            setPublished(true);
        }
        finally {
            setPublishing(false);
        }
    }
    async function deleteEvent() {
        if (!draft || !selectedId || !window.confirm('Delete this event? This cannot be undone.'))
            return;
        const next = events.filter(event => event.id !== selectedId);
        setSaving(true);
        try {
            await api.put('/content/vls-events', { events: next });
            setEvents(next);
            setDraft(null);
            setSelectedId(null);
            setEmbedCode(buildEventsListEmbedCode(publicEventsUrl()));
        }
        finally {
            setSaving(false);
        }
    }
    function addBlock(type) {
        if (!draft)
            return;
        const block = type === 'heading-para'
            ? { type, heading: normalize('', 'eventHeading'), para: normalize('', 'event') }
            : type === 'paragraph'
                ? { type, para: normalize('', 'event') }
                : { type, items: [normalize('', 'eventBullet')] };
        patch({ description: [...draft.description, block] });
    }
    function updateBlock(index, block) {
        if (!draft)
            return;
        patch({ description: draft.description.map((item, i) => i === index ? block : item) });
    }
    function removeBlock(index) {
        if (!draft)
            return;
        patch({ description: draft.description.filter((_, i) => i !== index) });
    }
    function renderCalendar() {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const today = todayDate();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevDays = new Date(year, month, 0).getDate();
        const byDate = events.reduce((acc, event) => {
            const key = event.startsAt?.slice(0, 10);
            if (key)
                (acc[key] || (acc[key] = [])).push(event);
            return acc;
        }, {});
        return (_jsxs("div", { className: "grid grid-cols-7 border-l border-t border-slate-200 bg-white text-xs", children: [DAYS.map(day => _jsx("div", { className: "border-b border-r border-slate-200 bg-slate-50 px-2 py-2 font-semibold text-slate-500", children: day }, day)), Array.from({ length: 42 }).map((_, i) => {
                    let dayNum;
                    let dateStr;
                    let off = false;
                    if (i < firstDay) {
                        dayNum = prevDays - firstDay + i + 1;
                        const d = new Date(year, month - 1, dayNum);
                        dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        off = true;
                    }
                    else if (i >= firstDay + daysInMonth) {
                        dayNum = i - firstDay - daysInMonth + 1;
                        const d = new Date(year, month + 1, dayNum);
                        dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
                        off = true;
                    }
                    else {
                        dayNum = i - firstDay + 1;
                        dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
                    }
                    const dayEvents = byDate[dateStr] || [];
                    const isPast = dateStr < today;
                    return (_jsxs("button", { onClick: () => !isPast && startNew(dateStr), className: `min-h-24 border-b border-r border-slate-200 p-2 text-left align-top transition hover:bg-blue-50 ${off ? 'bg-slate-50 text-slate-400' : 'bg-white'} ${dateStr === today ? 'ring-2 ring-inset ring-brand/40' : ''}`, children: [_jsx("span", { className: `font-semibold ${isPast ? 'text-slate-400' : 'text-slate-700'}`, children: dayNum }), _jsx("div", { className: "mt-1 space-y-1", children: dayEvents.slice(0, 3).map(event => (_jsx("div", { onClick: e => { e.stopPropagation(); selectEvent(event); }, className: "truncate rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white", children: eventText(event.name) || 'Untitled' }, event.id))) })] }, `${dateStr}-${i}`));
                })] }));
    }
    if (loading)
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading events..." });
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Events" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Embed code updates automatically \u2014 paste once, always live" }), _jsxs("div", { className: "mt-3 flex gap-2", children: [_jsx("button", { onClick: saveEvent, disabled: saving || !draft, className: "btn-primary flex-1 justify-center", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save' }), _jsx("button", { onClick: generateListHtml, className: "btn-success flex-1 justify-center", children: "\u26A1 Generate HTML" }), _jsx("button", { onClick: publish, disabled: publishing || !draft, className: `flex-1 justify-center ${published ? 'btn-success' : 'btn-primary'}`, children: publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish' })] }), _jsxs("div", { className: "mt-2 flex items-center gap-2", children: [_jsxs("span", { className: "text-xs text-slate-400", children: [events.length, " event", events.length !== 1 ? 's' : ''] }), _jsx("button", { className: "btn-ghost text-xs ml-auto", onClick: () => startNew(), children: "+ New Event" })] })] }), _jsx("div", { className: "max-h-72 overflow-y-auto border-b border-slate-100", children: sorted.length ? sorted.map(event => {
                            const isPast = event.startsAt && new Date(event.startsAt) < new Date();
                            return (_jsxs("button", { onClick: () => selectEvent(event), className: `block w-full border-b border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50 ${draft?.id === event.id ? 'bg-blue-50' : ''}`, children: [_jsx("div", { className: "truncate text-sm font-semibold text-slate-900", children: eventText(event.name) || 'Untitled' }), _jsx("div", { className: "mt-0.5 text-xs text-slate-500", children: dateLabel(event.startsAt) }), _jsx("span", { className: `mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPast ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700'}`, children: isPast ? 'Past' : 'Upcoming' })] }, event.id));
                        }) : _jsx("div", { className: "px-5 py-6 text-center text-sm text-slate-400", children: "No events yet." }) }), draft ? (_jsxs("div", { className: "px-5 py-4", children: [_jsx(RichTextField, { label: "Event name", value: normalize(draft.name, 'eventName'), defaultKey: "eventName", onChange: value => patch({ name: value }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Starts at", children: _jsx("input", { type: "datetime-local", className: "input", value: draft.startsAt, onChange: e => patch({ startsAt: e.target.value }) }) }), _jsx(Field, { label: "Ends at", children: _jsx("input", { type: "datetime-local", className: "input", value: draft.endsAt, onChange: e => patch({ endsAt: e.target.value }) }) })] }), _jsx(Field, { label: "Timezone", children: _jsx("select", { className: "input", value: draft.timezone, onChange: e => patch({ timezone: e.target.value }), children: TIMEZONES.map(tz => _jsx("option", { value: tz, children: tz }, tz)) }) }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(RichTextField, { label: "Venue", value: normalize(draft.venue, 'eventMeta'), defaultKey: "eventMeta", onChange: value => patch({ venue: value }) }), _jsx(RichTextField, { label: "Hosts", value: normalize(draft.hosts, 'eventMeta'), defaultKey: "eventMeta", onChange: value => patch({ hosts: value }) })] }), _jsx(RichTextField, { label: "CTA Button Text", value: normalize(draft.ctaText, 'eventCta'), defaultKey: "eventCta", onChange: value => patch({ ctaText: value }) }), _jsx(Field, { label: "CTA Button URL", children: _jsx("input", { className: "input", value: draft.ctaUrl, onChange: e => patch({ ctaUrl: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Description" }), _jsx("div", { className: "space-y-3", children: draft.description.map((block, index) => (_jsx(DescriptionBlock, { block: block, onChange: next => updateBlock(index, next), onRemove: () => removeBlock(index) }, index))) }), _jsxs("div", { className: "mt-2 flex gap-2", children: [_jsx("button", { className: "btn-ghost text-xs", onClick: () => addBlock('heading-para'), children: "+ Heading + Paragraph" }), _jsx("button", { className: "btn-ghost text-xs", onClick: () => addBlock('paragraph'), children: "+ Paragraph" }), _jsx("button", { className: "btn-ghost text-xs", onClick: () => addBlock('list'), children: "+ List" })] })] })) : (_jsx("div", { className: "px-5 py-10 text-center text-sm text-slate-400", children: "Select an event or click a calendar day to create one." })), draft && selectedId && (_jsxs("div", { className: "sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white px-5 py-3", children: [_jsx("button", { className: "btn-danger", onClick: deleteEvent, children: "Delete" }), _jsx("button", { className: "btn-ghost text-xs ml-auto", onClick: () => { setEmbedCode(buildEventEmbedCode(draft.id, publicEventsUrl())); setMode('code'); }, children: "Get Single-Event Code" })] }))] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-slate-200 bg-white px-4", children: [_jsx("button", { className: "btn-ghost my-2 text-xs", onClick: () => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1)), children: "\u2039" }), _jsxs("div", { className: "text-sm font-semibold text-slate-900", children: [MONTHS[calDate.getMonth()], " ", calDate.getFullYear()] }), _jsx("button", { className: "btn-ghost my-2 text-xs", onClick: () => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1)), children: "\u203A" }), _jsx("button", { className: "btn-ghost my-2 text-xs", onClick: () => setCalDate(new Date()), children: "Today" }), _jsx("div", { className: "ml-auto flex", children: ['preview', 'code'].map(tab => (_jsx("button", { onClick: () => setMode(tab), className: `px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${mode === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'code' ? 'Embed Code' : 'Preview' }, tab))) })] }), mode === 'preview' ? (_jsxs("div", { className: "flex-1 overflow-auto bg-slate-50 p-5", children: [_jsx("div", { className: "mb-5", children: renderCalendar() }), _jsx("iframe", { title: "event-preview", srcDoc: `<!doctype html><html><body style="margin:0;padding:20px;background:#f8fafc">${renderEventsListPreview(events)}</body></html>`, className: "h-96 w-full rounded-lg border border-slate-200 bg-white" })] })) : (_jsxs("div", { className: "flex-1 overflow-auto bg-slate-900 p-4", children: [_jsxs("div", { className: "mb-3 flex items-start justify-between gap-3", children: [_jsx("div", { className: "rounded bg-blue-900/60 border border-blue-700 px-3 py-2 text-xs text-blue-200 flex-1", children: "Paste this code once into your Zenler page. Events will load automatically from the CMS \u2014 no re-pasting needed when you add or update events." }), _jsx("button", { onClick: () => navigator.clipboard.writeText(embedCode), className: "shrink-0 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" })] }), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: embedCode })] }))] })] }));
}
function DescriptionBlock({ block, onChange, onRemove }) {
    return (_jsxs("div", { className: "rounded-lg border border-slate-100 bg-slate-50 p-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-semibold text-slate-500", children: block.type }), _jsx("button", { className: "btn-danger", onClick: onRemove, children: "Remove" })] }), block.type === 'heading-para' && (_jsxs(_Fragment, { children: [_jsx(RichTextField, { label: "Heading", value: normalize(block.heading, 'eventHeading'), defaultKey: "eventHeading", onChange: (heading) => onChange({ ...block, heading }) }), _jsx(RichTextField, { label: "Paragraph", multiline: true, value: normalize(block.para, 'event'), defaultKey: "event", onChange: (para) => onChange({ ...block, para }) })] })), block.type === 'paragraph' && (_jsx(RichTextField, { label: "Paragraph", multiline: true, value: normalize(block.para, 'event'), defaultKey: "event", onChange: (para) => onChange({ ...block, para }) })), block.type === 'list' && (_jsxs("div", { className: "space-y-2", children: [block.items.map((item, index) => (_jsxs("div", { className: "grid grid-cols-[1fr_auto] gap-2", children: [_jsx(RichTextField, { label: `Bullet ${index + 1}`, value: normalize(item, 'eventBullet'), defaultKey: "eventBullet", onChange: (value) => onChange({ ...block, items: block.items.map((old, i) => i === index ? value : old) }) }), _jsx("button", { className: "btn-danger mt-5 h-8", onClick: () => onChange({ ...block, items: block.items.filter((_, i) => i !== index) }), children: "Remove" })] }, index))), _jsx("button", { className: "btn-ghost text-xs", onClick: () => onChange({ ...block, items: [...block.items, normalize('', 'eventBullet')] }), children: "+ Add item" })] }))] }));
}
