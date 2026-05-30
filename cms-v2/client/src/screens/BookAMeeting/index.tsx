import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import type { BookMeetingComponent, BookMeetingState, BookMeetingExpectItem, TextValue } from '../../types/cms';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
import { normalize as normalizeText, type DefaultKey } from '../../utils/text';
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
    leftEyebrow: normalizeText('WHO SHOULD BOOK?', 'bookEyebrow'),
    leftTitle: normalizeText('This session is for you if...', 'bookIntroTitle'),
    bullets: [
      { text: normalizeText('You want to start your ACCA, CIMA, or CMA qualification but are not sure where to begin.', 'bookBullet') },
      { text: normalizeText('You are an existing ACCA student who needs advice about exam preparation or study strategy.', 'bookBullet') },
      { text: normalizeText('You are planning to join VLS and want to understand which courses are right for your goals.', 'bookBullet') },
      { text: normalizeText('You want to know about entry requirements, exemptions, or the qualification pathway before committing.', 'bookBullet') },
    ],
    expectTitle: normalizeText('WHAT TO EXPECT', 'bookCardTitle'),
    expectItems: [
      { icon: 'Doc', iconBg: '#eef4ff', title: normalizeText('Personalised guidance', 'bookExpectTitle'), desc: normalizeText('advice tailored to your background, goals, and timeline', 'bookExpectDesc') },
      { icon: 'Ok', iconBg: '#dcfce7', title: normalizeText('Course recommendation', 'bookExpectTitle'), desc: normalizeText('the right VLS course for your qualification and level', 'bookExpectDesc') },
      { icon: '30', iconBg: '#fef3c7', title: normalizeText('30 minutes', 'bookExpectTitle'), desc: normalizeText('focused, efficient, and no time wasted', 'bookExpectDesc') },
      { icon: 'Q', iconBg: '#f3e8ff', title: normalizeText('Open Q&A', 'bookExpectTitle'), desc: normalizeText('ask anything about ACCA, CIMA, CMA, or the VLS platform', 'bookExpectDesc') },
    ],
    tutorInitials: 'SA',
    tutorName: normalizeText('Syed M Ali', 'bookTutorName'),
    tutorRole: normalizeText('Senior Tutor - ACCA & CIMA', 'bookTutorRole'),
    tutorBio: normalizeText('20+ years experience - 200+ corporate clients - World Bank & EU consultant', 'bookTutorBio'),
    contactTitle: normalizeText('PREFER TO CONTACT US DIRECTLY?', 'bookEyebrow'),
    contactEmail: normalizeText('office@vls-online.com', 'bookContactText'),
    contactWhatsapp: normalizeText('WhatsApp: +44 7446 426261', 'bookContactText'),
    meetingTitle: normalizeText('Live Handholding Hour', 'bookMeetingTitle'),
    meetingSubtitle: normalizeText('Select a date and time that suits you - Vertex Learning Solutions', 'bookMeetingSub'),
    tags: [
      normalizeText('30 minutes', 'bookTag'),
      normalizeText('Free - No obligation', 'bookTag'),
      normalizeText('Online - Zoom / Google Meet', 'bookTag'),
      normalizeText('English & Urdu available', 'bookTag'),
    ],
    calendlyUrl: 'https://calendly.com/vls121/live-handholding-hour',
    calendlyHeight: 700,
  };
}

function normalizeState(raw: any): BookMeetingState {
  return { ...makeDefault(), ...(raw || {}) };
}

function renderPreview(data: BookMeetingState): string {
  return wrapGeneratedHtml('Book a Meeting', generateBookMeetingHtml(data));
}

