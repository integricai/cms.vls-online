import { escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
}
export function generateFeatureCardsV4Html(data) {
    const uid = 'fc4' + Date.now().toString(36);
    const bg = safeHex(data.bg, '#f3f6fc');
    const padTop = clamp(data.padTop, 36, 0, 160);
    const padBottom = clamp(data.padBottom, 42, 0, 160);
    const padLeft = clamp(data.padLeft, 30, 0, 160);
    const padRight = clamp(data.padRight, 30, 0, 160);
    const maxWidth = clamp(data.maxWidth, 1180, 320, 1600);
    const cols = clamp(data.cols, 4, 1, 6);
    const gap = clamp(data.gap, 12, 0, 60);
    const cardRadius = clamp(data.cardRadius, 8, 0, 30);
    const eyebrow = (data.eyebrow || '').trim();
    const heading = (data.heading || '').trim();
    const eyebrowTc = safeHex(data.eyebrowTc, '#8a919b');
    const headingTc = safeHex(data.headingTc, '#07172d');
    const cardBg = safeHex(data.cardBg, '#ffffff');
    const cardBorder = safeHex(data.cardBorder, '#dfe6f0');
    const titleTc = safeHex(data.titleTc, '#07172d');
    const subtitleTc = safeHex(data.subtitleTc, '#7b8490');
    const ctaTc = safeHex(data.ctaTc, '#0967b1');
    const cards = (data.cards || []).filter(card => card.title || card.badge || card.subtitle);
    const css = `<style>`
        + `#${uid}{font-family:'Poppins',Arial,sans-serif;background:${bg};padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;box-sizing:border-box;}`
        + `#${uid} *{box-sizing:border-box;}`
        + `#${uid}-inner{max-width:${maxWidth}px;margin:0 auto;}`
        + `#${uid}-eyebrow{margin:0 0 8px;color:${eyebrowTc};font-size:11px;line-height:1.3;font-weight:700;letter-spacing:.12em;text-transform:uppercase;}`
        + `#${uid}-heading{margin:0 0 20px;color:${headingTc};font-size:20px;line-height:1.25;font-weight:700;letter-spacing:0;}`
        + `#${uid}-grid{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${gap}px;}`
        + `.${uid}-card{min-height:112px;background:${cardBg};border:1px solid ${cardBorder};border-radius:${cardRadius}px;padding:15px 15px 14px;display:flex;flex-direction:column;align-items:flex-start;box-shadow:0 1px 2px rgba(15,23,42,.02);}`
        + `.${uid}-badge{display:inline-flex;align-items:center;min-height:20px;border-radius:999px;padding:3px 10px;margin:0 0 9px;font-size:11px;line-height:1.1;font-weight:700;white-space:nowrap;}`
        + `.${uid}-title{margin:0 0 6px;color:${titleTc};font-size:13px;line-height:1.25;font-weight:700;letter-spacing:0;}`
        + `.${uid}-subtitle{margin:0 0 8px;color:${subtitleTc};font-size:12px;line-height:1.35;font-weight:400;}`
        + `.${uid}-cta{margin-top:auto;color:${ctaTc};font-size:12px;line-height:1.2;font-weight:700;text-decoration:none;}`
        + `.${uid}-cta:hover{text-decoration:underline;}`
        + `@media(max-width:900px){#${uid}-grid{grid-template-columns:repeat(${Math.min(cols, 2)},minmax(0,1fr));}}`
        + `@media(max-width:560px){#${uid}{padding-left:20px;padding-right:20px;}#${uid}-grid{grid-template-columns:1fr;}#${uid}-heading{font-size:18px;}}`
        + `</style>`;
    const cardsHtml = cards.map(card => {
        const badgeBg = safeHex(card.badgeBg, '#d8efff');
        const badgeTc = safeHex(card.badgeTc, '#0967b1');
        const ctaText = (card.ctaText || '').trim();
        const ctaUrl = (card.ctaUrl || '').trim();
        const cta = ctaText
            ? (ctaUrl
                ? `<a class="${uid}-cta" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaText)}</a>`
                : `<span class="${uid}-cta">${escapeHtml(ctaText)}</span>`)
            : '';
        return `<div class="${uid}-card">`
            + (card.badge ? `<span class="${uid}-badge" style="background:${badgeBg};color:${badgeTc};">${escapeHtml(card.badge)}</span>` : '')
            + (card.title ? `<h3 class="${uid}-title">${escapeHtml(card.title)}</h3>` : '')
            + (card.subtitle ? `<p class="${uid}-subtitle">${escapeHtml(card.subtitle)}</p>` : '')
            + cta
            + `</div>`;
    }).join('\n');
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">\n`
        + css
        + `\n<section id="${uid}"><div id="${uid}-inner">`
        + (eyebrow ? `<p id="${uid}-eyebrow">${escapeHtml(eyebrow)}</p>` : '')
        + (heading ? `<h2 id="${uid}-heading">${escapeHtml(heading)}</h2>` : '')
        + `<div id="${uid}-grid">\n${cardsHtml}\n</div></div></section>`;
}
