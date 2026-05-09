import type { PageDescWithMenuState, CourseDescBlock } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

function clamp(v: number | undefined, def: number, min: number, max: number): number {
  const n = Number(v ?? def);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}

const PS  = "font-family:'Poppins',sans-serif;line-height:1.7;overflow-wrap:break-word;word-break:break-word;margin:0 0 14px;";
const H3S = "font-family:'Poppins',sans-serif;font-size:18px;font-weight:700;line-height:1.3;margin:1.5rem 0 0.4rem;";
const H4S = "font-family:'Poppins',sans-serif;font-size:16px;font-weight:700;line-height:1.5;margin:1rem 0 0.25rem;";

function renderBlock(block: CourseDescBlock): string {
  const { type } = block;

  if (type === 'paragraph' && block.p) {
    const p = normalize(block.p, 'cdescDesc');
    return p.text.trim() ? `<p style="${PS}${textStyle(p)}">${p.text}</p>\n` : '';
  }

  if (type === 'heading-paragraph') {
    let out = '';
    if (block.h) {
      const h = normalize(block.h, 'cdescHeading');
      if (h.text.trim()) out += `<h3 style="${H3S}${textStyle(h)}">${escapeHtml(h.text)}</h3>\n`;
    }
    if (block.p) {
      const p = normalize(block.p, 'cdescDesc');
      if (p.text.trim()) out += `<p style="${PS}${textStyle(p)}">${p.text}</p>\n`;
    }
    return out;
  }

  if (type === 'heading-bullets' || type === 'bullets') {
    let out = '';
    if (type === 'heading-bullets' && block.h) {
      const h = normalize(block.h, 'cdescHeading');
      if (h.text.trim()) out += `<h3 style="${H3S}${textStyle(h)}">${escapeHtml(h.text)}</h3>\n`;
    }
    out += `<ul style="padding-left:0;margin:0 0 1rem;list-style:none;">\n`;
    (block.bullets ?? []).forEach(bv => {
      const bd = normalize(bv, 'cdescBullet');
      if (bd.text.trim()) out += `  <li style="font-family:'Poppins',sans-serif;line-height:1.7;margin-bottom:0.4rem;${textStyle(bd)}">&bull; ${bd.text}</li>\n`;
    });
    out += `</ul>\n`;
    return out;
  }

  if (type === 'items') {
    let out = '';
    if (block.h) {
      const h = normalize(block.h, 'cdescHeading');
      if (h.text.trim()) out += `<h3 style="${H3S}${textStyle(h)}">${escapeHtml(h.text)}</h3>\n`;
    }
    out += `<div style="margin:0 0 1rem;">\n`;
    (block.items ?? []).forEach(item => {
      const ih = normalize(item.h, 'cdescItemHeading');
      const ip = normalize(item.p, 'cdescDesc');
      if (ih.text.trim()) out += `  <h4 style="${H4S}${textStyle(ih)}">${escapeHtml(ih.text)}</h4>\n`;
      if (ip.text.trim()) out += `  <p style="font-family:'Poppins',sans-serif;line-height:1.7;margin:0 0 8px;${textStyle(ip)}">${ip.text}</p>\n`;
    });
    out += `</div>\n`;
    return out;
  }

  if (type === 'note' && block.p) {
    const np = normalize(block.p, 'cdescNote');
    return np.text.trim()
      ? `<p style="font-family:'Poppins',sans-serif;line-height:1.6;border-left:3px solid #ddd;padding-left:12px;margin:0 0 1rem;${textStyle(np)}">${np.text}</p>\n`
      : '';
  }

  return '';
}

