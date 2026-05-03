import { normalize, textStyle, escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
function chipsHtml(chips, uid, chipStyle) {
    return String(chips || '').split(/\n+/).map(c => c.trim()).filter(Boolean)
        .map(chip => `<span class="${uid}-chip" style="${chipStyle}">${escapeHtml(chip)}</span>`)
        .join('');
}
export function generateProgramCardsV2Html(data) {
    const uid = 'pcv2-' + Date.now().toString(36);
    const maxWidth = clamp(data.maxWidth, 930, 520, 1400);
    const gap = clamp(data.gap, 16, 0, 60);
    const cards = (data.cards || []).map(card => {
        const accent = safeHex(card.accent, '#1f73b7');
        const ctaBg = safeHex(card.ctaBg, '#0d1f3c');
        const tagBg = safeHex(card.tagBg, '#e4f2ff');
        const cardBg = safeHex(card.cardBg, '#ffffff');
        const eyebrow = normalize(card.eyebrow, 'pcv2Eyebrow');
        const title = normalize(card.title, 'pcv2Title');
        const desc = normalize(card.desc, 'pcv2Desc');
        const meta = normalize(card.meta, 'pcv2Meta');
        const cta = normalize(card.cta, 'pcv2Cta');
        const chip = normalize('', 'pcv2Chip');
        const chipStyle = textStyle(chip);
        const media = card.imageUrl
            ? `<img src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.imageAlt || title.text || '')}">`
            : `<span>${escapeHtml(card.imageAlt || title.text || 'Program image')}</span>`;
        return `<article class="${uid}-card" style="background:${cardBg};border-left-color:${accent};">`
            + `<div class="${uid}-media" style="background:linear-gradient(110deg,${accent}22,#e8eef6 70%);">${media}</div>`
            + `<div class="${uid}-body">`
            + (eyebrow.text ? `<div class="${uid}-eyebrow" style="${textStyle(eyebrow)};background:${tagBg};color:${accent};">${escapeHtml(eyebrow.text)}</div>` : '')
            + (title.text ? `<h3 style="${textStyle(title)}">${escapeHtml(title.text)}</h3>` : '')
            + (desc.text ? `<p style="${textStyle(desc)}">${escapeHtml(desc.text)}</p>` : '')
            + `<div class="${uid}-chips">${chipsHtml(card.chips, uid, chipStyle)}</div>`
            + `<div class="${uid}-bottom">`
            + (meta.text ? `<span class="${uid}-meta" style="${textStyle(meta)}">${escapeHtml(meta.text)}</span>` : '<span></span>')
            + `<a class="${uid}-cta" href="${escapeHtml(card.url || '#')}" style="${textStyle(cta)};background:${ctaBg};">${escapeHtml(cta.text || 'Learn More →')}</a>`
            + `</div></div></article>`;
    }).join('');
    const css = `<style>`
        + `.${uid}{font-family:'Poppins',sans-serif;background:${safeHex(data.bg, '#ffffff')};padding:0;box-sizing:border-box;}`
        + `.${uid} *{box-sizing:border-box;}`
        + `.${uid}-wrap{max-width:${maxWidth}px;margin:0 auto;display:flex;flex-direction:column;gap:${gap}px;}`
        + `.${uid}-card{display:grid;grid-template-columns:34% minmax(0,1fr);min-height:232px;border:1px solid #dfe4ea;border-left-width:6px;border-radius:10px;overflow:hidden;}`
        + `.${uid}-media{min-height:232px;display:flex;align-items:flex-start;justify-content:flex-start;overflow:hidden;}`
        + `.${uid}-media img{width:100%;height:100%;object-fit:cover;display:block;}`
        + `.${uid}-media span{padding:0 8px;font-size:18px;color:#1a1a1a;}`
        + `.${uid}-body{padding:22px 24px 20px;display:flex;flex-direction:column;min-width:0;}`
        + `.${uid}-eyebrow{display:inline-flex;align-self:flex-start;border-radius:999px;padding:4px 12px;text-transform:uppercase;line-height:1.1;margin:0 0 8px;}`
        + `.${uid} h3{margin:0 0 8px;line-height:1.25;}`
        + `.${uid} p{margin:0 0 14px;line-height:1.55;}`
        + `.${uid}-chips{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;}`
        + `.${uid}-chip{display:inline-flex;align-items:center;border:1px solid #d8d8d1;background:#f7f5ef;border-radius:999px;padding:4px 11px;line-height:1.1;}`
        + `.${uid}-bottom{border-top:1px solid #e5e7eb;margin-top:auto;padding-top:14px;display:flex;align-items:center;justify-content:space-between;gap:16px;}`
        + `.${uid}-meta{line-height:1.4;}`
        + `.${uid}-cta{border-radius:8px;padding:10px 18px;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;min-width:128px;}`
        + `@media(max-width:760px){.${uid}-card{grid-template-columns:1fr;}.${uid}-media{min-height:180px;}.${uid}-body{padding:18px;}.${uid}-bottom{align-items:flex-start;flex-direction:column;}.${uid}-cta{width:100%;}}`
        + `</style>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">\n`
        + css + `\n<section class="${uid}"><div class="${uid}-wrap">${cards}</div></section>`;
}
