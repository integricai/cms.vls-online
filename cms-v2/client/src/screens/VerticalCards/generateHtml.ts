import type { Fc3State } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

function safeHex(v: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v! : fallback;
}
function clamp(v: number | undefined, def: number, min: number, max: number): number {
  const n = Number(v ?? def);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
function hexToRgb(hex: string): string {
  const h = (hex || '#204280').replace('#', '').padEnd(6, '0');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (isNaN(r) || isNaN(g) || isNaN(b)) ? '32,66,128' : `${r},${g},${b}`;
}
function attr(value: string | undefined): string {
  return escapeHtml(value || '').replace(/'/g, '&#39;');
}
function strongHtml(value: string | undefined): string {
  const tokenOpen = '%%VLS_STRONG_OPEN%%';
  const tokenClose = '%%VLS_STRONG_CLOSE%%';
  return escapeHtml(value || '')
    .replace(/&lt;strong&gt;/gi, tokenOpen)
    .replace(/&lt;\/strong&gt;/gi, tokenClose)
    .replace(new RegExp(tokenOpen, 'g'), '<strong>')
    .replace(new RegExp(tokenClose, 'g'), '</strong>');
}

export function generateVerticalCardsHtml(data: Fc3State): string {
  const uid          = 'vc' + Date.now().toString(36);
  const bg           = safeHex(data.bg, '#f8faff');
  const padTop       = clamp(data.padTop,    60, 0, 200);
  const padBottom    = clamp(data.padBottom, 60, 0, 200);
  const padLeft      = clamp(data.padLeft,   80, 0, 200);
  const padRight     = clamp(data.padRight,  80, 0, 200);
  const cols         = clamp(data.cols,       3, 1, 6);
  const gap          = clamp(data.gap,       24, 0,  80);
  const eyebrow      = (data.eyebrow      || '').trim();
  const eyebrowColor = safeHex(data.eyebrowColor, '#4a90d9');
  const headingText  = (data.headingText  || '').trim();
  const headingColor = safeHex(data.headingColor, '#1a1a1a');
  const descText     = (data.descText     || '').trim();
  const descColor    = safeHex(data.descColor, '#4a5568');
  const titleStyle   = normalize(data.cardTitleStyle, 'vc3CardTitle');
  const subStyle     = normalize(data.cardSubStyle,   'vc3CardSub');
  const itemStyle    = normalize(data.cardItemStyle,  'vc3CardItem');
  const cards        = (data.cards || []).filter(c => c.title);

  const css = `<style>`
    + `#${uid}{font-family:'Poppins',sans-serif;background:${bg};padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;box-sizing:border-box;}`
    + `#${uid}-hdr{text-align:center;margin-bottom:40px;}`
    + `#${uid}-eyebrow{font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor};margin-bottom:10px;}`
    + `#${uid}-h2{font-size:32px;font-weight:700;color:${headingColor};margin:0 0 14px;line-height:1.2;}`
    + `#${uid}-desc{font-size:16px;color:${descColor};margin:0 auto;max-width:720px;line-height:1.7;}`
    + `#${uid}-grid{display:flex;flex-wrap:wrap;gap:${gap}px;justify-content:center;align-items:stretch;}`
    + `.${uid}-card{width:calc((100% - ${gap * (cols - 1)}px) / ${cols});max-width:340px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;flex-direction:column;}`
    + `.${uid}-hdr{padding:24px 20px;}`
    + `.${uid}-badge{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;}`
    + `.${uid}-ctitle{${textStyle(titleStyle)}margin:0 0 6px;line-height:1.2;}`
    + `.${uid}-csub{${textStyle(subStyle)}margin:0;}`
    + `.${uid}-body{padding:16px 20px;flex:1;display:flex;flex-direction:column;gap:8px;}`
    + `.${uid}-tag{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8f9fa;border-radius:8px;}`
    + `.${uid}-code{font-size:11px;font-weight:700;letter-spacing:0.06em;padding:3px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;}`
    + `.${uid}-tname{${textStyle(itemStyle)}line-height:1.4;}`
    + `.${uid}-cta-card{border:1px solid #e5e7eb;box-shadow:none;}`
    + `.${uid}-cta-head{position:relative;min-height:80px;padding:0 16px;display:flex;align-items:flex-end;overflow:hidden;}`
    + `.${uid}-cta-head::after{content:"";position:absolute;right:16px;top:-20px;width:74px;height:74px;border-radius:50%;background:rgba(255,255,255,.08);}`
    + `.${uid}-cta-label{position:relative;z-index:1;margin-bottom:12px;display:inline-flex;align-items:center;border-radius:999px;padding:4px 12px;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.2);font-size:10px;font-weight:700;color:#ffffff;line-height:1;}`
    + `.${uid}-cta-num{position:absolute;right:24px;top:15px;z-index:1;font-size:20px;font-weight:800;color:rgba(255,255,255,.15);letter-spacing:.02em;}`
    + `.${uid}-cta-body{padding:16px;flex:1;display:flex;flex-direction:column;}`
    + `.${uid}-cta-code{display:inline-flex;width:max-content;margin-bottom:10px;border-radius:8px;padding:4px 10px;font-size:12px;font-weight:700;line-height:1;}`
    + `.${uid}-cta-title{font-size:18px;font-weight:700;color:#071739;line-height:1.25;margin:0 0 6px;}`
    + `.${uid}-cta-sub{font-size:12px;font-weight:400;color:#7b8493;margin:0 0 12px;line-height:1.45;}`
    + `.${uid}-cta-list{list-style:none;margin:0 0 22px;padding:0;display:grid;gap:7px;}`
    + `.${uid}-cta-list li{position:relative;margin:0;padding-left:14px;font-size:12px;font-weight:400;color:#5e6877;line-height:1.35;}`
    + `.${uid}-cta-list li::before{content:"";position:absolute;left:0;top:.55em;width:5px;height:5px;border-radius:50%;background:#1267ae;}`
    + `.${uid}-cta-footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:14px;}`
    + `.${uid}-cta-foot-text{font-size:12px;font-weight:400;color:#697386;line-height:1.4;}`
    + `.${uid}-cta-foot-text strong{font-family:'Poppins',sans-serif;font-weight:500;color:#071739;}`
    + `.${uid}-cta-btn{display:inline-flex;align-items:center;justify-content:center;min-height:38px;padding:10px 18px;border-radius:7px;text-decoration:none;white-space:nowrap;font-size:12px;font-weight:700;}`
    + `@media(max-width:900px){.${uid}-card{width:calc((100% - ${gap * (Math.min(cols, 2) - 1)}px) / ${Math.min(cols, 2)});}}`
    + `@media(max-width:600px){.${uid}-card{width:100%;max-width:none;}}`
    + `</style>`;

  const headerHtml = (eyebrow || headingText || descText)
    ? `<div id="${uid}-hdr">`
      + (eyebrow     ? `<div id="${uid}-eyebrow">${escapeHtml(eyebrow)}</div>` : '')
      + (headingText ? `<h2 id="${uid}-h2">${escapeHtml(headingText)}</h2>` : '')
      + (descText    ? `<p id="${uid}-desc">${escapeHtml(descText)}</p>` : '')
      + `</div>\n`
    : '';

  const cardsHtml = cards.map(card => {
    const hbg  = safeHex(card.headerBg, '#204280');
    const rgb  = hexToRgb(hbg);
    const tags = (card.tags || []).filter(t => t.code || t.name);
    if ((card.type || 'standard') === 'cta') {
      const tagsHtml = tags.map(t => `<li>${escapeHtml(t.name || t.code)}</li>`).join('');
      const firstCode = tags.find(t => t.code)?.code || card.number;
      const label = (card.headerLabel || '').trim();
      const footer = strongHtml(card.footerHtml);
      const ctaText = (card.ctaText || '').trim();
      return `<div class="${uid}-card ${uid}-cta-card">`
        + `<div class="${uid}-cta-head" style="background:linear-gradient(135deg,${hbg},rgba(${rgb},.78));">`
        + (label ? `<span class="${uid}-cta-label">${escapeHtml(label)}</span>` : '')
        + (card.number ? `<span class="${uid}-cta-num">${escapeHtml(card.number)}</span>` : '')
        + `</div>`
        + `<div class="${uid}-cta-body">`
        + (firstCode ? `<div class="${uid}-cta-code" style="background:rgba(${rgb},.12);color:${hbg};">${escapeHtml(firstCode)}</div>` : '')
        + `<h3 class="${uid}-cta-title">${escapeHtml(card.title)}</h3>`
        + (card.subtitle ? `<p class="${uid}-cta-sub">${escapeHtml(card.subtitle)}</p>` : '')
        + (tagsHtml ? `<ul class="${uid}-cta-list">${tagsHtml}</ul>` : '')
        + ((footer || ctaText) ? `<div class="${uid}-cta-footer">`
          + (footer ? `<div class="${uid}-cta-foot-text">${footer}</div>` : '<div></div>')
          + (ctaText ? `<a class="${uid}-cta-btn" href="${attr(card.ctaUrl || '#')}" style="background:${safeHex(card.ctaBg, '#0d1f3c')};color:${safeHex(card.ctaColor, '#ffffff')};">${escapeHtml(ctaText)}</a>` : '')
          + `</div>` : '')
        + `</div></div>`;
    }
    const tagsHtml = tags.map(t =>
      `<div class="${uid}-tag">`
      + (t.code ? `<span class="${uid}-code" style="background:rgba(${rgb},0.12);color:${hbg};">${escapeHtml(t.code)}</span>` : '')
      + (t.name ? `<span class="${uid}-tname">${escapeHtml(t.name)}</span>` : '')
      + `</div>`,
    ).join('\n');
    return `<div class="${uid}-card">`
      + `<div class="${uid}-hdr" style="background:${hbg};">`
      + (card.number   ? `<div class="${uid}-badge">${escapeHtml(card.number)}</div>` : '')
      + `<div class="${uid}-ctitle">${escapeHtml(card.title)}</div>`
      + (card.subtitle ? `<div class="${uid}-csub">${escapeHtml(card.subtitle)}</div>` : '')
      + `</div>`
      + (tags.length ? `<div class="${uid}-body">${tagsHtml}</div>` : '')
      + `</div>`;
  }).join('\n');

  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n`
    + css
    + `\n<div id="${uid}">${headerHtml}<div id="${uid}-grid">\n${cardsHtml}\n</div></div>`;
}
