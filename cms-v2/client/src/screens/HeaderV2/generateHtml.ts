import type { HeaderV2Config } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

const HEADER_V2_API_URL = 'https://api.cms.vls-online.com/api/publish-header-v2';

function q(v: unknown, fallback = ''): string {
  return String(v ?? fallback);
}

function absUrl(url: string, base: string): string {
  const u = String(url || '').trim();
  const b = String(base || '').replace(/\/$/, '');
  if (!u) return '#';
  if (/^(https?:|mailto:|tel:|\/\/|#)/i.test(u)) return u;
  if (u.startsWith('/') && b) return b + u;
  return u;
}

export function generateHeaderV2Html(cfg: HeaderV2Config): string {
  const liveApiUrl = q((cfg as HeaderV2Config & { liveApiUrl?: string }).liveApiUrl, HEADER_V2_API_URL);
  const siteBase = q(cfg.siteBaseUrl, 'https://vls-online.com');
  const siteTitle = normalize(cfg.siteTitle, 'headerV2SiteTitle');
  const subTitle = normalize(cfg.subTitle, 'headerV2SubTitle');
  const signIn = normalize(cfg.signInLabel, 'headerV2SignIn');
  const enrol = normalize(cfg.enrolLabel, 'headerV2Enrol');
  const logoLink = escapeHtml(absUrl(q(cfg.logoLink, '/'), siteBase));
  const signInUrl = escapeHtml(absUrl(q(cfg.signInUrl, '/login'), siteBase));
  const enrolUrl = escapeHtml(absUrl(q(cfg.enrolUrl, '/register'), siteBase));
  const enrolBg = escapeHtml(q(cfg.enrolBg, '#1e50c8'));
  const enrolColor = escapeHtml(q(cfg.enrolTextColor, enrol.color || '#ffffff'));
  const signInTarget = cfg.signInNewTab ? ' target="_blank" rel="noopener"' : '';
  const enrolTarget = cfg.enrolNewTab ? ' target="_blank" rel="noopener"' : '';
  const hasLogo = Boolean(q(cfg.logoUrl).trim());

  const brandInner = hasLogo
    ? `<img src="${escapeHtml(q(cfg.logoUrl))}" alt="${escapeHtml(q(cfg.logoAlt, 'Vertex Learning Solutions'))}" class="vlsh2-logo">`
    : `<span class="vlsh2-mark" aria-hidden="true">V</span>`;

  const css = `<style>
@import url("https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap");
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"]{display:block!important;position:absolute!important;left:-10000px!important;top:0!important;width:100vw!important;height:auto!important;max-height:none!important;overflow:visible!important;opacity:0!important;pointer-events:none!important;z-index:-1!important;visibility:visible!important;}
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .zl-navbar-brand,.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .navbar-header{display:block!important;}
.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"] .navbar-collapse{display:block!important;height:auto!important;visibility:visible!important;}
.block.parrot.zenstyle.headers:has(#zen_cs_thankyou_dynamic){display:block!important;visibility:visible!important;height:auto!important;}
.vlsh2{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.86);backdrop-filter:blur(12px);border-bottom:1px solid #eef2fa;font-family:Poppins,sans-serif;width:100%;}
.vlsh2-bar{max-width:1200px;margin:0 auto;padding:0 24px;min-height:74px;display:flex;align-items:center;justify-content:space-between;gap:16px;box-sizing:border-box;}
.vlsh2-brand{display:flex;align-items:center;gap:12px;text-decoration:none!important;flex-shrink:0;}
.vlsh2-logo,.vlsh2-mark{width:38px;height:38px;border-radius:10px;flex-shrink:0;}
.vlsh2-logo{object-fit:cover;display:block;}
.vlsh2-mark{background:#1e50c8;color:#fff;font-weight:700;font-size:19px;display:grid;place-items:center;box-shadow:0 4px 12px rgba(30,80,200,.3);}
.vlsh2-brand-text{display:flex;flex-direction:column;}
.vlsh2-name{line-height:1;letter-spacing:-.01em;}
.vlsh2-sub{text-transform:uppercase;margin-top:3px;line-height:1;}
.vlsh2-links{display:flex;align-items:center;gap:18px;flex-shrink:0;}
.vlsh2-signin{text-decoration:none!important;white-space:nowrap;}
.vlsh2-signin:hover{color:#1e50c8!important;}
.vlsh2-enrol{display:inline-flex;align-items:center;padding:10px 18px;border-radius:12px;text-decoration:none!important;white-space:nowrap;box-shadow:0 4px 14px rgba(30,80,200,.28);transition:transform .18s,box-shadow .18s;}
.vlsh2-enrol:hover{transform:translateY(-1px);box-shadow:0 8px 22px rgba(30,80,200,.32);}
.vlsh2-login{display:flex;align-items:center;}
.vlsh2-login .navbar-buttons{margin:0!important;padding:0!important;align-items:center!important;background:transparent!important;}
.vlsh2-login .zen-c-account{display:none!important;}
.vlsh2-login .zl-navbar-rhs-btn{display:flex!important;align-items:center!important;gap:4px!important;padding:0!important;}
.vlsh2-login .zl-navbar-rhs-img{display:block!important;width:28px!important;height:28px!important;border-radius:50%!important;object-fit:cover!important;}
.vlsh2-login .navbar-buttons.jqLoginLogout .btn,.vlsh2-login .navbar-buttons.jqLoginLogout .dropdown-toggle{background:transparent!important;border:none!important;box-shadow:none!important;color:#0e2a57!important;padding:0!important;}
@media(max-width:680px){
.vlsh2-bar{padding:0 16px;min-height:64px;gap:10px;}
.vlsh2-sub{display:none;}
.vlsh2-enrol{padding:8px 12px;font-size:13px!important;}
.vlsh2-signin{font-size:13px!important;}
}
</style>`;

  const markup = `<header class="vlsh2" data-vls-header-v2="1">`
    + `<div class="vlsh2-bar">`
    + `<a class="vlsh2-brand" href="${logoLink}">${brandInner}`
    + `<span class="vlsh2-brand-text">`
    + `<span class="vlsh2-name" style="${textStyle(siteTitle)}">${escapeHtml(siteTitle.text || 'Vertex')}</span>`
    + `<span class="vlsh2-sub" style="${textStyle(subTitle)}">${escapeHtml(subTitle.text || 'Learning Solutions')}</span>`
    + `</span></a>`
    + `<div class="vlsh2-links">`
    + `<a id="vlsh2-signin" class="vlsh2-signin" href="${signInUrl}"${signInTarget} style="${textStyle(signIn)}">${escapeHtml(signIn.text || 'Sign in')}</a>`
    + `<div id="vlsh2-login" class="vlsh2-login"></div>`
    + `<a id="vlsh2-enrol" class="vlsh2-enrol" href="${enrolUrl}"${enrolTarget} style="background:${enrolBg};${textStyle({ ...enrol, color: enrolColor })}">${escapeHtml(enrol.text || 'Enrol now')}</a>`
    + `</div></div></header>`;

  const script = `<script data-cfasync="false">(function(){
var LIVE_API=${JSON.stringify(liveApiUrl)};
var SITE_BASE=${JSON.stringify(siteBase)};
function abs(url,base){var u=String(url||"").trim();var b=String(base||"").replace(/\\/$/,"");if(!u)return"#";if(/^(https?:|mailto:|tel:|\\/\\/|#)/i.test(u))return u;if(u.charAt(0)==="/"&&b)return b+u;return u;}
function hex(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())?String(v).trim():f;}
function detectLoggedIn(){var root=document.querySelector(".navbar-buttons.jqLoginLogout");if(!root)return false;var summary=Array.from(root.querySelectorAll("a,button")).map(function(node){return((node.textContent||"")+" "+(node.getAttribute("href")||""));}).join(" ").toLowerCase();if(/logout|log out|my account|my settings|admin/.test(summary))return true;if(/login|log in|sign in/.test(summary))return false;return!!root.querySelector(".dropdown-menu li,.dropdown-menu a[href*=logout]");}
function restoreZenlerDynamicBlocks(){document.querySelectorAll("#zen_cs_thankyou_dynamic").forEach(function(node){var block=node.closest(".block");if(!block)return;block.style.setProperty("display","block","important");block.style.setProperty("visibility","visible","important");});}
function forceLoginVisible(root){if(!root)return;root.style.setProperty("display","flex","important");root.style.setProperty("align-items","center","important");root.style.setProperty("visibility","visible","important");root.style.setProperty("opacity","1","important");root.querySelectorAll("a,button,span").forEach(function(el){el.style.setProperty("color","#0e2a57","important");el.style.setProperty("visibility","visible","important");});}
function moveLogin(){var slot=document.getElementById("vlsh2-login");var signin=document.getElementById("vlsh2-signin");if(!slot)return false;var loggedIn=detectLoggedIn();var src=document.querySelector(".navbar-buttons.jqLoginLogout");if(!loggedIn){if(signin)signin.style.removeProperty("display");if(src)src.style.setProperty("display","none","important");return false;}if(signin)signin.style.setProperty("display","none","important");if(!src)return false;if(!slot.contains(src))slot.appendChild(src);forceLoginVisible(src);return true;}
function applyPublishedConfig(c){if(!c||typeof c!=="object")return;var base=c.siteBaseUrl||SITE_BASE;var brand=document.querySelector(".vlsh2-brand");var logo=document.querySelector(".vlsh2-logo");var name=document.querySelector(".vlsh2-name");var sub=document.querySelector(".vlsh2-sub");var signin=document.getElementById("vlsh2-signin");var enrol=document.getElementById("vlsh2-enrol");if(brand&&c.logoLink)brand.setAttribute("href",abs(c.logoLink,base));if(logo){if(c.logoUrl)logo.src=c.logoUrl;if(c.logoAlt)logo.alt=c.logoAlt;}if(name&&c.siteTitle){var t=c.siteTitle;name.textContent=(t&&t.text!=null?t.text:t)||name.textContent;}if(sub&&c.subTitle){var s=c.subTitle;sub.textContent=(s&&s.text!=null?s.text:s)||sub.textContent;}if(signin){if(c.signInUrl)signin.href=abs(c.signInUrl,base);if(c.signInLabel){var sl=c.signInLabel;signin.textContent=(sl&&sl.text!=null?sl.text:sl)||signin.textContent;}}if(enrol){if(c.enrolUrl)enrol.href=abs(c.enrolUrl,base);if(c.enrolLabel){var el=c.enrolLabel;enrol.textContent=(el&&el.text!=null?el.text:el)||enrol.textContent;}if(c.enrolBg)enrol.style.background=hex(c.enrolBg,"#1e50c8");if(c.enrolTextColor)enrol.style.color=hex(c.enrolTextColor,"#ffffff");}moveLogin();}
function loadPublishedConfig(){if(!LIVE_API||window.vlsh2LiveLoaded)return;window.vlsh2LiveLoaded=true;fetch(LIVE_API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("Header V2 API "+r.status);return r.json();}).then(function(data){applyPublishedConfig(data&&data.config);}).catch(function(e){console.error("VLS Header V2:",e.message||e);});}
function init(){restoreZenlerDynamicBlocks();moveLogin();loadPublishedConfig();}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
setTimeout(init,600);setTimeout(init,1500);setTimeout(init,3000);
var tries=0;var poll=setInterval(function(){tries++;moveLogin();if(tries>20)clearInterval(poll);},500);
})();<\/script>`;

  return css + '\n' + markup + '\n' + script;
}
