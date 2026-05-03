import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { Banner, BannerContent, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateBannerHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let idCounter = 0;

function newBanner(): Banner {
  idCounter++;
  return {
    id: `bn${idCounter}`,
    name: '',
    visible: true,
    title:   normalize('', 'bannerTitle'),
    sub:     normalize('', 'bannerSubtitle'),
    ctaText: normalize('', 'bannerCta'),
    ctaUrl: '',
    days: 0, hours: 0, mins: 0, secs: 0,
    bg: '#204280', fg: '#ffffff', btnBg: '#e63946', btnFg: '#ffffff',
    padLeft: 24, padRight: 24,
  };
}

function ColorPair({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex gap-2 items-center">
        <input type="color" value={value}
          onChange={e => onChange(e.target.value)}
          className="w-10 h-9 p-0.5 border border-slate-300 rounded cursor-pointer shrink-0" />
        <input type="text" value={value} className="input"
          onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} />
      </div>
    </Field>
  );
}

function BannerForm({ banner: b, onChange }: { banner: Banner; onChange: (patch: Partial<Banner>) => void }) {
  function asTextData(v: TextValue, key: Parameters<typeof normalize>[1]): TextData { return normalize(v, key); }

  return (
    <div className="space-y-0">
      <p className="section-label">Identity</p>
      <Field label="Banner name" hint="CMS only">
        <input className="input" value={b.name} placeholder="e.g. March Promo Banner"
          onChange={e => onChange({ name: e.target.value })} />
      </Field>
      <Field label="Status">
        <select className="input" value={String(b.visible)}
          onChange={e => onChange({ visible: e.target.value === 'true' })}>
          <option value="true">Visible — show on all pages</option>
          <option value="false">Hidden — do not show</option>
        </select>
      </Field>

      <p className="section-label">Content</p>
      <RichTextField label="Banner title / message" value={asTextData(b.title, 'bannerTitle')}
        defaultKey="bannerTitle" onChange={v => onChange({ title: v })} />
      <RichTextField label="Sub-message (optional)" value={asTextData(b.sub, 'bannerSubtitle')}
        defaultKey="bannerSubtitle" onChange={v => onChange({ sub: v })} />
      <RichTextField label="CTA button label" value={asTextData(b.ctaText, 'bannerCta')}
        defaultKey="bannerCta" onChange={v => onChange({ ctaText: v })} />
      <Field label="CTA URL">
        <input className="input" value={b.ctaUrl} placeholder="https://..."
          onChange={e => onChange({ ctaUrl: e.target.value })} />
      </Field>

      <p className="section-label">Countdown timer</p>
      <div className="grid grid-cols-4 gap-2">
        {(['days', 'hours', 'mins', 'secs'] as const).map(k => (
          <Field key={k} label={k.charAt(0).toUpperCase() + k.slice(1)}>
            <input type="number" className="input" min={0} max={k === 'days' ? 9999 : 59}
              value={b[k]}
              onChange={e => onChange({ [k]: parseInt(e.target.value) || 0 })} />
          </Field>
        ))}
      </div>

      <p className="section-label">Colours</p>
      <div className="grid grid-cols-2 gap-2">
        <ColorPair label="Background" value={b.bg} onChange={v => onChange({ bg: v })} />
        <ColorPair label="Text colour" value={b.fg} onChange={v => onChange({ fg: v })} />
        <ColorPair label="Button background" value={b.btnBg} onChange={v => onChange({ btnBg: v })} />
        <ColorPair label="Button text" value={b.btnFg} onChange={v => onChange({ btnFg: v })} />
      </div>

      <p className="section-label">Spacing</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Padding left (px)">
          <input type="number" className="input" min={0} max={200} value={b.padLeft}
            onChange={e => onChange({ padLeft: Number(e.target.value) })} />
        </Field>
        <Field label="Padding right (px)">
          <input type="number" className="input" min={0} max={200} value={b.padRight}
            onChange={e => onChange({ padRight: Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
}

export default function BannerScreen() {
  const [banners, setBanners]     = useState<Banner[]>([]);
  const [activeId, setActiveId]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished]   = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');

  const active = banners.find(b => b.id === activeId) ?? null;

  useEffect(() => {
    api.get<{ data: BannerContent }>('/content/vls-banners')
      .then(row => {
        const bns: Banner[] = (row?.data as BannerContent)?.banners ?? [];
        bns.forEach(b => {
          const n = parseInt(b.id.replace('bn', ''), 10);
          if (n > idCounter) idCounter = n;
        });
        if (bns.length > 0) {
          setBanners(bns);
          setActiveId(bns[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (active) {
      const totalMs = ((active.days || 0) * 86400 + (active.hours || 0) * 3600 + (active.mins || 0) * 60 + (active.secs || 0)) * 1000;
      setPreviewHtml(wrapGeneratedHtml('Banner', generateBannerHtml(active, Date.now() + totalMs)));
    }
  }, [active]);

  const updateActive = useCallback((patch: Partial<Banner>) => {
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

  function deleteBanner(id: string) {
    setBanners(prev => {
      const next = prev.filter(b => b.id !== id);
      if (activeId === id) setActiveId(next[0]?.id ?? null);
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
        setPreviewHtml(wrapGeneratedHtml('Banner', generateBannerHtml(active, Date.now() + totalMs)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await api.put('/content/vls-banners', { banners });
      setPublished(true);
    } finally {
      setPublishing(false);
    }
  }

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-slate-400">Loading…</div>;
  }

  return (
    <div className="flex h-full">
      <div className="w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <h1 className="text-base font-bold text-slate-900">Banners</h1>
          <p className="text-xs text-slate-400 mt-0.5">Countdown banners shown across all pages</p>
        </div>

        <div className="border-b border-slate-100 bg-white px-5 py-3 flex gap-2">
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={publish} disabled={publishing} className="btn-success flex-1 justify-center">
            {publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish'}
          </button>
        </div>

        <div className="px-5 py-4">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Banners</span>
              <button onClick={addBanner} className="btn-ghost text-xs py-1 px-2">+ New</button>
            </div>
            {banners.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No banners yet.</p>
            ) : (
              <div className="space-y-1">
                {banners.map(b => (
                  <div key={b.id} onClick={() => setActiveId(b.id)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${
                      b.id === activeId
                        ? 'bg-brand text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs ${b.id === activeId ? 'text-white/70' : 'text-slate-400'}`}>
                        {b.visible ? '●' : '○'}
                      </span>
                      <span className="truncate font-medium">{b.name || 'Untitled'}</span>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteBanner(b.id); }}
                      className={`ml-2 shrink-0 text-xs ${b.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {active && <BannerForm banner={active} onChange={updateActive} />}
        </div>

      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <span className="text-sm font-medium text-slate-500">Live Preview</span>
        </div>
        <iframe
          srcDoc={previewHtml
            ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${previewHtml}</body></html>`
            : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a banner and click 💾 Save to preview.</p>'
          }
          className="flex-1 w-full border-0 bg-slate-50"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
