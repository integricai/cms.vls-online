import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import type { Banner, BannerContent, TextData, TextValue } from '../../types/cms';
import { normalize } from '../../utils/text';
import { generateBannerHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';

let idCounter = 0;
const BANNER_API_URL = 'https://api.cms.vls-online.com/api/publish-banner';

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

function durationMs(banner: Banner): number {
  return ((banner.days || 0) * 86400 + (banner.hours || 0) * 3600 + (banner.mins || 0) * 60 + (banner.secs || 0)) * 1000;
}

function withoutPublishDeadline(banner: Banner): Banner {
  const { deadline: _deadline, ...next } = banner;
  return next;
}

function buildBannerInjectCode(banner: Banner): string {
  const bid = banner.id;
  return `<script>
(function(){
  var BID=${JSON.stringify(bid)};
  var API=${JSON.stringify(BANNER_API_URL)};
  var ROOT_ID="vls-bn-"+BID;
  var STYLE_ID="vls-bs-"+BID;
  var timer=null;
  function pad(n){return String(n).padStart(2,"0");}
  function escHtml(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function escAttr(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
  function safeHex(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())?String(v).trim():f;}
  function int(v,f,min,max){var n=parseInt(v,10);if(isNaN(n))n=f;return Math.max(min,Math.min(max,n));}
  function normText(v,d){var raw=v;if(!raw||typeof raw!=="object"||Array.isArray(raw))raw={text:v==null?"":String(v)};return {text:String(raw.text||""),size:int(raw.size,d.size,10,72),color:safeHex(raw.color,d.color),weight:String(raw.weight||raw.bold&&"700"||d.weight||"400"),letterSpacing:Number(raw.letterSpacing||0)};}
  function textStyle(t){return "font-size:"+t.size+"px;font-weight:"+t.weight+";color:"+t.color+";letter-spacing:"+t.letterSpacing+"px;";}
  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent="#"+ROOT_ID+"{position:sticky;top:0;width:100%;z-index:9999;box-sizing:border-box;}#"+ROOT_ID+" *{box-sizing:border-box;}#"+ROOT_ID+" .vls-unit{display:flex;flex-direction:column;align-items:center;gap:2px;}#"+ROOT_ID+" .vls-num{font-size:20px;font-weight:700;line-height:1;font-family:Poppins,sans-serif;}#"+ROOT_ID+" .vls-lbl{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75;font-family:Poppins,sans-serif;}#"+ROOT_ID+" .vls-sep{font-size:24px;font-weight:700;line-height:1;padding:0 4px;margin-top:-4px;opacity:0.6;}#"+ROOT_ID+" .vls-close{position:absolute;top:50%;right:12px;transform:translateY(-50%);background:none;border:none;cursor:pointer;opacity:.65;font-size:20px;line-height:1;padding:4px 6px;color:inherit;font-family:sans-serif;}@media(max-width:600px){#"+ROOT_ID+" .vls-bn-wrap{flex-direction:column!important;padding-top:12px!important;padding-bottom:12px!important;}#"+ROOT_ID+" .vls-bn-text{width:100%!important;flex:none!important;}#"+ROOT_ID+" .vls-bn-right{width:100%!important;align-items:center!important;margin-top:10px!important;}#"+ROOT_ID+" .vls-bn-cta{display:none!important;}}";
    document.head.appendChild(s);
  }
  function tick(duration){
    if(timer)clearInterval(timer);
    var endsAt=Date.now()+Math.max(0,duration||0);
    function run(){
      var r=Math.max(0,endsAt-Date.now());
      var d=document.getElementById("vls-"+BID+"-d");if(!d)return;
      document.getElementById("vls-"+BID+"-d").textContent=pad(Math.floor(r/86400000));
      document.getElementById("vls-"+BID+"-h").textContent=pad(Math.floor((r%86400000)/3600000));
      document.getElementById("vls-"+BID+"-m").textContent=pad(Math.floor((r%3600000)/60000));
      document.getElementById("vls-"+BID+"-s").textContent=pad(Math.floor((r%60000)/1000));
      if(r<=0&&timer)clearInterval(timer);
    }
    run();timer=setInterval(run,1000);
  }
  function render(b){
    var el=document.getElementById(ROOT_ID);
    if(!b||!b.visible){if(el)el.style.display="none";return;}
    try{if(sessionStorage.getItem("vls-bn-dismissed-"+BID)==="1"){if(el)el.style.display="none";return;}}catch(e){}
    var duration=Math.max(0,((parseInt(b.days,10)||0)*86400+(parseInt(b.hours,10)||0)*3600+(parseInt(b.mins,10)||0)*60+(parseInt(b.secs,10)||0))*1000);
    ensureStyle();
    if(!el){el=document.createElement("div");el.id=ROOT_ID;document.body.insertBefore(el,document.body.firstChild);}
    var bg=safeHex(b.bg,"#204280"),fg=safeHex(b.fg,"#ffffff"),btnBg=safeHex(b.btnBg,"#e63946"),btnFg=safeHex(b.btnFg,"#ffffff");
    var title=normText(b.title,{size:15,color:fg,weight:"500"});
    var sub=normText(b.sub,{size:12,color:fg,weight:"400"});
    var cta=normText(b.ctaText,{size:13,color:btnFg,weight:"500"});
    var pL=int(b.padLeft,24,0,200),pR=int(b.padRight,24,0,200);
    el.style.display="";
    el.style.background=bg;
    el.innerHTML='<div class="vls-bn-wrap" style="display:flex;align-items:center;justify-content:space-between;padding:10px '+pR+'px 10px '+pL+'px;gap:16px;">'
      +'<div class="vls-bn-text" style="flex:1;min-width:0;">'
      +(title.text?'<div style="font-family:Poppins,sans-serif;line-height:1.3;'+textStyle(title)+'">'+escHtml(title.text)+'</div>':'')
      +(sub.text?'<div style="font-family:Poppins,sans-serif;opacity:.8;margin-top:3px;'+textStyle(sub)+'">'+escHtml(sub.text)+'</div>':'')
      +'</div><div class="vls-bn-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;"><div style="display:flex;align-items:center;gap:6px;">'
      +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-d" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Days</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
      +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-h" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Hours</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
      +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-m" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Mins</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
      +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-s" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Secs</span></div></div>'
      +(cta.text?'<div class="vls-bn-cta"><a href="'+escAttr(b.ctaUrl||"#")+'" style="display:inline-block;padding:8px 20px;background:'+btnBg+';border-radius:6px;text-decoration:none;white-space:nowrap;'+textStyle(cta)+'">'+escHtml(cta.text)+'</a></div>':'')
      +'</div><button class="vls-close" aria-label="Close" style="color:'+fg+'">&#215;</button></div>';
    var cls=el.querySelector(".vls-close");
    if(cls)cls.onclick=function(){try{sessionStorage.setItem("vls-bn-dismissed-"+BID,"1");}catch(e){}el.style.display="none";};
    tick(duration);
  }
  function load(){
    fetch(API+"?t="+Date.now()).then(function(r){return r.json();}).then(function(data){
      var b=(data.banners||[]).find(function(x){return x.id===BID;});
      render(b);
    }).catch(function(e){console.warn("VLS Banner:",e);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();
</script>`;
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
  const [activeTab, setActiveTab] = useState<'preview' | 'html'>('preview');

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

  function generate() {
    if (!active) return;
    setPreviewHtml(buildBannerInjectCode(active));
    setActiveTab('html');
  }

  async function publish() {
    if (!active) return;
    setPublishing(true);
    try {
      const next = banners.map(b => b.id === active.id ? withoutPublishDeadline(b) : b);
      setBanners(next);
      await api.put('/content/vls-banners', { banners: next });
      await api.post('/publish-banner', { banners: next });
      setPreviewHtml(buildBannerInjectCode(next.find(b => b.id === active.id) ?? active));
      setPublished(true);
      setSaved(true);
      setActiveTab('html');
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

        <div className="border-b border-slate-100 bg-white px-5 py-3 grid grid-cols-3 gap-2">
          <button onClick={save} disabled={saving} className="btn-primary justify-center">
            {saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save'}
          </button>
          <button onClick={generate} disabled={!active} className="btn-success justify-center">
            ⚡ Generate HTML
          </button>
          <button onClick={publish} disabled={publishing || !active} className="btn-success justify-center">
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
        <div className="flex border-b border-slate-200 bg-white px-4">
          {(['preview', 'html'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {tab === 'html' ? 'HTML' : 'Preview'}
            </button>
          ))}
        </div>
        {activeTab === 'preview' ? (
          <iframe
            srcDoc={previewHtml
              ? `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;background:#f8f9fc">${wrapGeneratedHtml('Banner', generateBannerHtml(active ?? banners[0], Date.now() + durationMs(active ?? banners[0])) )}</body></html>`
              : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a banner to preview.</p>'
            }
            className="flex-1 w-full border-0 bg-slate-50"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="relative flex-1 overflow-auto bg-slate-900 p-4">
            <button
              onClick={() => navigator.clipboard.writeText(previewHtml)}
              className="absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600"
            >
              Copy
            </button>
            <pre className="text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed">
              {previewHtml || '// Click HTML to generate the one-time banner injection code'}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
