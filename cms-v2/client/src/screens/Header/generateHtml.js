import { normalize, textStyle, escapeHtml } from '../../utils/text';
const HEADER_API_URL = 'https://api.cms.vls-online.com/api/publish-header';
function n(v, fallback) {
    const parsed = parseInt(String(v), 10);
    return isFinite(parsed) ? parsed : fallback;
}
function q(v, fallback = '') {
    return String(v ?? fallback);
}
export function generateHeaderHtml(cfg) {
    const uid = 'vlsh' + Math.random().toString(36).slice(2, 7);
    const liveApiUrl = cfg.liveApiUrl === false ? '' : q(cfg.liveApiUrl, HEADER_API_URL);
    const siteTitle = normalize(cfg.siteTitle, 'headerSiteTitle');
    const subTitle = normalize(cfg.subTitle, 'headerSubTitle');
    const menuTextColor = q(cfg.menuText || '#204280');
    const dropTextColor = q(cfg.dropText || '#262a32');
    const containerW = n(cfg.containerWidth, 1280);
    const padL = n(cfg.padLeft, 24);
    const padR = n(cfg.padRight, 24);
    const padTop = n(cfg.padTop, 8);
    const padBot = n(cfg.padBottom, 8);
    const dropSpacing = n(cfg.dropSpacing, 10);
    const logoHeightNum = parseFloat(String(cfg.logoHeight || 56));
    const logoHeightCss = isFinite(logoHeightNum) ? Math.round(logoHeightNum * 1.2) + 'px' : '67px';
    const logoHeightMob = isFinite(logoHeightNum) ? Math.round(logoHeightNum * 0.7) + 'px' : '42px';
    const menuFontSize = '16px';
    const dropFontSize = '15px';
    function buildMenuItems(items, level) {
        if (!items || !items.length)
            return '';
        return items.map(item => {
            const hasKids = item.children && item.children.length > 0;
            const colorOverride = level > 1 ? dropTextColor : menuTextColor;
            const label = normalize(item.label, 'headerMenu');
            const labelWithColor = { ...label, color: colorOverride };
            const itemKey = label.text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
            const targetAttr = item.newTab ? ' target="_blank" rel="noopener"' : '';
            const e = escapeHtml;
            let h = `<li class="${uid}-ni${hasKids ? ' ' + uid + '-has' : ''}${level > 1 ? ' ' + uid + '-sub-ni' : ''}"${itemKey ? ` data-menu-key="${e(itemKey)}"` : ''}>`;
            h += `<a href="${e(q(item.url, '#'))}"${targetAttr} class="${uid}-nl"${hasKids ? ` onclick="window['${uid}_mdt'](this,event);"` : ''}>`;
            h += `<span style="${textStyle(labelWithColor)}">${e(label.text)}</span>`;
            if (hasKids)
                h += `<svg class="${uid}-arr" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg>`;
            h += `</a>`;
            if (hasKids) {
                h += `<ul class="${uid}-drop${level > 1 ? ' ' + uid + '-drop-r' : ''}">`;
                h += buildMenuItems(item.children, level + 1);
                h += `</ul>`;
            }
            h += `</li>`;
            return h;
        }).join('');
    }
    function buildCtaHtml(extraClass = '') {
        let html = '';
        (cfg.ctas || []).forEach(c => {
            const label = normalize(c.label, 'headerCta');
            if (!label.text)
                return;
            const t = c.newTab ? ' target="_blank" rel="noopener"' : '';
            html += `<a href="${escapeHtml(q(c.url))}"${t} class="${uid}-cta${extraClass ? ' ' + extraClass : ''}" style="background:${q(c.bgColor, '#204280')};${textStyle({ ...label, color: q(c.textColor, label.color) })}">${escapeHtml(label.text)}</a>`;
        });
        return html;
    }
    const ctaHtml = buildCtaHtml();
    const mobileCtaHtml = buildCtaHtml(`${uid}-mobile-cta`);
    const css = `<style>
.block.parrot.zenstyle.headers{display:none!important;}
.zl-navbar-brand,.navbar-header{display:none!important;}
.navbar-collapse{display:none!important;}
.zl-navbar{background:transparent!important;min-height:0!important;padding:0!important;border:none!important;box-shadow:none!important;margin:0!important;width:100%!important;}
.zl-navbar>.container{max-width:${containerW}px!important;margin:0 auto!important;padding:0 ${padR}px 0 ${padL}px!important;box-sizing:border-box!important;}
.navbar-buttons.jqLoginLogout,.navbar-buttons.navbar-mob{position:static!important;float:none!important;display:flex!important;align-items:center!important;background:transparent!important;}
.navbar-buttons.jqLoginLogout .btn,.navbar-buttons.jqLoginLogout .dropdown-toggle,.navbar-buttons.jqLoginLogout [role="button"]{background:transparent!important;border:none!important;box-shadow:none!important;color:${menuTextColor}!important;padding:0!important;}
.navbar-buttons.jqLoginLogout .caret,.navbar-buttons.jqLoginLogout .fa,.navbar-buttons.jqLoginLogout [class*="icon"]{color:${menuTextColor}!important;}
.navbar-buttons.jqLoginLogout .dropdown-menu{background:#ffffff!important;border:1px solid #e5e7eb!important;box-shadow:0 12px 28px rgba(15,23,42,.12)!important;border-radius:10px!important;padding:8px 0!important;min-width:200px!important;}
.navbar-buttons.jqLoginLogout .dropdown-menu>li>a,.navbar-buttons.jqLoginLogout .dropdown-menu a{background:transparent!important;color:${dropTextColor}!important;font-size:${dropFontSize}!important;}
.navbar-buttons.jqLoginLogout .dropdown-menu>li>a:hover,.navbar-buttons.jqLoginLogout .dropdown-menu a:hover{background:#f8fafc!important;color:${dropTextColor}!important;}
.${uid}-wrap{font-family:'Poppins',sans-serif;width:100%;}
.${uid}-brand{background:${q(cfg.brandBg, '#ffffff')};padding:${padTop}px 0 ${padBot}px;border-bottom:1px solid #e5e7eb;position:relative;width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);}
.${uid}-brand-inner{max-width:${containerW}px;margin:0 auto;padding:0 ${padR}px 0 ${padL}px;display:flex;align-items:flex-end;gap:16px;}
.${uid}-logo-link{flex-shrink:0;display:flex;align-items:flex-end;text-decoration:none!important;}
.${uid}-logo{height:${logoHeightCss};width:auto;display:block;}
.${uid}-namewrap{display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-width:0;}
.${uid}-sitename{line-height:1.2;text-align:left;}
.${uid}-subtitle{line-height:1.3;text-transform:uppercase;text-align:left;}
.${uid}-brand-spacer{flex:1;min-width:16px;}
.${uid}-brand-right{display:flex;align-items:center;gap:16px;flex-shrink:1;align-self:center;min-width:0;}
.${uid}-login-brand{display:flex;align-items:center;align-self:center;flex-shrink:0;}
.${uid}-login-brand .navbar-buttons{margin:0!important;padding:0!important;align-items:center!important;}
.${uid}-login-menu{display:none;align-items:center;align-self:center;flex-shrink:0;padding-right:12px;position:relative;z-index:10000;}
.${uid}-login-menu .navbar-buttons{margin:0!important;padding:0!important;align-items:center!important;}
.${uid}-ctas{display:flex;flex-direction:row;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end;min-width:0;max-width:min(48vw,520px);}
.${uid}-cta{display:inline-block;max-width:240px;overflow:hidden;text-overflow:ellipsis;padding:8px 20px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none;text-align:center;white-space:nowrap;transition:opacity .2s;}
.${uid}-cta:hover{opacity:.85;}
.${uid}-menubar{background:${q(cfg.menuBg, '#ffffff')};position:relative;z-index:9999;width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);border-bottom:3px solid ${q(siteTitle.color, '#204280')};}
.${uid}-menu-inner{max-width:${containerW}px;margin:0 auto;padding:0 ${padR}px 0 ${padL}px;display:flex;align-items:center;position:relative;}
.${uid}-nav{flex:1;}
.${uid}-ul{list-style:none;margin:0;padding:0;display:flex;align-items:center;}
.${uid}-ni{position:relative;}
.${uid}-nl{display:flex;align-items:center;gap:4px;padding:14px 16px;color:${menuTextColor}!important;text-decoration:none!important;font-size:${menuFontSize};font-weight:500;white-space:nowrap;transition:background .15s;}
.${uid}-nl:hover,.${uid}-ni:hover>.${uid}-nl{background:${q(cfg.menuHover, '#f0f4ff')};}
.${uid}-arr{transition:transform .2s;flex-shrink:0;}
.${uid}-ni:hover>.${uid}-nl .${uid}-arr{transform:rotate(180deg);}
.${uid}-drop{display:none;position:absolute;top:100%;left:0;min-width:200px;background:${q(cfg.dropBg, '#ffffff')};box-shadow:0 4px 20px rgba(0,0,0,.15);border-radius:0 0 6px 6px;z-index:9999;list-style:none;margin:0;padding:4px 0;}
.${uid}-drop-r{left:100%;top:0;border-radius:0 6px 6px 6px;}
@media(min-width:769px){.${uid}-ni:hover>.${uid}-drop{display:block;}}
.${uid}-drop .${uid}-nl{color:${dropTextColor}!important;padding:${dropSpacing}px 16px;font-size:${dropFontSize};}
.${uid}-drop .${uid}-nl:hover{background:#f3f4f6;}
.${uid}-sub-ni{position:relative;}
.${uid}-more{position:relative;}
.${uid}-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:36px;height:36px;background:none;border:none;cursor:pointer;padding:4px;margin-left:auto;position:relative;z-index:10000;}
.${uid}-burger span{display:block;height:2px;width:100%;background:${q(cfg.menuText, '#204280')};border-radius:2px;transition:all .25s;}
.${uid}-burger.${uid}-open span:nth-child(1){transform:translateY(7px) rotate(45deg);}
.${uid}-burger.${uid}-open span:nth-child(2){opacity:0;}
.${uid}-burger.${uid}-open span:nth-child(3){transform:translateY(-7px) rotate(-45deg);}
.${uid}-mobile-ctas{display:none;}
@media(max-width:768px){
.${uid}-burger{display:flex;}
.${uid}-nav{display:none;position:absolute;top:100%;left:0;right:0;background:${q(cfg.menuBg, '#ffffff')};z-index:9998;border-top:1px solid rgba(0,0,0,.1);}
.${uid}-nav.${uid}-open{display:block;}
.${uid}-ul{flex-direction:column;align-items:stretch;}
.${uid}-ni{width:100%;}
.${uid}-nl{justify-content:space-between;padding:10px 16px;border-bottom:1px solid rgba(0,0,0,.08);}
.${uid}-drop{display:none;position:static;box-shadow:none;border-radius:0;background:#eeeeee;}
.${uid}-drop-r{left:0;top:auto;border-radius:0;}
.${uid}-drop.${uid}-mob-open{display:block;}
.${uid}-drop .${uid}-nl{padding-left:32px;color:#333333!important;border-bottom:1px solid rgba(0,0,0,.06);}
.${uid}-drop .${uid}-nl:hover,.${uid}-drop .${uid}-nl.${uid}-sel{background:#cccccc!important;}
.${uid}-ni.${uid}-ni-open>.${uid}-nl{background:#cccccc!important;}
.${uid}-drop .${uid}-drop .${uid}-nl{padding-left:48px;}
.${uid}-sitename{font-size:24px;}
.${uid}-brand-inner{padding:0 12px 0 16px;gap:12px;align-items:center;}
.${uid}-logo-link{padding-left:6px;align-items:center;}
.${uid}-namewrap{justify-content:center;}
.${uid}-logo{height:${logoHeightMob};}
.${uid}-ctas{display:none;}
.${uid}-mobile-ctas{display:${mobileCtaHtml ? 'flex' : 'none'};position:sticky;top:0;z-index:9997;width:100vw;margin-left:calc(50% - 50vw);margin-right:calc(50% - 50vw);box-sizing:border-box;padding:8px 16px;gap:8px;overflow-x:auto;background:${q(cfg.brandBg, '#ffffff')};border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;scrollbar-width:none;}
.${uid}-mobile-ctas::-webkit-scrollbar{display:none;}
.${uid}-mobile-cta{flex:1 0 auto;max-width:none;min-width:max-content;padding:9px 14px;font-size:13px;line-height:1.2;}
.${uid}-login-brand{display:none!important;}
.${uid}-login-menu{display:flex!important;}
.${uid}-login-menu,.${uid}-login-menu *{color:${q(cfg.menuText, '#204280')}!important;font-size:14px!important;}
.${uid}-login-menu .zen-c-account{display:none!important;}
.${uid}-login-menu img.zl-navbar-rhs-img{display:block!important;width:24px!important;height:24px!important;border-radius:50%!important;}
}
</style>`;
    const staticMenuItems = cfg.useZenMenu ? '' : buildMenuItems(cfg.menuItems || [], 1);
    const markup = `<div class="${uid}-wrap">`
        + `<div class="${uid}-brand"><div class="${uid}-brand-inner">`
        + (cfg.logoUrl ? `<a href="${escapeHtml(q(cfg.logoLink, '/'))}\" class="${uid}-logo-link"><img src="${escapeHtml(q(cfg.logoUrl))}" alt="${escapeHtml(q(cfg.logoAlt, 'Logo'))}" class="${uid}-logo"></a>` : '')
        + `<div class="${uid}-namewrap">`
        + (siteTitle.text ? `<span class="${uid}-sitename" style="${textStyle(siteTitle)}">${escapeHtml(siteTitle.text)}</span>` : '')
        + (subTitle.text ? `<span class="${uid}-subtitle"  style="${textStyle(subTitle)}">${escapeHtml(subTitle.text)}</span>` : '')
        + `</div>`
        + `<div class="${uid}-brand-spacer"></div>`
        + `<div class="${uid}-brand-right">`
        + (ctaHtml ? `<div class="${uid}-ctas">${ctaHtml}</div>` : '')
        + `<div id="${uid}-login-brand" class="${uid}-login-brand"></div>`
        + `</div></div></div>`
        + `<div class="${uid}-menubar"><div class="${uid}-menu-inner">`
        + `<div id="${uid}-login-menu" class="${uid}-login-menu"></div>`
        + `<nav class="${uid}-nav" id="${uid}-nav">`
        + `<ul class="${uid}-ul" id="${uid}-ul">`
        + staticMenuItems
        + `<li class="${uid}-ni ${uid}-more" id="${uid}-more" style="display:none;">`
        + `<a href="#" class="${uid}-nl" onclick="return false;">More <svg class="${uid}-arr" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3.5L5 6.5L8 3.5"/></svg></a>`
        + `<ul class="${uid}-drop" id="${uid}-more-drop"></ul>`
        + `</li>`
        + `</ul></nav>`
        + `<button class="${uid}-burger" id="${uid}-burger" onclick="${uid}_toggle()" aria-label="Menu"><span></span><span></span><span></span></button>`
        + `</div></div>`
        + (mobileCtaHtml ? `<div class="${uid}-mobile-ctas" aria-label="Header calls to action">${mobileCtaHtml}</div>` : '')
        + `</div>`;
    const zenReader = cfg.useZenMenu ? `
var USE_ZEN=true;
function readZenlerMenu(){var items=[];var lis=document.querySelectorAll("ul.dynamic_menu_texts>li");function copyAttrs(el){var out={};Array.from(el.attributes||[]).forEach(function(attr){if(/^data-/.test(attr.name)||attr.name==="aria-hidden"||attr.name==="hidden"||attr.name==="style"){out[attr.name]=attr.value;}});return out;}function sourceKey(li){return String(li.getAttribute("data-subid")||li.getAttribute("data-id")||"");}lis.forEach(function(li){var action=li.getAttribute("data-action");var item={label:"",url:"#",newTab:false,children:[],liClass:li.className||"",linkClass:"",attrs:copyAttrs(li),linkAttrs:{},sourceKey:sourceKey(li)};if(action==="link"){var a=li.querySelector("a.dynamic-link");if(!a)return;item.label=a.textContent.trim();item.url=a.getAttribute("href")||"#";item.newTab=a.getAttribute("target")==="_blank";item.linkClass=a.className||"";item.linkAttrs=copyAttrs(a);}else if(action==="dropdown"){var tog=li.querySelector("a.dropdown-toggle");if(!tog)return;var clone=tog.cloneNode(true);var caret=clone.querySelector(".caret");if(caret)caret.remove();item.label=clone.textContent.trim();item.linkClass=tog.className||"";item.linkAttrs=copyAttrs(tog);li.querySelectorAll("ul.dropdown-menu>li").forEach(function(sub){var sa=sub.querySelector("a.dynamic-link");if(!sa)return;item.children.push({label:sa.textContent.trim(),url:sa.getAttribute("href")||"#",newTab:sa.getAttribute("target")==="_blank",children:[],liClass:sub.className||"",linkClass:sa.className||"",attrs:copyAttrs(sub),linkAttrs:copyAttrs(sa),sourceKey:sourceKey(sub)});});}if(item.label)items.push(item);});return items;}
function makeNavLi(item,level){var P2=P;var li=document.createElement("li");var hasKids=item.children&&item.children.length>0;li.className=P2+"-ni"+(hasKids?" "+P2+"-has":"")+(level>1?" "+P2+"-sub-ni":"")+(item.liClass?" "+item.liClass:"");Object.keys(item.attrs||{}).forEach(function(name){li.setAttribute(name,item.attrs[name]);});if(item.sourceKey)li.setAttribute("data-vls-source-key",item.sourceKey);var a=document.createElement("a");a.href=item.url;a.className=P2+"-nl"+(item.linkClass?" "+item.linkClass:"");Object.keys(item.linkAttrs||{}).forEach(function(name){a.setAttribute(name,item.linkAttrs[name]);});if(item.newTab){a.target="_blank";a.rel="noopener";}if(hasKids){a.setAttribute("onclick","window['"+P2+"_mdt'](this,event);");}a.appendChild(document.createTextNode(item.label));if(hasKids){var svg=document.createElementNS("http://www.w3.org/2000/svg","svg");svg.setAttribute("class",P2+"-arr");svg.setAttribute("width","10");svg.setAttribute("height","10");svg.setAttribute("viewBox","0 0 10 10");svg.setAttribute("fill","currentColor");var path=document.createElementNS("http://www.w3.org/2000/svg","path");path.setAttribute("d","M2 3.5L5 6.5L8 3.5");svg.appendChild(path);a.appendChild(svg);li.appendChild(a);var drop=document.createElement("ul");drop.className=P2+"-drop"+(level>1?" "+P2+"-drop-r":"");item.children.forEach(function(child){drop.appendChild(makeNavLi(child,level+1));});li.appendChild(drop);}else{li.appendChild(a);}return li;}
function sourceItemHidden(li){if(!li)return false;var s=(li.getAttribute("style")||"").toLowerCase();if(li.hidden||li.getAttribute("aria-hidden")==="true"||/display\\s*:\\s*none/.test(s)||/visibility\\s*:\\s*hidden/.test(s))return true;var cs=window.getComputedStyle?window.getComputedStyle(li):null;if(cs&&(cs.display==="none"||cs.visibility==="hidden"))return true;var cls=(" "+li.className+" ").toLowerCase();return /\\s(d-none|hidden|hide|hidden-menu|hide-menu)\\s/.test(cls);}
function setMenuDisplay(li,value){if(li.style.display!==value)li.style.display=value;}
function syncZenlerMenuVisibility(){var root=document.querySelector("ul.dynamic_menu_texts");if(!root)return;var source={};Array.from(root.querySelectorAll("li[data-id],li[data-subid]")).forEach(function(li){var key=String(li.getAttribute("data-subid")||li.getAttribute("data-id")||"");if(key)source[key]=li;});document.querySelectorAll("."+P+"-ul li[data-vls-source-key]").forEach(function(li){var key=li.getAttribute("data-vls-source-key");var hidden=sourceItemHidden(source[key]);var flag=hidden?"1":"0";if(li.getAttribute("data-vls-zen-hidden")!==flag)li.setAttribute("data-vls-zen-hidden",flag);setMenuDisplay(li,hidden?"none":"");});}
function buildZenNav(attempt){var zenUl=document.querySelector("ul.dynamic_menu_texts");if(zenUl&&zenUl.querySelectorAll("li").length>0){var ul=document.getElementById(P+"-ul");var moreItem=document.getElementById(P+"-more");if(!ul)return;Array.from(ul.children).forEach(function(li){if(li!==moreItem)ul.removeChild(li);});var items=readZenlerMenu();items.forEach(function(item){ul.insertBefore(makeNavLi(item,1),moreItem);});syncZenlerMenuVisibility();initOverflow();}else if((attempt||0)<15){setTimeout(function(){buildZenNav((attempt||0)+1);},300);}}
` : `var USE_ZEN=false;\nfunction syncZenlerMenuVisibility(){}\n`;
    const script = `<script type="module" data-cfasync="false">(function(){
var P="${uid}";
var LIVE_API="${liveApiUrl}";
var overflowCheck=null;
var LOGIN_COLOR="${menuTextColor}";
function hex(v,f){return /^#[0-9a-fA-F]{6}$/.test(String(v||"").trim())?String(v).trim():f;}
function int(v,f,mn,mx){var n=parseInt(v,10);if(isNaN(n))n=f;return Math.max(mn,Math.min(mx,n));}
function norm(v,d){var raw=v;if(!raw||typeof raw!=="object"||Array.isArray(raw))raw={text:v==null?"":String(v)};return{text:String(raw.text||""),size:int(raw.size,d.size,10,96),color:hex(raw.color,d.color),weight:String(raw.weight||raw.bold&&"700"||d.weight||"400"),letterSpacing:Number(raw.letterSpacing||0)};}
function applyTextStyle(el,t){if(!el)return;el.textContent=t.text;el.style.fontSize=t.size+"px";el.style.fontWeight=t.weight;el.style.color=t.color;el.style.letterSpacing=t.letterSpacing+"px";}
function detectLoggedIn(){var root=document.querySelector(".navbar-buttons.jqLoginLogout");if(!root)return false;var summary=Array.from(root.querySelectorAll("a,button")).map(function(node){return((node.textContent||"")+" "+(node.getAttribute("href")||""));}).join(" ").toLowerCase();if(/logout|log out|my account|my settings|admin/.test(summary))return true;if(/login|log in|sign in/.test(summary))return false;return!!root.querySelector(".dropdown-menu li,.dropdown-menu a[href*=logout]");}
function syncCoursesMenu(){return detectLoggedIn();}
function forceLoginVisible(root){if(!root)return;root.style.setProperty("display","flex","important");root.style.setProperty("align-items","center","important");root.style.setProperty("visibility","visible","important");root.style.setProperty("opacity","1","important");root.style.setProperty("position","relative","important");root.style.setProperty("z-index","10001","important");root.querySelectorAll("a,button,span,i,svg").forEach(function(el){el.style.setProperty("color",LOGIN_COLOR,"important");el.style.setProperty("visibility","visible","important");el.style.setProperty("opacity","1","important");});root.querySelectorAll("button").forEach(function(el){el.style.setProperty("display","inline-flex","important");el.style.setProperty("align-items","center","important");});}
function moveLogin(){var slot=document.getElementById(window.innerWidth<=768?P+"-login-menu":P+"-login-brand");if(!slot)return false;var src=document.querySelector(".navbar-buttons.jqLoginLogout");if(!src)return false;if(!slot.contains(src)){slot.appendChild(src);}forceLoginVisible(src);return true;}
window.addEventListener("resize",function(){moveLogin();});
function makeCta(c,mobile){var label=norm(c&&c.label,{size:mobile?13:14,color:c&&c.textColor||"#ffffff",weight:"600"});if(!label.text)return null;var a=document.createElement("a");a.className=P+"-cta"+(mobile?" "+P+"-mobile-cta":"");a.href=String(c.url||"#");if(c.newTab){a.target="_blank";a.rel="noopener";}a.textContent=label.text;a.style.background=hex(c.bgColor,"#204280");a.style.fontSize=label.size+"px";a.style.fontWeight=label.weight;a.style.color=hex(c.textColor,label.color);a.style.letterSpacing=label.letterSpacing+"px";return a;}
function renderCtas(ctas){var list=Array.isArray(ctas)?ctas:[];var desktop=document.querySelector("."+P+"-ctas");var right=document.querySelector("."+P+"-brand-right");if(!desktop&&right&&list.length){desktop=document.createElement("div");desktop.className=P+"-ctas";right.insertBefore(desktop,right.firstChild);}if(desktop){desktop.innerHTML="";list.forEach(function(c){var a=makeCta(c,false);if(a)desktop.appendChild(a);});desktop.style.display=desktop.children.length?"":"none";}var mobile=document.querySelector("."+P+"-mobile-ctas");var wrap=document.querySelector("."+P+"-wrap");if(!mobile&&wrap&&list.length){mobile=document.createElement("div");mobile.className=P+"-mobile-ctas";mobile.setAttribute("aria-label","Header calls to action");wrap.appendChild(mobile);}if(mobile){mobile.innerHTML="";list.forEach(function(c){var a=makeCta(c,true);if(a)mobile.appendChild(a);});if(!mobile.children.length)mobile.style.display="none";else mobile.style.removeProperty("display");}}
function applyPublishedConfig(c){if(!c||typeof c!=="object")return;var brand=document.querySelector("."+P+"-brand"),menubar=document.querySelector("."+P+"-menubar"),brandInner=document.querySelector("."+P+"-brand-inner"),menuInner=document.querySelector("."+P+"-menu-inner");var site=norm(c.siteTitle,{size:36,color:"#204280",weight:"700"}),sub=norm(c.subTitle,{size:13,color:"#204280",weight:"500"});if(brand)brand.style.background=hex(c.brandBg,"#ffffff");if(menubar){menubar.style.background=hex(c.menuBg,"#ffffff");menubar.style.borderBottomColor=site.color;}var cw=int(c.containerWidth,${containerW},600,2400),pl=int(c.padLeft,${padL},0,300),pr=int(c.padRight,${padR},0,300);[brandInner,menuInner].forEach(function(el){if(!el)return;el.style.maxWidth=cw+"px";el.style.paddingLeft=pl+"px";el.style.paddingRight=pr+"px";});if(brand){brand.style.paddingTop=int(c.padTop,${padTop},0,80)+"px";brand.style.paddingBottom=int(c.padBottom,${padBot},0,80)+"px";}applyTextStyle(document.querySelector("."+P+"-sitename"),site);applyTextStyle(document.querySelector("."+P+"-subtitle"),sub);var logoLink=document.querySelector("."+P+"-logo-link"),logo=document.querySelector("."+P+"-logo");if(logoLink&&c.logoLink)logoLink.href=String(c.logoLink);if(logo){if(c.logoUrl)logo.src=String(c.logoUrl);if(c.logoAlt)logo.alt=String(c.logoAlt);var lh=parseFloat(String(c.logoHeight||${logoHeightNum || 56}));if(isFinite(lh))logo.style.height=(window.innerWidth<=768?Math.round(lh*.7):Math.round(lh*1.2))+"px";}var menuColor=hex(c.menuText,"${menuTextColor}");LOGIN_COLOR=menuColor;document.querySelectorAll("."+P+"-nl").forEach(function(el){el.style.color=menuColor;});document.querySelectorAll("."+P+"-burger span").forEach(function(el){el.style.background=menuColor;});renderCtas(c.ctas);moveLogin();syncCoursesMenu();if(overflowCheck)overflowCheck();}
function loadPublishedConfig(){if(!LIVE_API||window[P+"_liveLoaded"])return;window[P+"_liveLoaded"]=true;fetch(LIVE_API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("VLS Header API returned "+r.status);return r.json();}).then(function(data){applyPublishedConfig(data&&data.config);}).catch(function(e){console.error("VLS Header:",e.message||e);});}
function initOverflow(){var ul=document.getElementById(P+"-ul");var moreItem=document.getElementById(P+"-more");var moreDrop=document.getElementById(P+"-more-drop");if(!ul)return;var allItems=Array.from(ul.children).filter(function(li){return li!==moreItem;});function itemHidden(li){return li.getAttribute("data-auth-hidden")==="1"||li.getAttribute("data-vls-zen-hidden")==="1";}function check(){syncZenlerMenuVisibility();if(window.innerWidth<=768){allItems.forEach(function(li){setMenuDisplay(li,itemHidden(li)?"none":"");});moreDrop.innerHTML="";moreItem.style.display="none";return;}syncCoursesMenu();allItems.forEach(function(li){setMenuDisplay(li,itemHidden(li)?"none":"");});moreDrop.innerHTML="";moreItem.style.display="none";var bar=ul.parentElement;if(!bar)return;var avail=bar.offsetWidth-60;var used=0;var overflow=[];allItems.filter(function(li){return !itemHidden(li);}).forEach(function(li){used+=li.offsetWidth;if(used>avail)overflow.push(li);});if(overflow.length){moreItem.style.display="";overflow.forEach(function(li){setMenuDisplay(li,"none");var c=li.cloneNode(true);c.style.display="";moreDrop.appendChild(c);});}}overflowCheck=check;check();if(!window[P+"_overflowBound"]){window.addEventListener("resize",function(){if(overflowCheck)overflowCheck();});window[P+"_overflowBound"]=true;}}
window["${uid}_toggle"]=function(){var nav=document.getElementById(P+"-nav");var brg=document.getElementById(P+"-burger");nav.classList.toggle(P+"-open");brg.classList.toggle(P+"-open");};
var _mdtTs=0;
window["${uid}_mdt"]=function(el,ev){if(window.innerWidth>768)return;var now=Date.now();if(now-_mdtTs<350)return;_mdtTs=now;ev.preventDefault();ev.stopImmediatePropagation();var ni=el.parentElement;var dr=ni.querySelector("."+P+"-drop");if(!dr)return;var op=ni.classList.contains(P+"-ni-open");document.querySelectorAll("."+P+"-drop").forEach(function(d){d.classList.remove(P+"-mob-open");});document.querySelectorAll("."+P+"-ni").forEach(function(n){n.classList.remove(P+"-ni-open");});if(!op){dr.classList.add(P+"-mob-open");ni.classList.add(P+"-ni-open");}};
document.addEventListener("click",function(e){var nav=document.getElementById(P+"-nav");var brg=document.getElementById(P+"-burger");if(nav&&brg&&!nav.contains(e.target)&&!brg.contains(e.target)){nav.classList.remove(P+"-open");brg.classList.remove(P+"-open");}});
${zenReader}function init(){moveLogin();syncCoursesMenu();if(USE_ZEN){buildZenNav(0);}else{initOverflow();}loadPublishedConfig();}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
setTimeout(init,600);setTimeout(init,1500);setTimeout(init,3000);setTimeout(init,8000);setTimeout(init,15000);
var _loginTries=0;var _loginPoll=setInterval(function(){_loginTries++;if(moveLogin()||_loginTries>120){clearInterval(_loginPoll);}},500);
var _lo=new MutationObserver(function(){moveLogin();syncZenlerMenuVisibility();if(overflowCheck)overflowCheck();});_lo.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","style","hidden","aria-hidden","data-visible"]});setTimeout(function(){_lo.disconnect();},60000);
})();<\/script>`;
    return css + '\n' + markup + '\n' + script;
}
