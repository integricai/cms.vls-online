import { normalize, textStyle, escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
export function generateFeatureCardsV2Html(data) {
    const uid = 'fc2' + Date.now().toString(36);
    const bg = safeHex(data.bg, '#f0f4f8');
    const padTop = clamp(data.padTop, 60, 0, 200);
    const padBottom = clamp(data.padBottom, 60, 0, 200);
    const padLeft = clamp(data.padLeft, 0, 0, 200);
    const padRight = clamp(data.padRight, 0, 0, 200);
    const cols = clamp(data.cols, 3, 2, 4);
    const sepColor = safeHex(data.sepColor, '#204280');
    const cards = (data.cards || []).filter(card => normalize(card.title, 'fc2Title').text.trim());
    const nthTablet = cols > 1 ? 2 : 1;
    const css = `<style>`
        + `.${uid}{font-family:'Poppins',sans-serif;background:${bg};padding:${padTop}px ${padRight}px ${padBottom}px ${padLeft}px;box-sizing:border-box;}`
        + `.${uid}-grid{display:grid;grid-template-columns:repeat(${cols},1fr);column-gap:0;row-gap:40px;}`
        + `.${uid}-card{padding:32px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;border-right:1px dotted ${sepColor};}`
        + `.${uid}-card:nth-child(${cols}n){border-right:none;}`
        + `@media(max-width:900px){`
        + `.${uid}-grid{grid-template-columns:repeat(${nthTablet},1fr);}`
        + `.${uid}-card{border-right:1px dotted ${sepColor};}`
        + `.${uid}-card:nth-child(${nthTablet}n){border-right:none;}`
        + `}`
        + `@media(max-width:600px){.${uid}-grid{grid-template-columns:1fr;}.${uid}-card{border-right:none;}}`
        + `.${uid}-ti{text-transform:uppercase;margin:0 0 12px;line-height:1.25;}`
        + `.${uid}-line{width:65%;height:3px;border-radius:2px;margin:0 0 20px;flex-shrink:0;}`
        + `.${uid}-de{line-height:1.75;margin:0 0 24px;flex:1;}`
        + `.${uid}-cta{display:inline-block;padding:10px 24px;border:2px solid var(--fc2-cta-color,currentColor);text-transform:uppercase;text-decoration:none !important;}`
        + `.${uid}-cta:hover{background:var(--fc2-cta-color,currentColor);color:#fff !important;}`
        + `</style>`;
    const cardsHtml = cards.map(card => {
        const ti = normalize(card.title, 'fc2Title');
        const de = normalize(card.desc, 'fc2Desc');
        const cta = normalize(card.ctaText, 'fc2Cta');
        const lc = safeHex(card.lineColor, '#204280');
        return `<div class="${uid}-card">`
            + `<div class="${uid}-ti" style="${textStyle(ti)}">${escapeHtml(ti.text)}</div>`
            + `<div class="${uid}-line" style="background:${lc}"></div>`
            + (de.text ? `<p class="${uid}-de" style="${textStyle(de)}">${escapeHtml(de.text)}</p>` : '')
            + (cta.text ? `<a href="${escapeHtml(card.ctaUrl || '#')}" class="${uid}-cta" style="--fc2-cta-color:${cta.color};${textStyle(cta)}">${escapeHtml(cta.text)}</a>` : '')
            + `</div>`;
    }).join('\n');
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n`
        + css
        + `\n<div class="${uid}"><div class="${uid}-grid">\n${cardsHtml}\n</div></div>`;
}
