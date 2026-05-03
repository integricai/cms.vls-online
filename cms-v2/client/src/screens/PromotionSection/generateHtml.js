import { normalize, textStyle, escapeHtml } from '../../utils/text';
export function generatePromoSectionHtml(sec) {
    const uid = 'promo' + Date.now().toString(36);
    const title = normalize(sec.title, 'promoTitle');
    const subtitle = normalize(sec.subtitle, 'promoSubtitle');
    const ctaText = normalize(sec.ctaText, 'promoCta');
    const pL = Math.min(200, Math.max(0, sec.padLeft ?? 24));
    const pR = Math.min(200, Math.max(0, sec.padRight ?? 24));
    const bg = sec.bg || '#deebf7';
    const btnBg = sec.btnBg || '#152b57';
    const css = `<style>
.${uid}{font-family:'Poppins',sans-serif;background:${escapeHtml(bg)};padding:28px ${pR}px 28px ${pL}px;box-sizing:border-box;}
.${uid}-inner{max-width:1120px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;}
.${uid}-copy{flex:1;min-width:0;}
.${uid}-title{margin:0 0 6px;line-height:1.25;}
.${uid}-subtitle{margin:0;line-height:1.5;}
.${uid}-cta{display:inline-flex;align-items:center;justify-content:center;min-width:146px;padding:14px 28px;border-radius:8px;background:${escapeHtml(btnBg)};text-decoration:none!important;white-space:nowrap;flex-shrink:0;}
.${uid}-cta:hover{opacity:.92;}
@media(max-width:720px){.${uid}-inner{flex-direction:column;align-items:flex-start;}.${uid}-cta{width:100%;}}
</style>`;
    const body = `<section class="${uid}">`
        + `<div class="${uid}-inner">`
        + `<div class="${uid}-copy">`
        + (title.text ? `<h2 class="${uid}-title" style="${textStyle(title)}">${escapeHtml(title.text)}</h2>` : '')
        + (subtitle.text ? `<p class="${uid}-subtitle" style="${textStyle(subtitle)}">${subtitle.text}</p>` : '')
        + `</div>`
        + (ctaText.text ? `<a class="${uid}-cta" href="${escapeHtml(sec.ctaUrl || '#')}" style="${textStyle(ctaText)}">${escapeHtml(ctaText.text)}</a>` : '')
        + `</div></section>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n${css}\n${body}`;
}
