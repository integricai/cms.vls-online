import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState, useCallback } from 'react';
import { api } from '../../api/client';
import { normalize } from '../../utils/text';
import { generateBannerHtml } from './generateHtml';
import Field from '../../components/Field';
import RichTextField from '../../components/RichTextField';
import { wrapGeneratedHtml } from '../../utils/htmlComments';
let idCounter = 0;
const BANNER_API_URL = 'https://api.cms.vls-online.com/api/publish-banner';
function newBanner() {
    idCounter++;
    return {
        id: `bn${idCounter}`,
        name: '',
        visible: true,
        hideOnExpiry: true,
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
    return (_jsxs("div", { className: "space-y-0", children: [_jsx("p", { className: "section-label", children: "Identity" }), _jsx(Field, { label: "Banner ID", hint: "Embedded in the inject code \u2014 links this banner to its pages", children: _jsx("input", { className: "input font-mono bg-slate-50 text-slate-500 select-all", value: b.id, readOnly: true }) }), _jsx(Field, { label: "Banner name", hint: "CMS only", children: _jsx("input", { className: "input", value: b.name, placeholder: "e.g. March Promo Banner", onChange: e => onChange({ name: e.target.value }) }) }), _jsx(Field, { label: "Status", children: _jsxs("select", { className: "input", value: String(b.visible), onChange: e => onChange({ visible: e.target.value === 'true' }), children: [_jsx("option", { value: "true", children: "Visible \u2014 show on all pages" }), _jsx("option", { value: "false", children: "Hidden \u2014 do not show" })] }) }), _jsx(Field, { label: "When timer expires", children: _jsxs("select", { className: "input", value: b.hideOnExpiry ? 'hide' : 'keep', onChange: e => onChange({ hideOnExpiry: e.target.value === 'hide' }), children: [_jsx("option", { value: "hide", children: "Hide banner automatically" }), _jsx("option", { value: "keep", children: "Keep banner visible (no countdown)" })] }) }), _jsx("p", { className: "section-label", children: "Content" }), _jsx(RichTextField, { label: "Banner title / message", value: asTextData(b.title, 'bannerTitle'), defaultKey: "bannerTitle", onChange: v => onChange({ title: v }) }), _jsx(RichTextField, { label: "Sub-message (optional)", value: asTextData(b.sub, 'bannerSubtitle'), defaultKey: "bannerSubtitle", onChange: v => onChange({ sub: v }) }), _jsx(RichTextField, { label: "CTA button label", value: asTextData(b.ctaText, 'bannerCta'), defaultKey: "bannerCta", onChange: v => onChange({ ctaText: v }) }), _jsx(Field, { label: "CTA URL", children: _jsx("input", { className: "input", value: b.ctaUrl, placeholder: "https://...", onChange: e => onChange({ ctaUrl: e.target.value }) }) }), _jsx("p", { className: "section-label", children: "Countdown timer" }), _jsx("div", { className: "grid grid-cols-4 gap-2", children: ['days', 'hours', 'mins', 'secs'].map(k => (_jsx(Field, { label: k.charAt(0).toUpperCase() + k.slice(1), children: _jsx("input", { type: "number", className: "input", min: 0, max: k === 'days' ? 9999 : 59, value: b[k], onChange: e => onChange({ [k]: parseInt(e.target.value) || 0 }) }) }, k))) }), _jsx("p", { className: "section-label", children: "Colours" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(ColorPair, { label: "Background", value: b.bg, onChange: v => onChange({ bg: v }) }), _jsx(ColorPair, { label: "Text colour", value: b.fg, onChange: v => onChange({ fg: v }) }), _jsx(ColorPair, { label: "Button background", value: b.btnBg, onChange: v => onChange({ btnBg: v }) }), _jsx(ColorPair, { label: "Button text", value: b.btnFg, onChange: v => onChange({ btnFg: v }) })] }), _jsx("p", { className: "section-label", children: "Spacing" }), _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Padding left (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: b.padLeft, onChange: e => onChange({ padLeft: Number(e.target.value) }) }) }), _jsx(Field, { label: "Padding right (px)", children: _jsx("input", { type: "number", className: "input", min: 0, max: 200, value: b.padRight, onChange: e => onChange({ padRight: Number(e.target.value) }) }) })] })] }));
}
function durationMs(banner) {
    return ((banner.days || 0) * 86400 + (banner.hours || 0) * 3600 + (banner.mins || 0) * 60 + (banner.secs || 0)) * 1000;
}
function buildInjectCode(banner) {
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
  function int(v,f,mn,mx){var n=parseInt(v,10);if(isNaN(n))n=f;return Math.max(mn,Math.min(mx,n));}
  function normText(v,d){var raw=v;if(!raw||typeof raw!=="object"||Array.isArray(raw))raw={text:v==null?"":String(v)};return{text:String(raw.text||""),size:int(raw.size,d.size,10,72),color:safeHex(raw.color,d.color),weight:String(raw.weight||raw.bold&&"700"||d.weight||"400"),letterSpacing:Number(raw.letterSpacing||0)};}
  function textStyle(t){return "font-size:"+t.size+"px;font-weight:"+t.weight+";color:"+t.color+";letter-spacing:"+t.letterSpacing+"px;";}
  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    var s=document.createElement("style");
    s.id=STYLE_ID;
    s.textContent="#"+ROOT_ID+"{position:sticky;top:0;width:100%;z-index:9999;box-sizing:border-box;}#"+ROOT_ID+" *{box-sizing:border-box;}#"+ROOT_ID+" .vls-unit{display:flex;flex-direction:column;align-items:center;gap:2px;}#"+ROOT_ID+" .vls-num{font-size:20px;font-weight:700;line-height:1;font-family:Poppins,sans-serif;}#"+ROOT_ID+" .vls-lbl{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75;font-family:Poppins,sans-serif;}#"+ROOT_ID+" .vls-sep{font-size:24px;font-weight:700;line-height:1;padding:0 4px;margin-top:-4px;opacity:0.6;}#"+ROOT_ID+" .vls-close{position:absolute;top:50%;right:12px;transform:translateY(-50%);background:none;border:none;cursor:pointer;opacity:.65;font-size:20px;line-height:1;padding:4px 6px;color:inherit;font-family:sans-serif;}@media(max-width:600px){#"+ROOT_ID+" .vls-bn-wrap{flex-direction:column!important;padding-top:12px!important;padding-bottom:12px!important;}#"+ROOT_ID+" .vls-bn-text{width:100%!important;flex:none!important;}#"+ROOT_ID+" .vls-bn-right{width:100%!important;align-items:center!important;margin-top:10px!important;}#"+ROOT_ID+" .vls-bn-cta{display:none!important;}}";
    document.head.appendChild(s);
  }
  function tick(endsAt,hideOnExpiry){
    if(timer)clearInterval(timer);
    function run(){
      var r=Math.max(0,endsAt-Date.now());
      var dEl=document.getElementById("vls-"+BID+"-d");if(!dEl)return;
      dEl.textContent=pad(Math.floor(r/86400000));
      document.getElementById("vls-"+BID+"-h").textContent=pad(Math.floor((r%86400000)/3600000));
      document.getElementById("vls-"+BID+"-m").textContent=pad(Math.floor((r%3600000)/60000));
      document.getElementById("vls-"+BID+"-s").textContent=pad(Math.floor((r%60000)/1000));
      if(r<=0){
        clearInterval(timer);timer=null;
        if(hideOnExpiry){var el=document.getElementById(ROOT_ID);if(el)el.style.display="none";}
      }
    }
    run();timer=setInterval(run,1000);
  }
  function render(b){
    var el=document.getElementById(ROOT_ID);
    if(!b||!b.visible){if(el)el.style.display="none";return;}
    try{if(sessionStorage.getItem("vls-bn-dismissed-"+BID)==="1"){if(el)el.style.display="none";return;}}catch(e){}
    var hideOnExpiry=!!b.hideOnExpiry;
    var deadline=parseInt(b.deadline,10)||0;
    var remaining=deadline?Math.max(0,deadline-Date.now()):0;
    if(deadline&&remaining<=0&&hideOnExpiry){if(el)el.style.display="none";return;}
    var showTimer=deadline>0&&remaining>0;
    ensureStyle();
    if(!el){el=document.createElement("div");el.id=ROOT_ID;document.body.insertBefore(el,document.body.firstChild);}
    var bg=safeHex(b.bg,"#204280"),fg=safeHex(b.fg,"#ffffff"),btnBg=safeHex(b.btnBg,"#e63946"),btnFg=safeHex(b.btnFg,"#ffffff");
    var title=normText(b.title,{size:15,color:fg,weight:"500"});
    var sub=normText(b.sub,{size:12,color:fg,weight:"400"});
    var cta=normText(b.ctaText,{size:13,color:btnFg,weight:"500"});
    var pL=int(b.padLeft,24,0,200),pR=int(b.padRight,24,0,200);
    var ctaHtml=cta.text?'<div class="vls-bn-cta" style="flex-shrink:0;"><a href="'+escAttr(b.ctaUrl||"#")+'" style="display:inline-block;padding:8px 20px;background:'+btnBg+';border-radius:6px;text-decoration:none;white-space:nowrap;'+textStyle(cta)+'">'+escHtml(cta.text)+'</a></div>':'';
    el.style.display="";
    el.style.background=bg;
    el.innerHTML='<div class="vls-bn-wrap" style="display:flex;align-items:center;justify-content:space-between;padding:10px '+pR+'px 10px '+pL+'px;gap:16px;">'
      +'<div class="vls-bn-text" style="flex:1;min-width:0;">'
      +(title.text?'<div style="font-family:Poppins,sans-serif;line-height:1.3;'+textStyle(title)+'">'+escHtml(title.text)+'</div>':'')
      +(sub.text?'<div style="font-family:Poppins,sans-serif;opacity:.8;margin-top:3px;'+textStyle(sub)+'">'+escHtml(sub.text)+'</div>':'')
      +'</div>'
      +(showTimer
        ?'<div class="vls-bn-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;"><div style="display:flex;align-items:center;gap:6px;">'
          +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-d" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Days</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
          +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-h" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Hours</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
          +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-m" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Mins</span></div><span class="vls-sep" style="color:'+fg+'">:</span>'
          +'<div class="vls-unit"><span class="vls-num" id="vls-'+BID+'-s" style="color:'+fg+'">00</span><span class="vls-lbl" style="color:'+fg+'">Secs</span></div></div>'
          +ctaHtml+'</div>'
        :ctaHtml)
      +'<button class="vls-close" aria-label="Close" style="color:'+fg+'">&#215;</button></div>';
    var cls=el.querySelector(".vls-close");
    if(cls)cls.onclick=function(){try{sessionStorage.setItem("vls-bn-dismissed-"+BID,"1");}catch(e){}el.style.display="none";};
    if(showTimer)tick(deadline,hideOnExpiry);
  }
  function load(){
    fetch(API+"?t="+Date.now()).then(function(r){
      if(!r.ok)throw new Error("VLS Banner API returned "+r.status);
      return r.json();
    }).then(function(data){
      var b=(data.banners||[]).find(function(x){return x.id===BID;});
      render(b);
    }).catch(function(e){console.error("VLS Banner ["+BID+"]:",e.message||e);});
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();
</script>`;
}
export default function BannerScreen() {
    const [banners, setBanners] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [published, setPublished] = useState(false);
    const [publishError, setPublishError] = useState('');
    const [injectCode, setInjectCode] = useState('');
    const [activeTab, setActiveTab] = useState('preview');
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
    const updateActive = useCallback((patch) => {
        setBanners(prev => prev.map(b => b.id === activeId ? { ...b, ...patch } : b));
        setSaved(false);
        setPublished(false);
        setPublishError('');
    }, [activeId]);
    function selectBanner(id) {
        setActiveId(id);
        setInjectCode('');
        setSaved(false);
        setPublished(false);
        setPublishError('');
        setActiveTab('preview');
    }
    function addBanner() {
        const b = newBanner();
        setBanners(prev => [...prev, b]);
        setActiveId(b.id);
        setInjectCode('');
        setSaved(false);
        setPublished(false);
        setPublishError('');
        setActiveTab('preview');
    }
    function deleteBanner(id) {
        setBanners(prev => {
            const next = prev.filter(b => b.id !== id);
            if (activeId === id) {
                setActiveId(next[0]?.id ?? null);
                setInjectCode('');
                setActiveTab('preview');
            }
            return next;
        });
        setSaved(false);
        setPublished(false);
    }
    async function saveAndGenerate() {
        if (!active)
            return;
        setSaving(true);
        setSaved(false);
        try {
            await api.put('/content/vls-banners', { banners });
            setSaved(true);
            setPublished(false);
            setPublishError('');
            const code = buildInjectCode(active);
            setInjectCode(code);
            setActiveTab('html');
        }
        finally {
            setSaving(false);
        }
    }
    async function publish() {
        if (!active)
            return;
        setPublishing(true);
        setPublishError('');
        try {
            const dur = durationMs(active);
            const deadline = dur > 0 ? Date.now() + dur : undefined;
            const next = banners.map(b => b.id === active.id ? { ...b, deadline } : b);
            setBanners(next);
            await api.put('/content/vls-banners', { banners: next });
            const publishedBanner = next.find(b => b.id === active.id) ?? active;
            setInjectCode(buildInjectCode(publishedBanner));
            setPublished(true);
            setSaved(true);
            setActiveTab('html');
        }
        catch (e) {
            setPublishError(e?.message || 'Publish failed. Please try again.');
        }
        finally {
            setPublishing(false);
        }
    }
    if (loading) {
        return _jsx("div", { className: "flex h-full items-center justify-center text-sm text-slate-400", children: "Loading\u2026" });
    }
    const previewDoc = active
        ? `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;background:#f8f9fc">${wrapGeneratedHtml('Banner', generateBannerHtml(active, Date.now() + durationMs(active)))}</body></html>`
        : '<p style="font-family:sans-serif;color:#94a3b8;padding:24px">Select a banner to preview.</p>';
    return (_jsxs("div", { className: "flex h-full", children: [_jsxs("div", { className: "w-[420px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white", children: [_jsxs("div", { className: "sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4", children: [_jsx("h1", { className: "text-base font-bold text-slate-900", children: "Banners" }), _jsx("p", { className: "text-xs text-slate-400 mt-0.5", children: "Sticky countdown banners \u2014 paste inject code once, publish updates live" })] }), _jsxs("div", { className: "border-b border-slate-100 bg-white px-5 py-3 space-y-2", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { onClick: saveAndGenerate, disabled: saving || !active, className: "btn-primary justify-center text-xs", children: saving ? 'Saving…' : saved ? '✓ Saved' : '💾 Save & Generate HTML' }), _jsx("button", { onClick: publish, disabled: publishing || !active, className: "btn-success justify-center text-xs", children: publishing ? 'Publishing…' : published ? '✓ Published' : '🚀 Publish Banner' })] }), publishError && (_jsx("p", { className: "text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2", children: publishError })), _jsxs("div", { className: "rounded bg-slate-50 border border-slate-200 px-3 py-2 space-y-1", children: [_jsxs("p", { className: "text-[11px] text-slate-500", children: [_jsx("span", { className: "font-semibold", children: "Save & Generate HTML" }), " \u2014 paste the code once into your Zenler site."] }), _jsxs("p", { className: "text-[11px] text-slate-500", children: [_jsx("span", { className: "font-semibold", children: "Publish Banner" }), " \u2014 after the code is pasted, use this to push content and timer changes live without re-pasting."] })] })] }), _jsxs("div", { className: "px-5 py-4", children: [_jsxs("div", { className: "mb-4", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "text-xs font-semibold uppercase tracking-widest text-slate-400", children: "Banners" }), _jsx("button", { onClick: addBanner, className: "btn-ghost text-xs py-1 px-2", children: "+ New" })] }), banners.length === 0 ? (_jsx("p", { className: "text-sm text-slate-400 text-center py-4", children: "No banners yet." })) : (_jsx("div", { className: "space-y-1", children: banners.map(b => (_jsxs("div", { onClick: () => selectBanner(b.id), className: `flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer text-sm transition ${b.id === activeId
                                                ? 'bg-brand text-white'
                                                : 'bg-white border border-slate-200 text-slate-700 hover:border-brand/40'}`, children: [_jsxs("div", { className: "flex items-center gap-2 min-w-0", children: [_jsx("span", { className: `text-xs ${b.id === activeId ? 'text-white/70' : 'text-slate-400'}`, children: b.visible ? '●' : '○' }), _jsx("span", { className: "truncate font-medium", children: b.name || 'Untitled' })] }), _jsx("button", { onClick: e => { e.stopPropagation(); deleteBanner(b.id); }, className: `ml-2 shrink-0 text-xs ${b.id === activeId ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-red-500'}`, children: "\u2715" })] }, b.id))) }))] }), active && _jsx(BannerForm, { banner: active, onChange: updateActive })] })] }), _jsxs("div", { className: "flex flex-1 flex-col overflow-hidden", children: [_jsx("div", { className: "flex border-b border-slate-200 bg-white px-4", children: ['preview', 'html'].map(tab => (_jsx("button", { onClick: () => setActiveTab(tab), className: `-mb-px border-b-2 px-4 py-3 text-sm font-medium capitalize transition ${activeTab === tab
                                ? 'border-brand text-brand'
                                : 'border-transparent text-slate-400 hover:text-slate-700'}`, children: tab === 'html' ? 'HTML (Inject Code)' : 'Preview' }, tab))) }), activeTab === 'preview' ? (_jsx("iframe", { srcDoc: previewDoc, className: "flex-1 w-full border-0 bg-slate-50", sandbox: "allow-same-origin" }, activeId ?? 'empty')) : (_jsxs("div", { className: "relative flex-1 overflow-auto bg-slate-900 p-4", children: [injectCode && (_jsx("button", { onClick: () => navigator.clipboard.writeText(injectCode), className: "absolute right-4 top-4 rounded bg-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-600", children: "Copy" })), _jsx("pre", { className: "text-xs text-slate-300 whitespace-pre-wrap font-mono leading-relaxed", children: injectCode || '// Click 💾 Save & Generate HTML to get the inject code' })] }))] })] }));
}