export function generatePageDescWithMenuHtml(d: PageDescWithMenuState): string {
  const uid = 'pdm' + Date.now().toString(36);

  const menuBg    = d.menuBg      || '#f9fafb';
  const menuItemTc = d.menuItemTc || '#374151';
  const menuActBg = d.menuActiveBg || '#204280';
  const menuActTc = d.menuActiveTc || '#ffffff';

  const css = `<style>\n`
    + `.${uid}-outer{display:flex;gap:32px;align-items:flex-start;}\n`
    + `.${uid}-sidebar{width:220px;flex-shrink:0;background:${menuBg};border-radius:10px;padding:16px 12px;position:sticky;top:20px;box-sizing:border-box;}\n`
    + `.${uid}-nav-title{font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6b7280;padding:0 6px;margin:0 0 8px;display:block;}\n`
    + `.${uid}-navlink{display:block;padding:8px 10px;border-radius:6px;font-family:'Poppins',sans-serif;font-size:13px;color:${menuItemTc};text-decoration:none;cursor:pointer;transition:background 0.15s,color 0.15s;}\n`
    + `.${uid}-navlink:hover{background:${menuActBg};color:${menuActTc};}\n`
    + `.${uid}-content{flex:1;min-width:0;font-family:'Poppins',sans-serif;font-size:16px;color:#1a1a1a;line-height:1.7;overflow-wrap:break-word;word-break:break-word;}\n`
    + `@media(max-width:640px){.${uid}-outer{flex-direction:column;}.${uid}-sidebar{width:100%;position:relative;top:0;}}\n`
    + `</style>`;

  const navTitle = d.menuTitle ? `<span class="${uid}-nav-title">${escapeHtml(d.menuTitle)}</span>\n` : '';
  const navLinks = (d.menuItems || []).map(item =>
    `<a class="${uid}-navlink" href="javascript:void(0)" onclick="${uid}nav(${JSON.stringify(item.scrollTarget)})">${escapeHtml(item.title)}</a>`
  ).join('\n');
  const sidebar = `<div class="${uid}-sidebar">\n${navTitle}${navLinks}\n</div>`;

  const titleSize = clamp(d.titleSize, 14, 10, 36);
  const titleTc   = /^#[0-9a-fA-F]{6}$/.test(d.titleTc ?? '') ? d.titleTc : '#1a1a1a';

  let headerHtml = '';
  if (d.title) {
    headerHtml = `<p style="font-family:'Poppins',sans-serif;font-size:${titleSize}px;font-weight:700;color:${titleTc};margin:0 0 14px;display:flex;align-items:center;gap:8px;">`
      + (d.icon ? `<span style="font-size:${titleSize + 4}px;line-height:1;">${escapeHtml(d.icon)}</span>` : '')
      + escapeHtml(d.title) + `</p>`;
  }

  let above = '';
  const bold = normalize(d.introBold, 'cdescIntroBold');
  if (bold.text.trim()) above += `<p style="${PS}${textStyle(bold)}">${bold.text}</p>\n`;
  const p1 = normalize(d.introP1, 'cdescDesc');
  if (p1.text.trim()) above += `<p style="${PS}${textStyle(p1)}">${p1.text}</p>\n`;
  const p2 = normalize(d.introP2, 'cdescDesc');
  if (p2.text.trim()) above += `<p style="${PS}${textStyle(p2)}">${p2.text}</p>\n`;

  const inner = (d.blocks ?? []).map(renderBlock).join('');

  const svgArrow = `<svg id="${uid}Arr" width="14" height="14" viewBox="0 0 14 14" fill="none" style="transition:transform 0.3s ease;"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const btnStyle = `display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;color:#0057b8;background:none;border:none;cursor:pointer;padding:0;`;

  const toggleFn = `function ${uid}T(){`
    + `var e=document.getElementById("${uid}M");`
    + `var a=document.getElementById("${uid}Arr");`
    + `var b=document.getElementById("${uid}B");`
    + `var o=e.style.maxHeight!=="0px"&&e.style.maxHeight!=="";`
    + `if(o){e.style.maxHeight="0px";a.style.transform="rotate(0deg)";b.childNodes[0].textContent="Read more";}`
    + `else{e.style.maxHeight="2000px";a.style.transform="rotate(180deg)";b.childNodes[0].textContent="Read less";}`
    + `}`;

  const navFn = `function ${uid}nav(t){try{var e=document.querySelector(t);if(e)e.scrollIntoView({behavior:'smooth',block:'start'});}catch(x){}}`;

  const contentHtml = `<div>\n`
    + headerHtml
    + above
    + `\n<button id="${uid}B" onclick="${uid}T()" style="${btnStyle}">\nRead more\n${svgArrow}\n</button>\n\n`
    + `<div id="${uid}M" style="overflow:hidden;max-height:0;transition:max-height 0.45s ease;">\n`
    + `<div style="padding-top:1rem;">\n`
    + inner
    + `</div>\n</div>\n\n</div>`;

  const markup = `<div class="${uid}-outer">\n${sidebar}\n<div class="${uid}-content">\n${contentHtml}\n</div>\n</div>`;

  const script = `<script type="text/javascript">\n${navFn}\n${toggleFn}\n<\/script>`;

  return css + '\n\n' + markup + '\n\n' + script;
}