function asText(value: TextValue, key: DefaultKey) {
  return normalizeText(value, key);
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
              data: normalizeState(component.data),
            }))
          : [];
        setComponents(loaded);
        if (loaded.length) {
          setActiveId(loaded[0].id);
          setName(loaded[0].name);
          setState(loaded[0].data);
          setPreviewHtml(renderPreview(loaded[0].data));
        } else {
          const initial = makeDefault();
          setState(initial);
          setPreviewHtml(renderPreview(initial));
        }
      })
      .catch(error => {
        if ((error as { status?: number })?.status === 404) {
          const initial = makeDefault();
          setState(initial);
          setPreviewHtml(renderPreview(initial));
          return;
        }
        setLoadError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => setLoading(false));
  }, []);

  function patch(update: Partial<BookMeetingState>) {
    setState(prev => ({ ...prev, ...update }));
    setSaved(false);
  }

  function updateBullet(index: number, text: TextValue) {
    patch({ bullets: state.bullets.map((item, i) => i === index ? { ...item, text } : item) });
  }

  function updateExpect(index: number, update: Partial<BookMeetingExpectItem>) {
    patch({ expectItems: state.expectItems.map((item, i) => i === index ? { ...item, ...update } : item) });
  }

  function updateTag(index: number, tag: TextValue) {
    patch({ tags: state.tags.map((item, i) => i === index ? tag : item) });
  }

  function loadComponent(id: string) {
    if (!id) {
      const initial = makeDefault();
      setActiveId(null);
      setName('Book a Meeting');
      setState(initial);
      setPreviewHtml(renderPreview(initial));
      setSaved(false);
      return;
    }
    const component = components.find(item => item.id === id);
    if (!component) return;
    setActiveId(component.id);
    setName(component.name);
    setState(component.data);
    setPreviewHtml(renderPreview(component.data));
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
    const initial = makeDefault();
    setState(initial);
    setPreviewHtml(renderPreview(initial));
    setSaved(false);
  }

  function generate() {
    setPreviewHtml(renderPreview(state));
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
              <Field label="Calendly height"><input type="number" className="input" value={state.calendlyHeight} onChange={event => patch({ calendlyHeight: Number(event.target.value) })} /></Field>
            </div>
          </div>

          <div>
            <p className="section-label">Left Rail</p>
            <RichTextField label="Eyebrow" value={asText(state.leftEyebrow, 'bookEyebrow')} defaultKey="bookEyebrow" onChange={leftEyebrow => patch({ leftEyebrow })} />
            <RichTextField label="Title" value={asText(state.leftTitle, 'bookIntroTitle')} defaultKey="bookIntroTitle" onChange={leftTitle => patch({ leftTitle })} />
            <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Who should book? items</p>
            <div className="space-y-2 mb-2">
              {state.bullets.map((item, index) => (
                <div key={index} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <RichTextField label={`Item ${index + 1}`} multiline value={asText(item.text, 'bookBullet')} defaultKey="bookBullet" onChange={text => updateBullet(index, text)} />
                  <button className="btn-danger text-xs" onClick={() => patch({ bullets: state.bullets.filter((_, i) => i !== index) })}>Remove</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mb-3 w-full justify-center text-xs" onClick={() => patch({ bullets: [...state.bullets, { text: normalizeText('', 'bookBullet') }] })}>+ Add item</button>
            <RichTextField label="What to expect heading" value={asText(state.expectTitle, 'bookCardTitle')} defaultKey="bookCardTitle" onChange={expectTitle => patch({ expectTitle })} />
            <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">What to expect items</p>
            <div className="space-y-2 mb-2">
              {state.expectItems.map((item, index) => (
                <div key={index} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Icon"><input className="input" value={item.icon} onChange={event => updateExpect(index, { icon: event.target.value })} /></Field>
                    <Field label="Icon background"><input className="input" value={item.iconBg} onChange={event => updateExpect(index, { iconBg: event.target.value })} /></Field>
                  </div>
                  <RichTextField label="Title" value={asText(item.title, 'bookExpectTitle')} defaultKey="bookExpectTitle" onChange={title => updateExpect(index, { title })} />
                  <RichTextField label="Description" multiline value={asText(item.desc, 'bookExpectDesc')} defaultKey="bookExpectDesc" onChange={desc => updateExpect(index, { desc })} />
                  <button className="btn-danger text-xs" onClick={() => patch({ expectItems: state.expectItems.filter((_, i) => i !== index) })}>Remove</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mb-3 w-full justify-center text-xs" onClick={() => patch({ expectItems: [...state.expectItems, { icon: '', iconBg: '#eef4ff', title: normalizeText('', 'bookExpectTitle'), desc: normalizeText('', 'bookExpectDesc') }] })}>+ Add expectation</button>
          </div>

          <div>
            <p className="section-label">Tutor Card</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Initials"><input className="input" value={state.tutorInitials} onChange={event => patch({ tutorInitials: event.target.value })} /></Field>
            </div>
            <RichTextField label="Name" value={asText(state.tutorName, 'bookTutorName')} defaultKey="bookTutorName" onChange={tutorName => patch({ tutorName })} />
            <RichTextField label="Role" value={asText(state.tutorRole, 'bookTutorRole')} defaultKey="bookTutorRole" onChange={tutorRole => patch({ tutorRole })} />
            <RichTextField label="Bio" multiline value={asText(state.tutorBio, 'bookTutorBio')} defaultKey="bookTutorBio" onChange={tutorBio => patch({ tutorBio })} />
          </div>

          <div>
            <p className="section-label">Calendar</p>
            <RichTextField label="Meeting title" value={asText(state.meetingTitle, 'bookMeetingTitle')} defaultKey="bookMeetingTitle" onChange={meetingTitle => patch({ meetingTitle })} />
            <RichTextField label="Subtitle" value={asText(state.meetingSubtitle, 'bookMeetingSub')} defaultKey="bookMeetingSub" onChange={meetingSubtitle => patch({ meetingSubtitle })} />
            <p className="text-xs font-semibold text-slate-500 mt-2 mb-1">Tags</p>
            <div className="space-y-2 mb-2">
              {state.tags.map((tag, index) => (
                <div key={index} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <RichTextField label={`Tag ${index + 1}`} value={asText(tag, 'bookTag')} defaultKey="bookTag" onChange={value => updateTag(index, value)} />
                  <button className="btn-danger text-xs" onClick={() => patch({ tags: state.tags.filter((_, i) => i !== index) })}>Remove</button>
                </div>
              ))}
            </div>
            <button className="btn-ghost mb-3 w-full justify-center text-xs" onClick={() => patch({ tags: [...state.tags, normalizeText('', 'bookTag')] })}>+ Add tag</button>
            <Field label="Calendly URL">
              <input className="input" value={state.calendlyUrl} onChange={event => patch({ calendlyUrl: event.target.value })} />
            </Field>
          </div>

          <div>
            <p className="section-label">Direct Contact</p>
            <RichTextField label="Title" value={asText(state.contactTitle, 'bookEyebrow')} defaultKey="bookEyebrow" onChange={contactTitle => patch({ contactTitle })} />
            <RichTextField label="Email" value={asText(state.contactEmail, 'bookContactText')} defaultKey="bookContactText" onChange={contactEmail => patch({ contactEmail })} />
            <RichTextField label="WhatsApp" value={asText(state.contactWhatsapp, 'bookContactText')} defaultKey="bookContactText" onChange={contactWhatsapp => patch({ contactWhatsapp })} />
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
