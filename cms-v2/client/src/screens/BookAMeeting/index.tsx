import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import type { BookMeetingComponent, BookMeetingState, BookMeetingExpectItem } from '../../types/cms';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { generateBookMeetingHtml } from './generateHtml';

const CONTENT_KEY = 'vls-book-a-meeting';

function makeDefault(): BookMeetingState {
  return {
    bg: '#f4f7fb',
    padTop: 24,
    padBottom: 28,
    padLeft: 0,
    padRight: 0,
    sidebarWidth: 255,
    leftHeaderBg: '#0d1f3c',
    leftEyebrow: 'WHO SHOULD BOOK?',
    leftTitle: 'This session is for you if...',
    bullets: [
      { text: 'You want to start your ACCA, CIMA, or CMA qualification but are not sure where to begin.' },
      { text: 'You are an existing ACCA student who needs advice about exam preparation or study strategy.' },
      { text: 'You are planning to join VLS and want to understand which courses are right for your goals.' },
      { text: 'You want to know about entry requirements, exemptions, or the qualification pathway before committing.' },
    ],
    expectTitle: 'WHAT TO EXPECT',
    expectItems: [
      { icon: 'Doc', iconBg: '#eef4ff', title: 'Personalised guidance', desc: 'advice tailored to your background, goals, and timeline' },
      { icon: 'Ok', iconBg: '#dcfce7', title: 'Course recommendation', desc: 'the right VLS course for your qualification and level' },
      { icon: '30', iconBg: '#fef3c7', title: '30 minutes', desc: 'focused, efficient, and no time wasted' },
      { icon: 'Q', iconBg: '#f3e8ff', title: 'Open Q&A', desc: 'ask anything about ACCA, CIMA, CMA, or the VLS platform' },
    ],
    tutorInitials: 'SA',
    tutorName: 'Syed M Ali',
    tutorRole: 'Senior Tutor - ACCA & CIMA',
    tutorBio: '20+ years experience - 200+ corporate clients - World Bank & EU consultant',
    contactTitle: 'PREFER TO CONTACT US DIRECTLY?',
    contactEmail: 'office@vls-online.com',
    contactWhatsapp: 'WhatsApp: +44 7446 426261',
    meetingTitle: 'Live Handholding Hour',
    meetingSubtitle: 'Select a date and time that suits you - Vertex Learning Solutions',
    tags: ['30 minutes', 'Free - No obligation', 'Online - Zoom / Google Meet', 'English & Urdu available'],
    calendlyUrl: 'https://calendly.com/vls121/live-handholding-hour',
    calendlyHeight: 700,
  };
}

function normalize(raw: any): BookMeetingState {
  return { ...makeDefault(), ...(raw || {}) };
}

function listToText(items: Array<{ text: string }>): string {
  return items.map(item => item.text).join('\n');
}

function textToList(value: string): Array<{ text: string }> {
  return value.split('\n').map(text => ({ text }));
}

function expectToText(items: BookMeetingExpectItem[]): string {
  return items.map(item => [item.icon, item.iconBg, item.title, item.desc].join(' | ')).join('\n');
}

function textToExpect(value: string): BookMeetingExpectItem[] {
  return value.split('\n').map(line => {
    const [icon = '', iconBg = '#eef4ff', title = '', desc = ''] = line.split('|').map(part => part.trim());
    return { icon, iconBg, title, desc };
  });
}

