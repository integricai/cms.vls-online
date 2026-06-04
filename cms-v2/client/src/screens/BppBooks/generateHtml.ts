import type { BppBooksState, TextValue } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

const PUBLIC_BOOKS_URL = 'https://api.cms.vls-online.com/api/publish-bpp-books';

function hex(value: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? value! : fallback;
}

function txt(value: TextValue | undefined): string {
  return typeof value === 'string' ? value : value?.text ?? '';
}

function jsString(value: string): string {
  return JSON.stringify(value);
}

export function generateBppBooksHtml(data: BppBooksState): string {
  const uid = 'vlsbpp' + Math.random().toString(36).slice(2, 7);
  const filter = normalize(data.filterStyle, 'bppFilter');
  const meta = normalize(data.metaStyle, 'bppMeta');
  const title = normalize(data.titleStyle, 'bppTitle');
  const desc = normalize(data.descStyle, 'bppDesc');
  const price = normalize(data.priceStyle, 'bppPrice');
  const cta = normalize(data.ctaStyle, 'bppCta');
  const bg = hex(data.bg, '#ffffff');
  const cardBg = hex(data.cardBg, '#ffffff');
  const cardBorder = hex(data.cardBorder, '#dfe8f7');
  const topTintA = hex(data.topTintA, '#f6f9ff');
  const topTintB = hex(data.topTintB, '#ddeaff');
  const imageBg = hex(data.imageBg, '#f2f6ff');
  const filterActiveBg = hex(data.filterActiveBg, '#edf4ff');
  const filterActiveText = hex(data.filterActiveText, '#17335f');
  const filterBorder = hex(data.filterBorder, '#dce7f7');

  const css = `<style>
.${uid}{font-family:Poppins,Arial,sans-serif;background:${bg};padding:${data.padTop}px ${data.padRight}px ${data.padBot}px ${data.padLeft}px;box-sizing:border-box;}
.${uid} *{box-sizing:border-box;}
.${uid}-inner{max-width:${Math.max(720, Number(data.maxWidth) || 1180)}px;margin:0 auto;}
.${uid}-toolbar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:34px;}
.${uid}-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.${uid}-pill{border:1px solid ${filterBorder};background:#fff;border-radius:999px;padding:10px 18px;min-height:38px;cursor:pointer;white-space:nowrap;font-family:Poppins,Arial,sans-serif;${textStyle(filter)}}
.${uid}-pill.is-active{background:${filterActiveBg};color:${filterActiveText};border-color:${filterActiveBg};}
.${uid}-searchwrap{position:relative;min-width:280px;width:min(360px,100%);}
.${uid}-searchwrap svg{position:absolute;left:16px;top:50%;width:14px;height:14px;transform:translateY(-50%);color:#7f9ac2;}
.${uid}-search{width:100%;height:44px;border:1px solid ${filterBorder};border-radius:999px;background:#fff;padding:0 18px 0 42px;outline:none;font-family:Poppins,Arial,sans-serif;${textStyle(filter)}}
.${uid}-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:${Math.max(12, Number(data.gap) || 24)}px;}
.${uid}-card{overflow:hidden;border:1px solid ${cardBorder};border-radius:8px;background:${cardBg};box-shadow:0 16px 38px rgba(30,54,92,.08);}
.${uid}-top{position:relative;height:232px;background:linear-gradient(135deg,${topTintA},${topTintB});display:flex;align-items:center;justify-content:center;padding:18px;}
.${uid}-badge{position:absolute;left:18px;top:16px;border:1px solid #cfe0ff;background:#fff;border-radius:999px;padding:5px 13px;font-family:Poppins,Arial,sans-serif;font-size:11px;font-weight:700;color:#5185ff;}
.${uid}-level{position:absolute;right:18px;top:16px;text-transform:uppercase;${textStyle(meta)}}
.${uid}-cover{width:132px;height:184px;border:1px dashed #cfe0ff;border-radius:4px;background:${imageBg};box-shadow:0 18px 34px rgba(37,70,118,.16);display:flex;align-items:center;justify-content:center;overflow:hidden;}
.${uid}-cover img{width:100%;height:100%;object-fit:cover;display:block;}
.${uid}-placeholder{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;color:#7aa2ff;}
.${uid}-placeholder svg{width:22px;height:22px;}
.${uid}-placeholder strong{font-family:Poppins,sans-serif;font-size:28px;font-weight:500;color:#17335f;line-height:1;}
.${uid}-placeholder span{font-size:9px;font-weight:700;letter-spacing:.15em;color:#9bb0d0;text-transform:uppercase;}
.${uid}-body{padding:20px 22px 22px;}
.${uid}-meta{margin:0 0 5px;text-transform:uppercase;${textStyle(meta)}}
.${uid}-title{margin:0 0 10px;line-height:1.35;font-family:Poppins,sans-serif;${textStyle(title)}}
.${uid}-desc{margin:0 0 16px;line-height:1.65;min-height:42px;${textStyle(desc)}}
.${uid}-price{display:flex;align-items:baseline;gap:8px;margin:0 0 16px;${textStyle(price)}}
.${uid}-was{font-size:13px;color:#9aa9bd;text-decoration:line-through;}
.${uid}-save{font-size:11px;font-weight:700;color:#4b86ff;background:#edf4ff;border-radius:999px;padding:4px 8px;}
.${uid}-cta{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:44px;border:1px solid ${filterBorder};border-radius:8px;background:#fff;text-decoration:none;font-family:Poppins,Arial,sans-serif;${textStyle(cta)}}
.${uid}-pager{display:flex;align-items:center;justify-content:center;gap:7px;margin-top:28px;flex-wrap:wrap;}
.${uid}-page{min-width:36px;height:36px;border:1px solid ${filterBorder};border-radius:8px;background:#fff;cursor:pointer;font-family:Poppins,Arial,sans-serif;${textStyle(filter)}}
.${uid}-page.is-active{background:${filterActiveText};border-color:${filterActiveText};color:#fff;}
.${uid}-page:disabled{opacity:.45;cursor:default;}
.${uid}-empty{grid-column:1/-1;padding:46px 20px;text-align:center;color:${desc.color};font-size:${desc.size}px;}
@media(max-width:980px){.${uid}-grid{grid-template-columns:repeat(2,minmax(0,1fr));}.${uid}-toolbar{align-items:flex-start;flex-direction:column;}.${uid}-searchwrap{width:100%;}}
@media(max-width:640px){.${uid}{padding:${Math.min(data.padTop, 36)}px 18px ${Math.min(data.padBot, 36)}px;}.${uid}-grid{grid-template-columns:1fr;}.${uid}-pill{padding:9px 13px;}.${uid}-top{height:218px;}}
</style>`;

  const markup = `<section class="${uid}">
  <div class="${uid}-inner">
    <div class="${uid}-toolbar">
      <div class="${uid}-filters" id="${uid}-filters"></div>
      <div class="${uid}-searchwrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <input class="${uid}-search" id="${uid}-search" type="search" placeholder="${escapeHtml(data.searchPlaceholder || 'Search a paper - e.g. SBR or Taxation')}">
      </div>
    </div>
    <div class="${uid}-grid" id="${uid}-grid"></div>
    <div class="${uid}-pager" id="${uid}-pager"></div>
  </div>
</section>`;

  const script = `<script data-cfasync="false">
(function(){
var API=${jsString(PUBLIC_BOOKS_URL)},PS=9,ROOT=${jsString(uid)},state={level:"all",q:"",page:1},BOOKS=[];
var LEVELS=[{id:"all",label:"All papers"},{id:"foundation",label:"Foundation"},{id:"knowledge",label:"Applied Knowledge"},{id:"skills",label:"Applied Skills"},{id:"strategic",label:"Strategic Professional"}];
var FD=["FA1","MA1","FA2","MA2","FBT","FMA","FFA","FAB"],AK=["BT","MA","FA"],AS=["LW","PM","TX","FR","AA","FM"],SP=["SBL","SBR","AFM","APM","ATX","AAA"];
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function attr(s){return esc(s).replace(/"/g,"&quot;");}
function money(b){var c=b.currency==="USD"?"$":b.currency==="EUR"?"€":"£",v=Number(b.discountedPrice!=null?b.discountedPrice:b.price)||0;return c+v.toFixed(2);}
function was(b){var c=b.currency==="USD"?"$":b.currency==="EUR"?"€":"£";return c+(Number(b.price)||0).toFixed(2);}
function code(title){var m=String(title||"").match(/\\b(FA1|MA1|FA2|MA2|FBT|FMA|FFA|FAB|SBL|SBR|AFM|APM|ATX|AAA|BT|MA|FA|LW|PM|TX|FR|AA|FM)\\b/i);return m?m[1].toUpperCase():"";}
function level(b){var c=code(b.title);if(FD.indexOf(c)>=0)return"foundation";if(AK.indexOf(c)>=0)return"knowledge";if(AS.indexOf(c)>=0)return"skills";if(SP.indexOf(c)>=0)return"strategic";return"other";}
function levelLabel(id){return id==="foundation"?"Foundation":id==="knowledge"?"Knowledge":id==="skills"?"Skills":id==="strategic"?"Strategic":"";}
function paperName(title){return String(title||"").replace(/^ACCA\\s*[-–]?\\s*/i,"").trim();}
function filtered(){var q=state.q.toLowerCase().trim();return BOOKS.filter(function(b){if(state.level!=="all"&&level(b)!==state.level)return false;if(!q)return true;return (String(b.title||"")+" "+String(b.description||"")+" "+String(b.imageAltText||"")+" "+code(b.title)).toLowerCase().indexOf(q)>=0;});}
function renderFilters(){var el=document.getElementById(ROOT+"-filters");if(!el)return;el.innerHTML=LEVELS.map(function(l){var count=l.id==="all"?BOOKS.length:BOOKS.filter(function(b){return level(b)===l.id;}).length;return '<button type="button" class="'+ROOT+'-pill'+(state.level===l.id?' is-active':'')+'" data-level="'+l.id+'">'+esc(l.label)+(l.id==="all"?'':'')+'</button>';}).join("");el.querySelectorAll("button").forEach(function(btn){btn.onclick=function(){state.level=btn.getAttribute("data-level")||"all";state.page=1;render();};});}
function cover(b){if(b.imageUrl)return '<img src="'+attr(b.imageUrl)+'" alt="'+attr(b.imageAltText||b.title||"")+'" loading="lazy">';var c=code(b.title)||"BT";return '<div class="'+ROOT+'-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="m8 15 2.5-3 2 2.4 1.5-1.8L18 17H6z"/><circle cx="9" cy="8" r="1"/></svg><strong>'+esc(c)+'</strong><span>Cover image</span></div>';}
function card(b){var c=code(b.title),lvl=level(b),hasSave=b.discountedPrice!=null&&Number(b.discountedPrice)<Number(b.price);return '<article class="'+ROOT+'-card"><div class="'+ROOT+'-top">'+(${jsString(data.badgeText || '')}?'<span class="'+ROOT+'-badge">'+esc(${jsString(data.badgeText || '')})+'</span>':'')+'<span class="'+ROOT+'-level">'+esc(levelLabel(lvl))+'</span><div class="'+ROOT+'-cover">'+cover(b)+'</div></div><div class="'+ROOT+'-body"><p class="'+ROOT+'-meta">'+esc(c?("ACCA · "+c):"ACCA")+'</p><h3 class="'+ROOT+'-title">'+esc(paperName(b.title))+'</h3><p class="'+ROOT+'-desc">'+esc(b.description||b.imageAltText||"")+'</p><div class="'+ROOT+'-price"><span>'+esc(money(b))+'</span>'+(hasSave?'<span class="'+ROOT+'-was">'+esc(was(b))+'</span><span class="'+ROOT+'-save">Save '+esc(was({price:Number(b.price)-Number(b.discountedPrice),currency:b.currency}))+'</span>':'')+'</div><a class="'+ROOT+'-cta" href="'+attr(b.stripeUrl||b.sourceUrl||"#")+'">'+esc(${jsString(txt(data.ctaStyle) || data.ctaText || 'Buy now')})+' <span aria-hidden="true">→</span></a></div></article>';}
function render(){renderFilters();var list=filtered(),pages=Math.max(1,Math.ceil(list.length/PS));if(state.page>pages)state.page=1;var slice=list.slice((state.page-1)*PS,state.page*PS),grid=document.getElementById(ROOT+"-grid"),pager=document.getElementById(ROOT+"-pager");if(!grid||!pager)return;if(!slice.length){grid.innerHTML='<div class="'+ROOT+'-empty">No books found.</div>';pager.innerHTML="";return;}grid.innerHTML=slice.map(card).join("");var h='<button class="'+ROOT+'-page" '+(state.page===1?'disabled':'')+' data-page="'+(state.page-1)+'">‹</button>';for(var i=1;i<=pages;i++)h+='<button class="'+ROOT+'-page '+(i===state.page?'is-active':'')+'" data-page="'+i+'">'+i+'</button>';h+='<button class="'+ROOT+'-page" '+(state.page===pages?'disabled':'')+' data-page="'+(state.page+1)+'">›</button>';pager.innerHTML=h;pager.querySelectorAll("button[data-page]").forEach(function(btn){btn.onclick=function(){var p=Number(btn.getAttribute("data-page"));if(p>=1&&p<=pages){state.page=p;render();}};});}
function load(){var search=document.getElementById(ROOT+"-search");if(search)search.oninput=function(){state.q=search.value||"";state.page=1;render();};fetch(API+"?t="+Date.now(),{cache:"no-store"}).then(function(r){if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(data){BOOKS=Array.isArray(data.books)?data.books:[];render();}).catch(function(e){var grid=document.getElementById(ROOT+"-grid");if(grid)grid.innerHTML='<div class="'+ROOT+'-empty">Books could not be loaded.</div>';if(window.console)console.warn("VLS BPP Books:",e);});}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();
})();
<\/script>`;

  return `${css}\n${markup}\n${script}`;
}
