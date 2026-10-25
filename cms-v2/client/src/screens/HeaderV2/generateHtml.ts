import type { HeaderV2Config } from '../../types/cms';
import { useV2BrandMark } from '../../utils/brand';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

const HEADER_V2_API_URL = 'https://api.cms.vls-online.com/api/publish-header-v2';

function q(v: unknown, fallback = ''): string {
  return String(v ?? fallback);
}

const MARKETING_HOME = 'https://vls-online.com';
const SCHOOL_PATH = /^\/(login|register|signup|mycourses|account|logout)(?:\/|$|\?)/i;

function headerHref(url: string, base: string): string {
  let u = String(url || '').trim();
  if (!u || u === '/') return `${MARKETING_HOME}/`;
  u = u.replace(/^https?:\/\/(?:www\.)?vls-online\.com/i, '');
  if (SCHOOL_PATH.test(u)) return u.startsWith('/') ? u : `/${u}`;
  if (/^(https?:|mailto:|tel:|\/\/|#)/i.test(u)) return u;
  const b = String(base || MARKETING_HOME).replace(/\/$/, '');
  if (u.startsWith('/') && b) return b + u;
  return u;
}

function anchorHtml(opts: {
  id: string;
  className: string;
  href: string;
  label: string;
  newTab: boolean;
  style?: string;
}): string {
  const href = opts.href.trim();
  const label = opts.label.trim();
  if (!href || !label) return '';
  const target = opts.newTab ? ' target="_blank" rel="noopener"' : '';
  const style = opts.style ? ` style="${opts.style}"` : '';
  return `<a id="${opts.id}" class="${opts.className}" href="${escapeHtml(href)}"${target}${style}>${escapeHtml(label)}</a>`;
}

export function generateHeaderV2Html(cfg: HeaderV2Config): string {
  const liveApiUrl = q((cfg as HeaderV2Config & { liveApiUrl?: string }).liveApiUrl, HEADER_V2_API_URL);
  const siteBase = q(cfg.siteBaseUrl, 'https://vls-online.com');
  const siteTitle = normalize(cfg.siteTitle, 'headerV2SiteTitle');
  const subTitle = normalize(cfg.subTitle, 'headerV2SubTitle');
  const signIn = normalize(cfg.signInLabel, 'headerV2SignIn');
  const enrol = normalize(cfg.enrolLabel, 'headerV2Enrol');
  const logoHref = headerHref(q(cfg.logoLink), siteBase);
  const signInHref = headerHref(q(cfg.signInUrl) || '/login', siteBase);
  const enrolHref = headerHref(q(cfg.enrolUrl), siteBase);
  const enrolBg = escapeHtml(q(cfg.enrolBg, '#1e50c8'));
  const enrolColor = escapeHtml(q(cfg.enrolTextColor, enrol.color || '#ffffff'));
  const brandInner = useV2BrandMark(cfg.logoUrl)
    ? `<span class="vls-brand-mark" aria-hidden="true">V</span>`
    : `<img src="${escapeHtml(q(cfg.logoUrl))}" alt="${escapeHtml(q(cfg.logoAlt, 'Vertex Learning Solutions'))}" class="vls-brand-img">`;
  const nameHtml = siteTitle.text.trim()
    ? `<span id="vls-header-name" class="vls-brand-name" style="${textStyle(siteTitle)}">${escapeHtml(siteTitle.text.trim())}</span>`
    : '';
  const taglineHtml = subTitle.text.trim()
    ? `<span id="vls-header-tagline" class="vls-brand-tagline" style="${textStyle(subTitle)}">${escapeHtml(subTitle.text.trim())}</span>`
    : '';
  const brandTag = logoHref ? 'a' : 'span';
  const brandHref = logoHref ? ` href="${escapeHtml(logoHref)}"` : '';
  const signInHtml = anchorHtml({
    id: 'vls-header-signin',
    className: 'vls-header-signin',
    href: signInHref,
    label: signIn.text,
    newTab: cfg.signInNewTab,
    style: textStyle(signIn),
  });
  const signInMobileHtml = anchorHtml({
    id: 'vls-header-signin-mobile',
    className: 'vlshdgq0e-signin',
    href: signInHref,
    label: signIn.text,
    newTab: cfg.signInNewTab,
    style: textStyle(signIn),
  });
  const enrolHtml = anchorHtml({
    id: 'vls-header-enrol',
    className: 'vls-btn vls-btn-primary vls-header-enrol-desktop',
    href: enrolHref,
    label: enrol.text,
    newTab: cfg.enrolNewTab,
    style: `background:${enrolBg};${textStyle({ ...enrol, color: enrolColor })}`,
  });

  const css = `<style>
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap");
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"]{display:block!important;position:absolute!important;left:0!important;top:0!important;width:1px!important;height:1px!important;max-height:1px!important;margin:0!important;padding:0!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;clip-path:inset(50%)!important;opacity:0!important;pointer-events:none!important;z-index:-1!important;visibility:visible!important;}
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .zl-navbar-brand,.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .navbar-header{display:block!important;}
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .navbar-collapse{display:block!important;height:auto!important;visibility:visible!important;}
.block.parrot.zenstyle.headers:has(#zen_cs_thankyou_dynamic){display:block!important;visibility:visible!important;height:auto!important;}
.vls-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:blur(12px);border-bottom:1px solid #eef2fa;font-family:Poppins,sans-serif;width:100%;max-width:100%;box-sizing:border-box;}
.vls-header .vls-container{max-width:1200px;margin:0 auto;padding:0 40px;box-sizing:border-box;}
.vls-header-topbar{display:flex;align-items:center;justify-content:space-between;height:74px;gap:20px;min-width:0;max-width:100%;}
.vls-brand{display:flex;align-items:center;gap:12px;text-decoration:none!important;flex:1 1 auto;min-width:0;color:inherit;}
.vls-brand-header{gap:14px;}
.vls-brand-mark{width:46px;height:46px;border-radius:12px;background:#1e50c8;color:#fff;font-weight:700;font-size:23px;line-height:1;display:grid;place-items:center;box-shadow:0 4px 12px rgba(30,80,200,.3);flex-shrink:0;}
.vls-brand-img{width:46px;height:46px;border-radius:12px;object-fit:cover;display:block;flex-shrink:0;}
.vls-brand-text{display:flex;flex-direction:column;min-width:0;overflow:hidden;}
.vls-brand-name{font-weight:700;font-size:20px;color:#0e2a57;line-height:1.15;letter-spacing:-.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
.vls-brand-tagline{display:block;font-weight:400;font-size:12.5px;line-height:1.3;color:#3d4a63;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;}
.vls-header-links{display:flex;align-items:center;gap:22px;flex-shrink:0;}
.vls-header-signin{font-size:15px;font-weight:500;color:#0e2a57!important;text-decoration:none!important;white-space:nowrap;}
.vls-header-signin:hover{color:#1e50c8!important;}
.vls-btn{display:inline-flex;align-items:center;font-family:inherit;font-size:15.5px;font-weight:500;padding:14px 26px;border-radius:12px;border:1px solid transparent;white-space:nowrap;text-decoration:none!important;cursor:pointer;}
.vls-btn-primary{background:#1e50c8;color:#fff!important;box-shadow:0 4px 14px rgba(30,80,200,.28);transition:transform .18s,box-shadow .18s,background .18s;}
.vls-btn-primary:hover{background:#1a45b0;transform:translateY(-1px);box-shadow:0 8px 22px rgba(30,80,200,.32);}
.vls-header-divider{display:none;height:0;margin:0;border:none;border-top:1px solid #e5ebf6;}
.vls-header-mobile{display:none;align-items:center;gap:12px;flex-shrink:0;margin-left:auto;}
.vls-header-mobile .vlshdgq0e-login-menu{display:flex;align-items:center;}
.vlshdgq0e-signin{display:flex;align-items:center;text-decoration:none!important;color:#0e2a57!important;font-weight:500;font-size:14px;white-space:nowrap;}
.vlshdgq0e-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:36px;height:36px;background:none;border:none;padding:4px;cursor:pointer;}
.vlshdgq0e-burger span{display:block;height:2px;width:100%;background:#0e2a57;border-radius:2px;}
.vls-header-login{display:flex;align-items:center;position:relative;}
.vls-header-login .navbar-buttons{margin:0!important;padding:0!important;align-items:center!important;background:transparent!important;position:relative;}
.vls-header-login .dropdown{position:relative;}
.vls-header-login .zen-c-account{display:none!important;}
.vls-header-login .zl-navbar-rhs-btn{display:flex!important;align-items:center!important;gap:4px!important;padding:0!important;cursor:pointer;}
.vls-header-login .zl-navbar-rhs-img{display:block!important;width:28px!important;height:28px!important;border-radius:50%!important;object-fit:cover!important;}
.vls-header-login .navbar-buttons.jqLoginLogout .btn,.vls-header-login .navbar-buttons.jqLoginLogout .dropdown-toggle{background:transparent!important;border:none!important;box-shadow:none!important;color:#0e2a57!important;padding:0!important;}
.vls-header-login .dropdown-menu{display:none!important;}
.vls-account-panel{display:none;position:absolute;left:0;right:0;top:100%;width:100%;box-sizing:border-box;background:#fff;border-top:1px solid #e5ebf6;box-shadow:0 16px 40px rgba(15,30,60,.12);z-index:300;padding:8px 0;margin:0;}
.vls-header.is-account-open .vls-account-panel{display:block;}
.vls-account-link{display:block;width:100%;box-sizing:border-box;text-align:left;padding:14px 24px;padding-left:24px!important;margin:0;border:0;background:transparent;color:#0e2a57!important;font:500 15px/1.4 Poppins,sans-serif;text-decoration:none!important;cursor:pointer;}
.vls-account-link:hover{background:#f4f7fb;}
@media(min-width:769px){
.vls-header-divider{display:block;}
}
@media(max-width:768px){
.vls-header .vls-container{padding:0 16px;}
.vls-header-topbar{height:auto;min-height:64px;gap:10px;padding:8px 0;}
.vls-header-signin,.vls-header-enrol-desktop{display:none!important;}
.vls-header-mobile{display:flex;}
.vlshdgq0e-burger{display:flex;flex-shrink:0;}
.vls-header-login .zl-navbar-rhs-btn,.vls-header-login .dropdown-toggle{display:none!important;}
.vls-account-link{padding-left:24px!important;}
.vls-brand-header .vls-brand-mark,.vls-brand-header .vls-brand-img{width:40px;height:40px;}
.vls-brand-header .vls-brand-mark{font-size:20px;}
.vls-brand-header .vls-brand-name{font-size:16px!important;line-height:1.15!important;letter-spacing:-.02em!important;}
.vls-brand-tagline{font-size:11px!important;letter-spacing:0!important;}
}
</style>`;

  const markup = `<header class="vls-header" data-vls-header-v2="1">`
    + `<div class="vls-container vls-header-topbar">`
    + `<${brandTag} id="vls-header-brand" class="vls-brand vls-brand-header"${brandHref}>${brandInner}`
    + `<span class="vls-brand-text">${nameHtml}${taglineHtml}</span>`
    + `</${brandTag}>`
    + `<div id="vls-header-links" class="vls-header-links">`
    + signInHtml
    + `<div id="vls-header-login" class="vls-header-login"></div>`
    + enrolHtml
    + `</div>`
    + `<div class="vls-header-mobile">`
    + `<div class="vlshdgq0e-login-menu">${signInMobileHtml}</div>`
    + `<button type="button" class="vlshdgq0e-burger" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>`
    + `</div>`
    + `</div>`
    + `<div class="vls-header-divider" aria-hidden="true"></div>`
    + `<div id="vls-account-panel" class="vls-account-panel"></div>`
    + `</header>`;

  const script = `<script data-cfasync="false">(function(){
var LIVE_API=${JSON.stringify(liveApiUrl)};
var SITE_BASE=${JSON.stringify(siteBase)};
function abs(url,base){var u=String(url||"").trim();var b=String(base||"https://vls-online.com").replace(/\\/$/,"");if(!u||u==="/")return"https://vls-online.com/";u=u.replace(/^https?:\\/\\/(?:www\\.)?vls-online\\.com/i,"");if(/^\\/(login|register|signup|mycourses|account|logout)(\\/|$|\\?)/i.test(u))return u;if(/^(https?:|mailto:|tel:|\\/\\/|#)/i.test(u))return u;if(u.charAt(0)==="/"&&b)return b+u;return u;}
function labelText(value){if(value==null)return"";if(typeof value==="string")return value.trim();if(typeof value==="object"&&value.text!=null)return String(value.text).trim();return String(value).trim();}
function useMark(u){u=String(u||"").trim();return !u||/vertex-learning-solutions-01|vertex-logo-mark|69e4eae99c751|favicon\\.png/i.test(u);}
function setBrandMark(brand,url,alt){if(!brand)return;var mark=brand.querySelector(".vls-brand-mark");var logo=brand.querySelector(".vls-brand-img");if(useMark(url)){if(logo)logo.remove();if(!mark){mark=document.createElement("span");mark.className="vls-brand-mark";mark.setAttribute("aria-hidden","true");mark.textContent="V";brand.insertBefore(mark,brand.firstChild);}}else if(url){if(mark)mark.remove();if(!logo){logo=document.createElement("img");logo.className="vls-brand-img";logo.alt=alt||"Vertex Learning Solutions";brand.insertBefore(logo,brand.firstChild);}logo.src=url;if(alt)logo.alt=alt;}}
function setText(id,parent,className,value){var text=labelText(value);var node=document.getElementById(id);if(!text){if(node)node.remove();return;}if(!node&&parent){node=document.createElement("span");node.id=id;node.className=className;parent.appendChild(node);}if(node)node.textContent=text;}
function syncBrand(url){var brand=document.getElementById("vls-header-brand");if(!brand)return null;var href=String(url||"").trim();var next=brand;if(href&&brand.tagName!=="A"){next=document.createElement("a");}else if(!href&&brand.tagName==="A"){next=document.createElement("span");}if(next!==brand){next.id=brand.id;next.className=brand.className;while(brand.firstChild)next.appendChild(brand.firstChild);brand.replaceWith(next);}if(href&&next.tagName==="A")next.setAttribute("href",abs(href,SITE_BASE));if(!href)next.removeAttribute("href");return next;}
function syncLink(id,parent,className,url,label,newTab,paint){var node=document.getElementById(id);var href=String(url||"").trim();var text=labelText(label);if(!href||!text){if(node)node.remove();return null;}if(!node){if(!parent)return null;node=document.createElement("a");node.id=id;node.className=className;parent.appendChild(node);}node.href=abs(href,SITE_BASE);node.textContent=text;if(newTab){node.target="_blank";node.rel="noopener";}else{node.removeAttribute("target");node.removeAttribute("rel");}if(paint)paint(node);return node;}
function hex(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())?String(v).trim():f;}
function detectLoggedIn(){var root=document.querySelector(".navbar-buttons.jqLoginLogout");if(!root)return false;var summary=Array.from(root.querySelectorAll("a,button")).map(function(node){return((node.textContent||"")+" "+(node.getAttribute("href")||""));}).join(" ").toLowerCase();if(/logout|log out|my account|my settings|admin/.test(summary))return true;if(/login|log in|sign in/.test(summary))return false;return!!root.querySelector(".dropdown-menu li,.dropdown-menu a[href*=logout]");}
function restoreZenlerDynamicBlocks(){document.querySelectorAll("#zen_cs_thankyou_dynamic").forEach(function(node){var block=node.closest(".block");if(!block)return;block.style.setProperty("display","block","important");block.style.setProperty("visibility","visible","important");});}
function forceLoginVisible(root){if(!root)return;root.style.setProperty("display","flex","important");root.style.setProperty("align-items","center","important");root.style.setProperty("visibility","visible","important");root.style.setProperty("opacity","1","important");var btn=root.querySelector(".zl-navbar-rhs-btn,.dropdown-toggle");if(btn){btn.style.setProperty("color","#0e2a57","important");btn.style.setProperty("visibility","visible","important");}root.querySelectorAll(".dropdown-menu").forEach(function(menu){menu.style.setProperty("display","none","important");});}
function zenlerHref(test,fallback){var nodes=document.querySelectorAll(".block.parrot.zenstyle.headers a,.navbar-buttons.jqLoginLogout a");for(var i=0;i<nodes.length;i++){var node=nodes[i];if(node.closest&&node.closest(".vls-header"))continue;var href=node.getAttribute("href")||"";var text=(node.textContent||"").replace(/\\s+/g," ").trim().toLowerCase();if(!test(href,text))continue;return abs(href,SITE_BASE)||fallback;}return fallback;}
function closeAccount(){var header=document.querySelector(".vls-header");if(header)header.classList.remove("is-account-open");var burger=document.querySelector(".vlshdgq0e-burger");if(burger)burger.setAttribute("aria-expanded","false");}
function toggleAccount(event){if(event){event.preventDefault();event.stopPropagation();}var header=document.querySelector(".vls-header");if(!header)return;var open=header.classList.contains("is-account-open");closeAccount();if(!open){header.classList.add("is-account-open");var burger=document.querySelector(".vlshdgq0e-burger");if(burger)burger.setAttribute("aria-expanded","true");}}
function renderAccount(loggedIn){var panel=document.getElementById("vls-account-panel");if(!panel)return;var items=loggedIn?[{label:"My Courses",href:zenlerHref(function(h,t){return /mycourses/i.test(h)||t==="my courses";},"/mycourses")},{label:"My Account",href:zenlerHref(function(h,t){return /\\/account(\\?|$)/i.test(h)||t==="my account";},"/account")},{label:"Logout",href:zenlerHref(function(h,t){return /logout/i.test(h)||t==="logout"||t==="log out";},"/logout"),logout:true}]:[{label:"Login",href:zenlerHref(function(h,t){return /\\/login(\\?|$)/i.test(h)||t==="login"||t==="sign in";},"/login")}];var key=items.map(function(item){return item.label+"|"+item.href;}).join(";");if(panel.getAttribute("data-vls-items")===key)return;panel.setAttribute("data-vls-items",key);panel.innerHTML="";items.forEach(function(item){var el=document.createElement(item.logout?"button":"a");el.className="vls-account-link";el.textContent=item.label;if(item.logout){el.type="button";el.addEventListener("click",function(event){event.preventDefault();var form=document.getElementById("logout-form");if(form)form.submit();else location.href=item.href;});}else{el.href=item.href;}panel.appendChild(el);});}
function fitHeader(){var header=document.querySelector(".vls-header");if(!header)return;header.style.marginLeft="0px";header.style.width="100%";header.style.maxWidth="100%";var rect=header.getBoundingClientRect();var width=document.documentElement.clientWidth||window.innerWidth;if(Math.abs(rect.left)>1||Math.abs(rect.width-width)>2){header.style.marginLeft=(-rect.left)+"px";header.style.width=width+"px";header.style.maxWidth=width+"px";document.documentElement.style.overflowX="hidden";document.body.style.overflowX="hidden";}}
function moveLogin(){var slot=document.getElementById("vls-header-login");var signins=[document.getElementById("vls-header-signin"),document.getElementById("vls-header-signin-mobile")];if(!slot)return false;var loggedIn=detectLoggedIn();var src=document.querySelector(".navbar-buttons.jqLoginLogout");var burger=document.querySelector(".vlshdgq0e-burger");if(burger)burger.style.removeProperty("display");renderAccount(loggedIn);fitHeader();if(!loggedIn){signins.forEach(function(node){if(node)node.style.removeProperty("display");});if(src)src.style.setProperty("display","none","important");return false;}signins.forEach(function(node){if(node)node.style.setProperty("display","none","important");});if(!src)return false;if(!slot.contains(src))slot.appendChild(src);forceLoginVisible(src);return true;}
function applyPublishedConfig(c){if(!c||typeof c!=="object")return;if(c.siteBaseUrl)SITE_BASE=c.siteBaseUrl;var brand=document.getElementById("vls-header-brand");if(brand&&("logoLink" in c))brand=syncBrand(c.logoLink);var textWrap=brand&&brand.querySelector(".vls-brand-text");if("logoUrl" in c)setBrandMark(brand,c.logoUrl,c.logoAlt);if("siteTitle" in c)setText("vls-header-name",textWrap,"vls-brand-name",c.siteTitle);if("subTitle" in c)setText("vls-header-tagline",textWrap,"vls-brand-tagline",c.subTitle);var links=document.getElementById("vls-header-links");var login=document.getElementById("vls-header-login");var mobile=document.querySelector(".vls-header-mobile .vlshdgq0e-login-menu");if("signInUrl" in c||"signInLabel" in c){syncLink("vls-header-signin",links,"vls-header-signin",c.signInUrl,c.signInLabel,!!c.signInNewTab,function(node){if(links&&login&&node.parentNode===links&&node.nextSibling!==login)links.insertBefore(node,login);});syncLink("vls-header-signin-mobile",mobile,"vlshdgq0e-signin",c.signInUrl,c.signInLabel,!!c.signInNewTab);}if("enrolUrl" in c||"enrolLabel" in c){syncLink("vls-header-enrol",links,"vls-btn vls-btn-primary vls-header-enrol-desktop",c.enrolUrl,c.enrolLabel,!!c.enrolNewTab,function(node){if(c.enrolBg)node.style.background=hex(c.enrolBg,"#1e50c8");if(c.enrolTextColor)node.style.color=hex(c.enrolTextColor,"#ffffff");});}moveLogin();}
function loadPublishedConfig(){if(!LIVE_API||window.vlsHeaderLiveLoaded)return;window.vlsHeaderLiveLoaded=true;fetch(LIVE_API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("Header API "+r.status);return r.json();}).then(function(data){applyPublishedConfig(data&&data.config);}).catch(function(e){console.error("VLS Header:",e.message||e);});}
function init(){restoreZenlerDynamicBlocks();moveLogin();loadPublishedConfig();if(window.vlsAccountMenuBound)return;window.vlsAccountMenuBound=true;window.addEventListener("resize",fitHeader);document.addEventListener("click",function(event){var target=event.target;if(!target||!target.closest)return;var burger=target.closest(".vlshdgq0e-burger");var toggle=target.closest(".vls-header-login .dropdown-toggle,.vls-header-login .zl-navbar-rhs-btn");if(burger||toggle){toggleAccount(event);return;}if(target.closest(".vls-account-panel"))return;closeAccount();},true);}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
setTimeout(init,600);setTimeout(init,1500);setTimeout(init,3000);
var tries=0;var poll=setInterval(function(){tries++;moveLogin();fitHeader();if(tries>20)clearInterval(poll);},500);
})();<\/script>`;

  return css + '\n' + markup + '\n' + script;
}