export default function BookAMeeting() {
  const [components, setComponents] = useState<BookMeetingComponent[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [name, setName] = useState('Book a Meeting');
  const [state, setState] = useState<BookMeetingState>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    api.get<any>(`/content/${CONTENT_KEY}`)
      .then(row => {
        const raw = row?.data as any;
        const loaded: BookMeetingComponent[] = Array.isArray(raw?.components)
          ? raw.components.map((component: any) => ({
              id: component.id,
              name: component.name || 'Book a Meeting',
              data: normalize(component.data),
            }))
          : [];
        setComponents(loaded);
        if (loaded.length) {
          setActiveId(loaded[0].id);
          setName(loaded[0].name);
          setState(loaded[0].data);
        }
      })
      .catch(error => setLoadError(error instanceof Error ? error.message : String(error)))
      .finally(() => setLoading(false));
  }, []);

  function patch(update: Partial<BookMeetingState>) {
    setState(prev => ({ ...prev, ...update }));
    setSaved(false);
  }

  function loadComponent(id: string) {
    if (!id) {
      setActiveId(null);
      setName('Book a Meeting');
      setState(makeDefault());
      setSaved(false);
      return;
    }
    const component = components.find(item => item.id === id);
    if (!component) return;
    setActiveId(component.id);
    setName(component.name);
    setState(component.data);
    setSaved(false);
  }

  async function save() {
    if (!name.trim()) {
      alert('Enter a component name first.');
      return;
    }

    setSaving(true);
    try {
      const id = activeId || `book-${Date.now().toString(36)}`;
      const nextComponent = { id, name, data: state };
      const next = activeId
        ? components.map(item => item.id === activeId ? nextComponent : item)
        : [...components, nextComponent];
      await api.put(`/content/${CONTENT_KEY}`, { components: next });
      setComponents(next);
      setActiveId(id);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function deleteComponent() {
    if (!activeId) return;
    if (!window.confirm('Delete this component?')) return;
    const next = components.filter(item => item.id !== activeId);
    await api.put(`/content/${CONTENT_KEY}`, { components: next });
    setComponents(next);
    setActiveId(null);
    setName('Book a Meeting');
    setState(makeDefault());
    setSaved(false);
  }

  function generate() {
    setPreviewHtml(wrapGeneratedHtml('Book a Meeting', generateBookMeetingHtml(state)));
    setActiveTab('preview');
  }

  if (loading) return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading...</div>;
  if (loadError) return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center">
        <p className="mb-1 text-sm font-semibold text-red-700">Failed to load Book a Meeting</p>
        <p className="break-all font-mono text-xs text-red-500">{loadError}</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-full">
      <div className="w-[520px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Book a Meeting</h1>
          <p className="mt-0.5 text-xs text-slate-400">Left info rail plus Calendly booking widget</p>
        </div>

        <div className="flex gap-2 border-b border-slate-100 bg-white px-5 py-3">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">Generate HTML</button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="section-label mt-0">Saved Components</p>
            <div className="mb-3 flex gap-2">
              <select className="input flex-1" value={activeId || ''} onChange={event => loadComponent(event.target.value)}>
                <option value="">New component</option>
                {components.map(component => <option key={component.id} value={component.id}>{component.name}</option>)}
              </select>
              {activeId && <button onClick={deleteComponent} className="btn-danger text-xs px-3">Delete</button>}
            </div>
            <Field label="Component name">
              <input className="input" value={name} onChange={event => setName(event.target.value)} />
            </Field>
          </div>

          <div>
            <p className="section-label">Layout</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Background"><input className="input" value={state.bg} onChange={event => patch({ bg: event.target.value })} /></Field>
              <Field label="Dark panel"><input className="input" value={state.leftHeaderBg} onChange={event => patch({ leftHeaderBg: event.target.value })} /></Field>
              <Field label="Sidebar width"><input type="number" className="input" value={state.sidebarWidth} onChange={event => patch({ sidebarWidth: Number(event.target.value) })} /></Field>
              <Field label="Calendly height"><input type="number" className="input" value={state.calendlyHeight} onChange={event => patch({ calendlyHeight: Number(event.target.value) })} /></Field>
            </div>
          </div>

          <div>
            <p className="section-label">Left Rail</p>
            <Field label="Eyebrow"><input className="input" value={state.leftEyebrow} onChange={event => patch({ leftEyebrow: event.target.value })} /></Field>
            <Field label="Title"><input className="input" value={state.leftTitle} onChange={event => patch({ leftTitle: event.target.value })} /></Field>
            <Field label="Who should book? items">
              <textarea className="input" rows={6} value={listToText(state.bullets)} onChange={event => patch({ bullets: textToList(event.target.value) })} />
            </Field>
            <Field label="What to expect" hint="icon | icon background | title | description">
              <textarea className="input font-mono text-xs" rows={6} value={expectToText(state.expectItems)} onChange={event => patch({ expectItems: textToExpect(event.target.value) })} />
            </Field>
          </div>

          <div>
            <p className="section-label">Tutor Card</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Initials"><input className="input" value={state.tutorInitials} onChange={event => patch({ tutorInitials: event.target.value })} /></Field>
              <Field label="Name"><input className="input" value={state.tutorName} onChange={event => patch({ tutorName: event.target.value })} /></Field>
            </div>
            <Field label="Role"><input className="input" value={state.tutorRole} onChange={event => patch({ tutorRole: event.target.value })} /></Field>
            <Field label="Bio"><textarea className="input" rows={2} value={state.tutorBio} onChange={event => patch({ tutorBio: event.target.value })} /></Field>
          </div>

          <div>
            <p className="section-label">Calendar</p>
            <Field label="Meeting title"><input className="input" value={state.meetingTitle} onChange={event => patch({ meetingTitle: event.target.value })} /></Field>
            <Field label="Subtitle"><input className="input" value={state.meetingSubtitle} onChange={event => patch({ meetingSubtitle: event.target.value })} /></Field>
            <Field label="Tags">
              <textarea className="input" rows={3} value={state.tags.join('\n')} onChange={event => patch({ tags: event.target.value.split('\n') })} />
            </Field>
            <Field label="Calendly URL">
              <input className="input" value={state.calendlyUrl} onChange={event => patch({ calendlyUrl: event.target.value })} />
            </Field>
          </div>

          <div>
            <p className="section-label">Direct Contact</p>
            <Field label="Title"><input className="input" value={state.contactTitle} onChange={event => patch({ contactTitle: event.target.value })} /></Field>
            <Field label="Email"><input className="input" value={state.contactEmail} onChange={event => patch({ contactEmail: event.target.value })} /></Field>
            <Field label="WhatsApp"><input className="input" value={state.contactWhatsapp} onChange={event => patch({ contactWhatsapp: event.target.value })} /></Field>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'}`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            title="book-a-meeting-preview"
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Generate HTML to preview.</p>'}
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts allow-popups"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">Copy</button>
            <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-300">
              {previewHtml || '// Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
