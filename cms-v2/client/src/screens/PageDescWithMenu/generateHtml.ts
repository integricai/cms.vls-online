import type { PageDescMenuItem, PageDescWithMenuState } from '../../types/cms';
import { escapeHtml } from '../../utils/text';

function safeHex(v: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(String(v || '').trim()) ? String(v).trim() : fallback;
}

function escAttr(v: string | undefined): string {
  return String(v || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const defaultMenuItems: PageDescMenuItem[] = [
  { title: 'Course Overview', scrollTarget: '#course-overview' },
  { title: 'Features', scrollTarget: '#course-features' },
  { title: 'Tutor', scrollTarget: '#course-tutor' },
  { title: 'FAQ', scrollTarget: '#course-faq' },
  { title: 'Curriculum', scrollTarget: '#course-curriculum' },
  { title: 'Pricing', scrollTarget: '#course-pricing' },
];

export function generatePageDescWithMenuHtml(d: PageDescWithMenuState): string {
  const uid = 'pdm' + Date.now().toString(36);
  const menuBg = safeHex(d.menuBg, '#f9fafb');
  const menuItemTc = safeHex(d.menuItemTc, '#374151');
  const menuActBg = safeHex(d.menuActiveBg, '#204280');
  const menuActTc = safeHex(d.menuActiveTc, '#ffffff');
  const items = (d.menuItems && d.menuItems.length ? d.menuItems : defaultMenuItems)
    .filter(item => item.title.trim() && item.scrollTarget.trim());
  const bannerHeading = (d.bannerHeading || 'Start your ACCA journey with VLS').trim();
  const bannerSubheading = (d.bannerSubheading || 'Study with structured lessons, expert tutors, revision support and exam-focused resources.').trim();
  const bannerCtaText = (d.bannerCtaText || 'Enrol Now').trim();
  const bannerCtaUrl = (d.bannerCtaUrl || '#course-pricing').trim();
  const ctaTarget = d.bannerCtaNewTab ? ' target="_blank" rel="noopener"' : '';
  const ctaData = bannerCtaUrl.startsWith('#') ? ` data-target="${escAttr(bannerCtaUrl)}"` : '';

  const css = `<style>\n`
    + `.${uid}-wrap{font-family:'Poppins',sans-serif;position:sticky;top:132px;z-index:50;background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 10px 28px rgba(15,23,42,.08);overflow:hidden;box-sizing:border-box;}\n`
    + `.${uid}-wrap *{box-sizing:border-box;}\n`
    + `.${uid}-inner{display:grid;grid-template-columns:minmax(280px,1fr) minmax(320px,1.25fr);align-items:stretch;min-height:116px;}\n`
    + `.${uid}-nav{background:${menuBg};padding:14px 16px;display:flex;flex-direction:column;justify-content:center;min-width:0;}\n`
    + `.${uid}-nav-title{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin:0 0 8px;}\n`
    + `.${uid}-links{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}\n`
    + `.${uid}-navlink{display:inline-flex;align-items:center;justify-content:center;min-height:34px;padding:8px 11px;border-radius:7px;font-size:13px;font-weight:600;line-height:1.2;color:${menuItemTc}!important;text-decoration:none!important;white-space:nowrap;transition:background .15s,color .15s,box-shadow .15s;outline-offset:2px;}\n`
    + `.${uid}-navlink:hover,.${uid}-navlink.${uid}-active{background:${menuActBg};color:${menuActTc}!important;box-shadow:0 6px 14px rgba(32,66,128,.16);}\n`
    + `.${uid}-banner{background:#0f2155;color:#ffffff;padding:18px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;min-width:0;}\n`
    + `.${uid}-banner-text{min-width:0;}\n`
    + `.${uid}-heading{font-size:18px;font-weight:700;line-height:1.25;margin:0 0 5px;color:#ffffff;}\n`
    + `.${uid}-sub{font-size:13px;font-weight:400;line-height:1.45;margin:0;color:#d6dbea;max-width:680px;}\n`
    + `.${uid}-cta{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;min-height:40px;padding:10px 18px;border-radius:7px;background:#cc0000;color:#ffffff!important;text-decoration:none!important;font-size:14px;font-weight:700;white-space:nowrap;outline-offset:3px;}\n`
    + `.${uid}-cta:hover{background:#b00000;color:#ffffff!important;}\n`
    + `@media(max-width:991px){.${uid}-wrap{top:96px;}.${uid}-inner{grid-template-columns:1fr;}.${uid}-banner{min-height:88px;}.${uid}-links{flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:2px;}}\n`
    + `@media(max-width:640px){.${uid}-wrap{top:0;border-left:0;border-right:0;border-radius:0;box-shadow:0 6px 16px rgba(15,23,42,.08);}.${uid}-banner{position:relative;padding:12px 16px;align-items:flex-start;}.${uid}-heading{font-size:15px;}.${uid}-sub{font-size:12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}.${uid}-cta{min-height:34px;padding:8px 12px;font-size:12px;}.${uid}-nav{padding:8px 12px;position:sticky;top:0;}.${uid}-nav-title{display:none;}.${uid}-links{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;}.${uid}-links::-webkit-scrollbar{display:none;}.${uid}-navlink{font-size:12px;min-height:32px;padding:8px 10px;}}\n`
    + `</style>`;

  const navTitle = d.menuTitle ? `<span class="${uid}-nav-title">${escapeHtml(d.menuTitle)}</span>` : '';
  const navLinks = items.map(item =>
    `<a class="${uid}-navlink" href="${escAttr(item.scrollTarget)}" data-target="${escAttr(item.scrollTarget)}">${escapeHtml(item.title)}</a>`
  ).join('');

  const markup = `<section class="${uid}-wrap" aria-label="Course page navigation">\n`
    + `<div class="${uid}-inner">\n`
    + `<nav class="${uid}-nav" aria-label="Course sections">${navTitle}<div class="${uid}-links">${navLinks}</div></nav>\n`
    + `<div class="${uid}-banner">\n`
    + `<div class="${uid}-banner-text"><p class="${uid}-heading">${escapeHtml(bannerHeading)}</p><p class="${uid}-sub">${escapeHtml(bannerSubheading)}</p></div>\n`
    + `<a class="${uid}-cta" href="${escAttr(bannerCtaUrl || '#course-pricing')}"${ctaTarget}${ctaData}>${escapeHtml(bannerCtaText)}</a>\n`
    + `</div>\n</div>\n</section>`;

  const script = `<script type="text/javascript">\n(function(){\n`
    + `var root=document.querySelector(".${uid}-wrap");if(!root)return;\n`
    + `function block(el){return el&&el.closest?el.closest(".block,.course-curriculum,[data-vctabs]")||el:el;}\n`
    + `function textBlock(txt){var nodes=document.querySelectorAll("h1,h2,h3,h4,p,span,button");for(var i=0;i<nodes.length;i++){if((nodes[i].textContent||"").toLowerCase().indexOf(txt.toLowerCase())>-1)return block(nodes[i]);}return null;}\n`
    + `function setId(id,el){if(el&&!document.getElementById(id)){el.id=id;el.style.scrollMarginTop="190px";}}\n`
    + `setId("course-overview",textBlock("Exam Paper Overview")||document.querySelector(".content-style"));\n`
    + `setId("course-features",block(document.querySelector("[data-vctabs='1']")));\n`
    + `setId("course-tutor",textBlock("Get tutor support")||textBlock("Tutor support"));\n`
    + `setId("course-faq",block(document.querySelector("[class*='vlsfaq']"))||textBlock("What is the FA2 exam"));\n`
    + `setId("course-curriculum",document.querySelector(".course-curriculum")||block(document.getElementById("zen_cs_cur_dynamic"))||textBlock("Course Content"));\n`
    + `setId("course-pricing",document.querySelector(".pricing")||block(document.getElementById("zen_cs_plans_dynamic_3"))||textBlock("Course Pricing"));\n`
    + `function offset(){var header=document.querySelector(".vlshldjzt-wrap,.headers,.navbar");var h=header?header.getBoundingClientRect().height:0;return Math.max(72,Math.min(180,h+root.getBoundingClientRect().height+16));}\n`
    + `root.querySelectorAll("a[data-target]").forEach(function(a){a.addEventListener("click",function(e){var sel=a.getAttribute("data-target")||"";if(sel.charAt(0)!=="#")return;var el=document.getElementById(sel.slice(1));if(!el)return;e.preventDefault();window.history.replaceState(null,"",sel);window.scrollTo({top:el.getBoundingClientRect().top+window.pageYOffset-offset(),behavior:"smooth"});});});\n`
    + `var links=[].slice.call(root.querySelectorAll("a[data-target]"));var ids=links.map(function(a){return(a.getAttribute("data-target")||"").replace("#","");});\n`
    + `function active(id){links.forEach(function(a){a.classList.toggle("${uid}-active",(a.getAttribute("data-target")||"")==="#"+id);});}\n`
    + `if("IntersectionObserver" in window){var io=new IntersectionObserver(function(entries){entries.forEach(function(en){if(en.isIntersecting)active(en.target.id);});},{rootMargin:"-"+offset()+"px 0px -55% 0px",threshold:.01});ids.forEach(function(id){var el=document.getElementById(id);if(el)io.observe(el);});}\n`
    + `})();\n<\/script>`;

  return css + '\n\n' + markup + '\n\n' + script;
}
