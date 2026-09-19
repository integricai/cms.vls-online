import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import type { HeaderConfig, HeaderV2Config, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { resolveV2LogoUrl } from '../../utils/brand';
import { generateHeaderV2Html } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

const CONTENT_KEY = 'vls-header-v2-config';
const PUBLISH_PATH = '/publish-header-v2';

function isSignInLabel(label: string): boolean {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, ' ');
  return normalized === 'sign in' || normalized === 'signin' || normalized === 'sign-in'
    || normalized === 'login' || normalized === 'log in';
}

function makeDefault(): HeaderV2Config {
  return {
    logoUrl: '',
    logoAlt: 'Vertex Learning Solutions',
    logoLink: '/',
    siteTitle: normalize('Vertex', 'headerV2SiteTitle'),
    subTitle: normalize('Learning Solutions', 'headerV2SubTitle'),
    siteBaseUrl: 'https://vls-online.com',
    signInLabel: normalize('Sign in', 'headerV2SignIn'),
    signInUrl: '/login',
    signInNewTab: false,
    enrolLabel: normalize('Enrol now', 'headerV2Enrol'),
    enrolUrl: '/register',
    enrolBg: '#1e50c8',
    enrolTextColor: '#ffffff',
    enrolNewTab: false,
  };
}

function fromHeaderV1(cfg: HeaderConfig): HeaderV2Config {
  const base = makeDefault();
  const signIn = (cfg.ctas || []).find(c => isSignInLabel(normalize(c.label, 'headerCta').text));
  const enrol = (cfg.ctas || []).find(c => c !== signIn) ?? (cfg.ctas || [])[0];
  return {
    ...base,
    logoUrl: resolveV2LogoUrl(cfg.logoUrl),
    logoAlt: cfg.logoAlt || base.logoAlt,
    logoLink: cfg.logoLink || base.logoLink,
    siteTitle: cfg.siteTitle ? normalize(cfg.siteTitle, 'headerV2SiteTitle') : base.siteTitle,
    subTitle: cfg.subTitle ? normalize(cfg.subTitle, 'headerV2SubTitle') : base.subTitle,
    signInLabel: signIn ? normalize(signIn.label, 'headerV2SignIn') : base.signInLabel,
    signInUrl: signIn?.url || base.signInUrl,
    signInNewTab: signIn?.newTab ?? false,
    enrolLabel: enrol ? normalize(enrol.label, 'headerV2Enrol') : base.enrolLabel,
    enrolUrl: enrol?.url || base.enrolUrl,
    enrolBg: enrol?.bgColor || base.enrolBg,
    enrolTextColor: enrol?.textColor || base.enrolTextColor,
    enrolNewTab: enrol?.newTab ?? false,
  };
}

export default function HeaderV2Screen() {
  const [cfg, setCfg] = useState<HeaderV2Config>(makeDefault());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [published, setPublished] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');
  const [previewHtml, setPreviewHtml] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<{ data: { config?: HeaderV2Config } }>(`/content/${CONTENT_KEY}`).catch(() => null),
      api.get<{ data: { config?: HeaderConfig } }>('/content/vls-header-config').catch(() => null),
    ]).then(([v2, v1]) => {
      const savedConfig = v2?.data?.config;
      if (savedConfig && (savedConfig.logoUrl !== undefined || savedConfig.siteTitle)) {
        setCfg({ ...makeDefault(), ...savedConfig, logoUrl: resolveV2LogoUrl(savedConfig.logoUrl) });
        return;
      }
      const v1Config = v1?.data?.config;
      if (v1Config) setCfg(fromHeaderV1(v1Config));
    }).finally(() => setLoading(false));
  }, []);

  const update = useCallback((patch: Partial<HeaderV2Config>) => {
    setCfg(prev => ({ ...prev, ...patch }));
    setSaved(false);
    setPublished(false);
  }, []);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/content/${CONTENT_KEY}`, { config: cfg });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.put(`/content/${CONTENT_KEY}`, { config: cfg });
      await api.post(PUBLISH_PATH, { config: cfg });
      setSaved(true);
      setPublished(true);
    } finally {
      setPublishing(false);
    }
  }

  function generate() {
    setPreviewHtml(wrapGeneratedHtml('Header V2', generateHeaderV2Html(cfg)));
    setActiveTab('preview');
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  function asTV(v: TextValue, key: Parameters<typeof normalize>[1]) {
    return normalize(v, key);
  }

  return (
    <div className="flex h-full">
      <div className="w-[480px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Header V2</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Staging top bar only — logo, Sign in, Enrol. Paste into Zenler school header. No navigation menu.
          </p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={publish} disabled={publishing} className="btn-primary flex-1 justify-center">
            {publishing ? 'Publishing…' : published ? '✓ Published' : 'Publish'}
          </button>
          <button onClick={generate} className="btn-success flex-1 justify-center">⚡ Generate HTML</button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <Field label="Site base URL" hint="Relative links become absolute for Zenler pages">
            <input className="input" value={cfg.siteBaseUrl}
              onChange={e => update({ siteBaseUrl: e.target.value })} />
          </Field>

          <Field label="Logo image URL" hint="Leave empty to use the blue rounded v mark from staging">
            <input className="input" value={cfg.logoUrl} placeholder="Leave empty for the blue v mark"
              onChange={e => update({ logoUrl: e.target.value })} />
          </Field>
          <Field label="Alt text">
            <input className="input" value={cfg.logoAlt} onChange={e => update({ logoAlt: e.target.value })} />
          </Field>
          <Field label="Logo link">
            <input className="input" value={cfg.logoLink} onChange={e => update({ logoLink: e.target.value })} />
          </Field>

          <RichTextField label="Site title" value={asTV(cfg.siteTitle, 'headerV2SiteTitle')}
            defaultKey="headerV2SiteTitle" onChange={v => update({ siteTitle: v })} />
          <RichTextField label="Subtitle" value={asTV(cfg.subTitle, 'headerV2SubTitle')}
            defaultKey="headerV2SubTitle" onChange={v => update({ subTitle: v })} />

          <p className="section-label">Sign in</p>
          <RichTextField label="Label" value={asTV(cfg.signInLabel, 'headerV2SignIn')}
            defaultKey="headerV2SignIn" onChange={v => update({ signInLabel: v })} />
          <Field label="URL">
            <input className="input" value={cfg.signInUrl} onChange={e => update({ signInUrl: e.target.value })} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={cfg.signInNewTab}
              onChange={e => update({ signInNewTab: e.target.checked })} />
            Open in new tab
          </label>

          <p className="section-label">Enrol</p>
          <RichTextField label="Label" value={asTV(cfg.enrolLabel, 'headerV2Enrol')}
            defaultKey="headerV2Enrol" onChange={v => update({ enrolLabel: v })} />
          <Field label="URL">
            <input className="input" value={cfg.enrolUrl} onChange={e => update({ enrolUrl: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Button BG</label>
              <input type="color" value={cfg.enrolBg} onChange={e => update({ enrolBg: e.target.value })}
                className="w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Text colour</label>
              <input type="color" value={cfg.enrolTextColor} onChange={e => update({ enrolTextColor: e.target.value })}
                className="w-full h-9 p-0.5 border border-slate-300 rounded cursor-pointer" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
            <input type="checkbox" checked={cfg.enrolNewTab}
              onChange={e => update({ enrolNewTab: e.target.checked })} />
            Open in new tab
          </label>
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
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}<div style="padding:48px;font-family:Poppins,sans-serif;color:#64748b">Zenler page content sits here.</div></body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Click ⚡ Generate HTML to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin allow-scripts"
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
