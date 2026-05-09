import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import type { EventDescriptionBlock, EventsContent, TextData, VlsEvent } from '../../types/cms';
import { normalize } from '../../utils/text';
import { buildEventEmbedCode, buildEventsListEmbedCode, eventText, renderEventsListPreview } from './generateHtml';

type ContentResponse<T> = {
  key: string;
  data: T;
  updated_at: string;
  updated_by: number | null;
};

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

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function todayDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newEvent(date = todayDate()): VlsEvent {
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

function dateLabel(value: string): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function publicEventsUrl(): string {
  return `${window.location.origin}/api/public/events`;
}

export default function Events() {
  const [events, setEvents] = useState<VlsEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VlsEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [calDate, setCalDate] = useState(() => new Date());
  const [mode, setMode] = useState<'preview' | 'code'>('preview');
  const [embedCode, setEmbedCode] = useState(() => buildEventsListEmbedCode(publicEventsUrl()));

  const sorted = useMemo(() => {
    return events.slice().sort((a, b) => (a.startsAt || '') < (b.startsAt || '') ? 1 : -1);
  }, [events]);

  useEffect(() => {
    api.get<ContentResponse<EventsContent>>('/content/vls-events')
      .then(row => {
        const next = Array.isArray(row?.data?.events) ? row.data.events : [];
        setEvents(next);
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(partial: Partial<VlsEvent>) {
    setDraft(prev => prev ? { ...prev, ...partial } : prev);
    setSaved(false);
    setPublished(false);
  }

  function selectEvent(event: VlsEvent) {
    setSelectedId(event.id);
    setDraft(JSON.parse(JSON.stringify(event)));
    setSaved(false);
    setPublished(false);
    if (event.startsAt) {
      const d = new Date(event.startsAt);
      if (!Number.isNaN(d.getTime())) setCalDate(d);
    }
  }

  function startNew(date?: string) {
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
    if (!draft) return;
    const name = normalize(draft.name, 'eventName');
    if (!name.text.trim()) { alert('Please enter an event name.'); return; }
    setSaving(true);
    try {
      const next = selectedId
        ? events.map(event => event.id === selectedId ? draft : event)
        : [...events, draft];
      await api.put('/content/vls-events', { events: next });
      setEvents(next);
      setSelectedId(draft.id);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!draft) return;
    const name = normalize(draft.name, 'eventName');
    if (!name.text.trim()) { alert('Please enter an event name.'); return; }
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
    } finally {
      setPublishing(false);
    }
  }

  async function deleteEvent() {
    if (!draft || !selectedId || !window.confirm('Delete this event? This cannot be undone.')) return;
    const next = events.filter(event => event.id !== selectedId);
    setSaving(true);
    try {
      await api.put('/content/vls-events', { events: next });
      setEvents(next);
      setDraft(null);
      setSelectedId(null);
      setEmbedCode(buildEventsListEmbedCode(publicEventsUrl()));
    } finally {
      setSaving(false);
    }
  }

  function addBlock(type: EventDescriptionBlock['type']) {
    if (!draft) return;
    const block: EventDescriptionBlock =
      type === 'heading-para'
        ? { type, heading: normalize('', 'eventHeading'), para: normalize('', 'event') }
        : type === 'paragraph'
          ? { type, para: normalize('', 'event') }
          : { type, items: [normalize('', 'eventBullet')] };
    patch({ description: [...draft.description, block] });
  }

  function updateBlock(index: number, block: EventDescriptionBlock) {
    if (!draft) return;
    patch({ description: draft.description.map((item, i) => i === index ? block : item) });
  }

  function removeBlock(index: number) {
    if (!draft) return;
    patch({ description: draft.description.filter((_, i) => i !== index) });
  }

  function renderCalendar() {
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const today = todayDate();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDays = new Date(year, month, 0).getDate();
    const byDate = events.reduce<Record<string, VlsEvent[]>>((acc, event) => {
      const key = event.startsAt?.slice(0, 10);
      if (key) (acc[key] ||= []).push(event);
      return acc;
    }, {});

    return (
      <div className="grid grid-cols-7 border-l border-t border-slate-200 bg-white text-xs">
        {DAYS.map(day => <div key={day} className="border-b border-r border-slate-200 bg-slate-50 px-2 py-2 font-semibold text-slate-500">{day}</div>)}
        {Array.from({ length: 42 }).map((_, i) => {
          let dayNum: number;
          let dateStr: string;
          let off = false;
          if (i < firstDay) {
            dayNum = prevDays - firstDay + i + 1;
            const d = new Date(year, month - 1, dayNum);
            dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            off = true;
          } else if (i >= firstDay + daysInMonth) {
            dayNum = i - firstDay - daysInMonth + 1;
            const d = new Date(year, month + 1, dayNum);
            dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
            off = true;
          } else {
            dayNum = i - firstDay + 1;
            dateStr = `${year}-${pad(month + 1)}-${pad(dayNum)}`;
          }
          const dayEvents = byDate[dateStr] || [];
          const isPast = dateStr < today;
          return (
            <button key={`${dateStr}-${i}`} onClick={() => !isPast && startNew(dateStr)} className={`min-h-24 border-b border-r border-slate-200 p-2 text-left align-top transition hover:bg-blue-50 ${off ? 'bg-slate-50 text-slate-400' : 'bg-white'} ${dateStr === today ? 'ring-2 ring-inset ring-brand/40' : ''}`}>
              <span className={`font-semibold ${isPast ? 'text-slate-400' : 'text-slate-700'}`}>{dayNum}</span>
              <div className="mt-1 space-y-1">
                {dayEvents.slice(0, 3).map(event => (
                  <div key={event.id} onClick={e => { e.stopPropagation(); selectEvent(event); }} className="truncate rounded bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
                    {eventText(event.name) || 'Untitled'}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading events...</div>;

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Events</h1>
          <p className="text-xs text-slate-400 mt-0.5">Embed code updates automatically — paste once, always live</p>
          <div className="mt-3 flex gap-2">
            <button onClick={saveEvent} disabled={saving || !draft} className="btn-primary flex-1 justify-center">
              {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
            </button>
            <button onClick={generateListHtml} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
            <button onClick={publish} disabled={publishing || !draft} className={`flex-1 justify-center ${published ? 'btn-success' : 'btn-primary'}`}>
              {publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish'}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-slate-400">{events.length} event{events.length !== 1 ? 's' : ''}</span>
            <button className="btn-ghost text-xs ml-auto" onClick={() => startNew()}>+ New Event</button>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto border-b border-slate-100">
          {sorted.length ? sorted.map(event => {
            const isPast = event.startsAt && new Date(event.startsAt) < new Date();
            return (
              <button key={event.id} onClick={() => selectEvent(event)} className={`block w-full border-b border-slate-100 px-5 py-3 text-left transition hover:bg-slate-50 ${draft?.id === event.id ? 'bg-blue-50' : ''}`}>
                <div className="truncate text-sm font-semibold text-slate-900">{eventText(event.name) || 'Untitled'}</div>
                <div className="mt-0.5 text-xs text-slate-500">{dateLabel(event.startsAt)}</div>
                <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${isPast ? 'bg-slate-100 text-slate-500' : 'bg-green-50 text-green-700'}`}>{isPast ? 'Past' : 'Upcoming'}</span>
              </button>
            );
          }) : <div className="px-5 py-6 text-center text-sm text-slate-400">No events yet.</div>}
        </div>

        {draft ? (
          <div className="px-5 py-4">
            <RichTextField label="Event name" value={normalize(draft.name, 'eventName')} defaultKey="eventName" onChange={value => patch({ name: value })} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Starts at"><input type="datetime-local" className="input" value={draft.startsAt} onChange={e => patch({ startsAt: e.target.value })} /></Field>
              <Field label="Ends at"><input type="datetime-local" className="input" value={draft.endsAt} onChange={e => patch({ endsAt: e.target.value })} /></Field>
            </div>
            <Field label="Timezone">
              <select className="input" value={draft.timezone} onChange={e => patch({ timezone: e.target.value })}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <RichTextField label="Venue" value={normalize(draft.venue, 'eventMeta')} defaultKey="eventMeta" onChange={value => patch({ venue: value })} />
              <RichTextField label="Hosts" value={normalize(draft.hosts, 'eventMeta')} defaultKey="eventMeta" onChange={value => patch({ hosts: value })} />
            </div>
            <RichTextField label="CTA Button Text" value={normalize(draft.ctaText, 'eventCta')} defaultKey="eventCta" onChange={value => patch({ ctaText: value })} />
            <Field label="CTA Button URL"><input className="input" value={draft.ctaUrl} onChange={e => patch({ ctaUrl: e.target.value })} /></Field>

            <p className="section-label">Description</p>
            <div className="space-y-3">
              {draft.description.map((block, index) => (
                <DescriptionBlock key={index} block={block} onChange={next => updateBlock(index, next)} onRemove={() => removeBlock(index)} />
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <button className="btn-ghost text-xs" onClick={() => addBlock('heading-para')}>+ Heading + Paragraph</button>
              <button className="btn-ghost text-xs" onClick={() => addBlock('paragraph')}>+ Paragraph</button>
              <button className="btn-ghost text-xs" onClick={() => addBlock('list')}>+ List</button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-slate-400">Select an event or click a calendar day to create one.</div>
        )}

        {draft && selectedId && (
          <div className="sticky bottom-0 flex gap-2 border-t border-slate-100 bg-white px-5 py-3">
            <button className="btn-danger" onClick={deleteEvent}>Delete</button>
            <button className="btn-ghost text-xs ml-auto" onClick={() => { setEmbedCode(buildEventEmbedCode(draft.id, publicEventsUrl())); setMode('code'); }}>Get Single-Event Code</button>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4">
          <button className="btn-ghost my-2 text-xs" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}>‹</button>
          <div className="text-sm font-semibold text-slate-900">{MONTHS[calDate.getMonth()]} {calDate.getFullYear()}</div>
          <button className="btn-ghost my-2 text-xs" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}>›</button>
          <button className="btn-ghost my-2 text-xs" onClick={() => setCalDate(new Date())}>Today</button>
          <div className="ml-auto flex">
            {(['preview', 'code'] as const).map(tab => (
              <button key={tab} onClick={() => setMode(tab)} className={`px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${mode === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
                {tab === 'code' ? 'Embed Code' : 'Preview'}
              </button>
            ))}
          </div>
        </div>
        {mode === 'preview' ? (
          <div className="flex-1 overflow-auto bg-slate-50 p-5">
            <div className="mb-5">{renderCalendar()}</div>
            <iframe title="event-preview" srcDoc={`<!doctype html><html><body style="margin:0;padding:20px;background:#f8fafc">${renderEventsListPreview(events)}</body></html>`} className="h-96 w-full rounded-lg border border-slate-200 bg-white" />
          </div>
        ) : (
          <div className="flex-1 overflow-auto bg-slate-900 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="rounded bg-blue-900/60 border border-blue-700 px-3 py-2 text-xs text-blue-200 flex-1">
                Paste this code once into your Zenler page. Events will load automatically from the CMS — no re-pasting needed when you add or update events.
              </div>
              <button onClick={() => navigator.clipboard.writeText(embedCode)} className="shrink-0 rounded bg-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            </div>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">{embedCode}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function DescriptionBlock({ block, onChange, onRemove }: {
  block: EventDescriptionBlock;
  onChange: (block: EventDescriptionBlock) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{block.type}</span>
        <button className="btn-danger" onClick={onRemove}>Remove</button>
      </div>
      {block.type === 'heading-para' && (
        <>
          <RichTextField label="Heading" value={normalize(block.heading, 'eventHeading')} defaultKey="eventHeading" onChange={(heading: TextData) => onChange({ ...block, heading })} />
          <RichTextField label="Paragraph" multiline value={normalize(block.para, 'event')} defaultKey="event" onChange={(para: TextData) => onChange({ ...block, para })} />
        </>
      )}
      {block.type === 'paragraph' && (
        <RichTextField label="Paragraph" multiline value={normalize(block.para, 'event')} defaultKey="event" onChange={(para: TextData) => onChange({ ...block, para })} />
      )}
      {block.type === 'list' && (
        <div className="space-y-2">
          {block.items.map((item, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] gap-2">
              <RichTextField label={`Bullet ${index + 1}`} value={normalize(item, 'eventBullet')} defaultKey="eventBullet" onChange={(value: TextData) => onChange({ ...block, items: block.items.map((old, i) => i === index ? value : old) })} />
              <button className="btn-danger mt-5 h-8" onClick={() => onChange({ ...block, items: block.items.filter((_, i) => i !== index) })}>Remove</button>
            </div>
          ))}
          <button className="btn-ghost text-xs" onClick={() => onChange({ ...block, items: [...block.items, normalize('', 'eventBullet')] })}>+ Add item</button>
        </div>
      )}
    </div>
  );
}
