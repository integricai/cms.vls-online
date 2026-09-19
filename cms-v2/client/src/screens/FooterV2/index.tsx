import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { FooterData, FooterLink, FooterSection, FooterSocial, FooterV2Data, HeaderConfig, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateFooterV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let linkCounter = 0;
let socialCounter = 0;

function newLink(): FooterLink {
  return { id: `fl${++linkCounter}`, label: normalize('', 'footerLink'), url: '' };
}

function newSocial(): FooterSocial {
  return { id: `fs${++socialCounter}`, platform: 'facebook', url: '' };
}

function makeDefault(): FooterV2Data {
  return {
    sections: [
      { title: normalize('', 'footerTitle'), links: [] },
      { title: normalize('', 'footerTitle'), links: [] },
      { title: normalize('', 'footerTitle'), links: [] },
    ],
    contact: {
      title: normalize('Contact Us', 'footerContactTitle'),
      address: normalize('', 'footerLink'),
      email: normalize('', 'footerLink'),
      whatsapp: normalize('', 'footerLink'),
    },
    socials: [],
    copyright: { text: normalize('Vertex Learning Solutions. All rights reserved.', 'footerCopyright'), links: [] },
    aboutText: normalize(
      'A dedicated team of academic experts helping accounting and finance professionals excel — through the most comprehensive online courses, delivered on our own learning platform.',
      'footerV2About',
    ),
    ratingText: normalize('Rated 5.0 by students worldwide', 'footerV2Rating'),
    ratingValue: 5,
    logoUrl: '',
    logoAlt: 'Vertex Learning Solutions',
    logoLink: '/',
    siteTitle: normalize('Vertex', 'headerV2SiteTitle'),
    subTitle: normalize('Learning Solutions', 'headerV2SubTitle'),
    siteBaseUrl: 'https://vls-online.com',
  };
}

function hydrateFooter(raw: FooterData): FooterData {
  const d: FooterData = { ...raw };
  d.sections = (d.sections || []);
  while (d.sections.length < 3) d.sections.push({ title: normalize('', 'footerTitle'), links: [] });
  d.sections = d.sections.map(s => ({
    ...s,
    title: s.title ?? normalize('', 'footerTitle'),
    links: (s.links || []).map(l => ({ id: l.id || `fl${++linkCounter}`, label: l.label, url: l.url || '' })),
  }));
  if (!d.copyright) d.copyright = { text: normalize('', 'footerCopyright'), links: [] };
  d.copyright.links = (d.copyright.links || []).map(l => ({ id: l.id || `fl${++linkCounter}`, label: l.label, url: l.url || '' }));
  d.contact = d.contact ?? {
    title: normalize('Contact Us', 'footerContactTitle'),
    address: normalize('', 'footerLink'),
    email: normalize('', 'footerLink'),
    whatsapp: normalize('', 'footerLink'),
  };
  d.socials = (d.socials || []).map(s => ({ id: s.id || `fs${++socialCounter}`, platform: s.platform, url: s.url }));
  return d;
}

function fromFooterV1(raw: FooterData, header?: HeaderConfig | null): FooterV2Data {
  const base = makeDefault();
  const footer = hydrateFooter(raw);
  return {
    ...base,
    ...footer,
    logoUrl: header?.logoUrl || base.logoUrl,
    logoAlt: header?.logoAlt || base.logoAlt,
    logoLink: header?.logoLink || base.logoLink,
    siteTitle: header?.siteTitle ? normalize(header.siteTitle, 'headerV2SiteTitle') : base.siteTitle,
    subTitle: header?.subTitle ? normalize(header.subTitle, 'headerV2SubTitle') : base.subTitle,
  };
}

function publicFooterUrl(): string {
  const apiBase = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
  return `${apiBase}/api/public/footer-v2`;
}

const SOCIAL_PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok', 'whatsapp'];

function LinkRow({ link, onRemove, onChange }: {
  link: FooterLink;
  onRemove: () => void;
  onChange: (patch: Partial<FooterLink>) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-end mb-1.5">
      <RichTextField label="" value={normalize(link.label, 'footerLink')}
        defaultKey="footerLink" onChange={v => onChange({ label: v })} />
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1">URL</label>
        <input className="input" value={link.url} placeholder="https://..."
          onChange={e => onChange({ url: e.target.value })} />
      </div>
      <button onClick={onRemove} className="btn-danger mb-0.5">✕</button>
    </div>
  );
}

export default function FooterV2Screen() {
  const [data, setData] = useState<FooterV2Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ data: FooterV2Data }>(`/content/vls-footer-v2`).catch(() => null),
      api.get<{ data: FooterData }>(`/content/vls-footer`).catch(() => null),
      api.get<{ data: { config?: HeaderConfig } }>(`/content/vls-header-config`).catch(() => null),
    ]).then(([v2, v1, header]) => {
      const raw = v2?.data as (FooterV2Data & { footer?: FooterV2Data }) | undefined;
      const savedV2 = raw?.aboutText !== undefined || raw?.ratingText !== undefined
        ? raw
        : raw?.footer;
      if (savedV2 && (savedV2.sections || savedV2.aboutText)) {
        setData({ ...makeDefault(), ...hydrateFooter(savedV2), ...savedV2 });
        return;
      }
      let v1Raw = v1?.data as FooterData & { footer?: FooterData };
      const footer = (v1Raw?.footer && typeof v1Raw.footer === 'object' && !Array.isArray(v1Raw.footer))
        ? v1Raw.footer
        : v1Raw;
      if (footer && (footer.sections || footer.contact)) {
        setData(fromFooterV1(footer, header?.data?.config));
      } else {
        setData(makeDefault());
      }
    }).catch(() => setData(makeDefault()))
      .finally(() => setLoading(false));
  }, []);

  const patch = useCallback((fn: (d: FooterV2Data) => FooterV2Data) => {
    setData(prev => prev ? fn({ ...prev }) : prev);
    setSaved(false);
  }, []);

  function updateSection(i: number, p: Partial<FooterSection>) {
    patch(d => {
      const sections = [...d.sections];
      sections[i] = { ...sections[i], ...p };
      return { ...d, sections };
    });
  }

  function addLink(sectionIdx: number) {
    patch(d => {
      const sections = [...d.sections];
      sections[sectionIdx] = { ...sections[sectionIdx], links: [...sections[sectionIdx].links, newLink()] };
      return { ...d, sections };
    });
  }

  function updateLink(sectionIdx: number, lid: string, p: Partial<FooterLink>) {
    patch(d => {
      const sections = [...d.sections];
      sections[sectionIdx] = {
        ...sections[sectionIdx],
        links: sections[sectionIdx].links.map(l => l.id === lid ? { ...l, ...p } : l),
      };
      return { ...d, sections };
    });
  }

  function removeLink(sectionIdx: number, lid: string) {
    patch(d => {
      const sections = [...d.sections];
      sections[sectionIdx] = { ...sections[sectionIdx], links: sections[sectionIdx].links.filter(l => l.id !== lid) };
      return { ...d, sections };
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    try {
      await api.put('/content/vls-footer-v2', data);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  function generate() {
    if (!data) return;
    setPreviewHtml(wrapGeneratedHtml('Footer V2', generateFooterV2Html(data, publicFooterUrl())));
    setActiveTab('preview');
  }

  async function publish() {
    await save();
    generate();
  }

  if (loading || !data) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) {
    return normalize(v, key);
  }

  return (
    <div className="flex h-full">
      <div className="w-[460px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Footer V2</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Staging navy footer with about text, circular socials, and star rating. Paste into Zenler school footer.
          </p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
          <button onClick={publish} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Publishing…' : '🚀 Publish'}
          </button>
        </div>

        <div className="px-5 py-4">
          <Field label="Site base URL" hint="Relative links become absolute for Zenler pages">
            <input className="input" value={data.siteBaseUrl}
              onChange={e => patch(d => ({ ...d, siteBaseUrl: e.target.value }))} />
          </Field>
          <Field label="Logo image URL">
            <input className="input" value={data.logoUrl} onChange={e => patch(d => ({ ...d, logoUrl: e.target.value }))} />
          </Field>
          <RichTextField label="Site title" value={asTV(data.siteTitle, 'headerV2SiteTitle')}
            defaultKey="headerV2SiteTitle" onChange={v => patch(d => ({ ...d, siteTitle: v }))} />
          <RichTextField label="Subtitle" value={asTV(data.subTitle, 'headerV2SubTitle')}
            defaultKey="headerV2SubTitle" onChange={v => patch(d => ({ ...d, subTitle: v }))} />
          <RichTextField label="About text" multiline value={asTV(data.aboutText, 'footerV2About')}
            defaultKey="footerV2About" onChange={v => patch(d => ({ ...d, aboutText: v }))} />
          <RichTextField label="Rating text" value={asTV(data.ratingText, 'footerV2Rating')}
            defaultKey="footerV2Rating" onChange={v => patch(d => ({ ...d, ratingText: v }))} />
          <Field label="Rating value (0–5)">
            <input type="number" min={0} max={5} step={0.1} className="input" value={data.ratingValue}
              onChange={e => patch(d => ({ ...d, ratingValue: Number(e.target.value) }))} />
          </Field>

          {data.sections.map((sec, i) => (
            <div key={i}>
              <p className="section-label">Section {i + 1}</p>
              <RichTextField label="Title" value={asTV(sec.title, 'footerTitle')}
                defaultKey="footerTitle" onChange={v => updateSection(i, { title: v })} />
              <div className="mb-1">
                <span className="text-xs font-medium text-slate-500">Links</span>
                <div className="mt-1">
                  {sec.links.map(link => (
                    <LinkRow key={link.id} link={link}
                      onRemove={() => removeLink(i, link.id)}
                      onChange={p => updateLink(i, link.id, p)} />
                  ))}
                </div>
                <button onClick={() => addLink(i)} className="btn-ghost text-xs w-full mt-1">+ Add link</button>
              </div>
            </div>
          ))}

          <p className="section-label">Contact Column</p>
          <RichTextField label="Title" value={asTV(data.contact.title, 'footerContactTitle')}
            defaultKey="footerContactTitle" onChange={v => patch(d => ({ ...d, contact: { ...d.contact, title: v } }))} />
          <RichTextField label="Address" multiline value={asTV(data.contact.address, 'footerLink')}
            defaultKey="footerLink" onChange={v => patch(d => ({ ...d, contact: { ...d.contact, address: v } }))} />
          <RichTextField label="Email" value={asTV(data.contact.email, 'footerLink')}
            defaultKey="footerLink" onChange={v => patch(d => ({ ...d, contact: { ...d.contact, email: v } }))} />
          <RichTextField label="WhatsApp" value={asTV(data.contact.whatsapp, 'footerLink')}
            defaultKey="footerLink" onChange={v => patch(d => ({ ...d, contact: { ...d.contact, whatsapp: v } }))} />

          <p className="section-label">Social Links</p>
          <div className="space-y-2 mb-2">
            {data.socials.map(s => (
              <div key={s.id} className="flex gap-2 items-end">
                <Field label="Platform">
                  <select className="input" value={s.platform}
                    onChange={e => patch(d => ({ ...d, socials: d.socials.map(x => x.id === s.id ? { ...x, platform: e.target.value } : x) }))}>
                    {SOCIAL_PLATFORMS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </Field>
                <Field label="URL">
                  <input className="input" value={s.url} placeholder="https://..."
                    onChange={e => patch(d => ({ ...d, socials: d.socials.map(x => x.id === s.id ? { ...x, url: e.target.value } : x) }))} />
                </Field>
                <button onClick={() => patch(d => ({ ...d, socials: d.socials.filter(x => x.id !== s.id) }))} className="btn-danger mb-0.5">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => patch(d => ({ ...d, socials: [...d.socials, newSocial()] }))} className="btn-ghost text-xs w-full mb-1">+ Add social</button>

          <p className="section-label">Copyright Bar</p>
          <RichTextField label="Copyright text" value={asTV(data.copyright.text, 'footerCopyright')}
            defaultKey="footerCopyright" onChange={v => patch(d => ({ ...d, copyright: { ...d.copyright, text: v } }))} />
          <div className="mb-1">
            <span className="text-xs font-medium text-slate-500">Legal links</span>
            <div className="mt-1">
              {data.copyright.links.map(link => (
                <LinkRow key={link.id} link={link}
                  onRemove={() => patch(d => ({ ...d, copyright: { ...d.copyright, links: d.copyright.links.filter(l => l.id !== link.id) } }))}
                  onChange={p => patch(d => ({ ...d, copyright: { ...d.copyright, links: d.copyright.links.map(l => l.id === link.id ? { ...l, ...p } : l) } }))} />
              ))}
            </div>
            <button onClick={() => patch(d => ({ ...d, copyright: { ...d.copyright, links: [...d.copyright.links, newLink()] } }))} className="btn-ghost text-xs w-full mt-1">+ Add legal link</button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize transition border-b-2 -mb-px ${
                activeTab === tab ? 'border-brand text-brand' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}>
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>

        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0">${previewHtml}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-scripts"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600">
              Copy
            </button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click ⚡ Generate HTML first'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
