import { escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
function hexToRgb(hex) {
    const h = (hex || '#204280').replace('#', '').padEnd(6, '0');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return (isNaN(r) || isNaN(g) || isNaN(b)) ? '32,66,128' : `${r},${g},${b}`;
}
export function generateVerticalCardsHtml(data) {
    const uid = 'vc' + Date.now().toString(36);
    const bg = safeHex(data.bg, '#f8faff');
    const padTop = clamp(data.padTop, 60, 0, 200);
    const padBottom = clamp(data.padBottom, 60, 0, 200);
    const padLeft = clamp(data.padLeft, 80, 0, 200);
    const padRight = clamp(data.padRight, 80, 0, 200);
    const cols = clamp(data.cols, 3, 2, 4);
    const gap = clamp(data.gap, 24, 0, 80);
    const eyebrow = (data.eyebrow || '').trim();
    const eyebrowColor = safeHex(data.eyebrowColor, '#4a90d9');
    const headingText = (data.headingText || '').trim();
    const headingColor = safeHex(data.headingColor, '#1a1a1a');
    const descText = (data.descText || '').trim();
    const descColor = safeHex(data.descColor, '#4a5568');
    const cards = (data.cards || []).filter(c => c.title);
    const css = `<style>`
        + `#${uid}{font-family:'Poppins',sans-serif;background:${bg};padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;box-sizing:border-box;}`
        + `#${uid}-hdr{text-align:center;margin-bottom:40px;}`
        + `#${uid}-eyebrow{font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${eyebrowColor};margin-bottom:10px;}`
        + `#${uid}-h2{font-size:32px;font-weight:700;color:${headingColor};margin:0 0 14px;line-height:1.2;}`
        + `#${uid}-desc{font-size:16px;color:${descColor};margin:0 auto;max-width:720px;line-height:1.7;}`
        + `#${uid}-grid{display:grid;grid-template-columns:repeat(${cols},1fr);gap:${gap}px;}`
        + `.${uid}-card{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);display:flex;flex-direction:column;}`
        + `.${uid}-hdr{padding:24px 20px;}`
        + `.${uid}-badge{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.2);font-size:14px;font-weight:700;color:#fff;margin-bottom:12px;}`
        + `.${uid}-ctitle{font-size:20px;font-weight:700;color:#fff;margin:0 0 6px;line-height:1.2;}`
        + `.${uid}-csub{font-size:13px;color:rgba(255,255,255,0.8);margin:0;}`
        + `.${uid}-body{padding:16px 20px;flex:1;display:flex;flex-direction:column;gap:8px;}`
        + `.${uid}-tag{display:flex;align-items:center;gap:10px;padding:9px 12px;background:#f8f9fa;border-radius:8px;}`
        + `.${uid}-code{font-size:11px;font-weight:700;letter-spacing:0.06em;padding:3px 8px;border-radius:4px;white-space:nowrap;flex-shrink:0;}`
        + `.${uid}-tname{font-size:13px;color:#374151;line-height:1.4;}`
        + `@media(max-width:900px){#${uid}-grid{grid-template-columns:repeat(${Math.min(cols, 2)},1fr);}}`
        + `@media(max-width:600px){#${uid}-grid{grid-template-columns:1fr;}}`
        + `</style>`;
    const headerHtml = (eyebrow || headingText || descText)
        ? `<div id="${uid}-hdr">`
            + (eyebrow ? `<div id="${uid}-eyebrow">${escapeHtml(eyebrow)}</div>` : '')
            + (headingText ? `<h2 id="${uid}-h2">${escapeHtml(headingText)}</h2>` : '')
            + (descText ? `<p id="${uid}-desc">${escapeHtml(descText)}</p>` : '')
            + `</div>\n`
        : '';
    const cardsHtml = cards.map(card => {
        const hbg = safeHex(card.headerBg, '#204280');
        const rgb = hexToRgb(hbg);
        const tags = (card.tags || []).filter(t => t.code || t.name);
        const tagsHtml = tags.map(t => `<div class="${uid}-tag">`
            + (t.code ? `<span class="${uid}-code" style="background:rgba(${rgb},0.12);color:${hbg};">${escapeHtml(t.code)}</span>` : '')
            + (t.name ? `<span class="${uid}-tname">${escapeHtml(t.name)}</span>` : '')
            + `</div>`).join('\n');
        return `<div class="${uid}-card">`
            + `<div class="${uid}-hdr" style="background:${hbg};">`
            + (card.number ? `<div class="${uid}-badge">${escapeHtml(card.number)}</div>` : '')
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
