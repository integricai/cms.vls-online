import { normalize, textStyle, escapeHtml } from '../../utils/text';
import { ICONS } from './icons';
export function generateAboutUsHtml(sec) {
    const uid = 'au' + Date.now().toString(36);
    const eyebrow = normalize(sec.eyebrow, 'aboutEyebrow');
    const title = normalize(sec.title, 'aboutTitle');
    const ctaText = normalize(sec.ctaText, 'aboutCta');
    const pL = Math.min(200, Math.max(0, sec.padLeft ?? 24));
    const pR = Math.min(200, Math.max(0, sec.padRight ?? 24));
    const paragraphsHtml = (sec.paragraphs ?? []).map(p => {
        const para = normalize(p, 'aboutParagraph');
        return para.text
            ? `<p class="${uid}-para" style="${textStyle(para)}">${para.text}</p>`
            : '';
    }).join('');
    const cardsHtml = (sec.cards ?? []).map(card => {
        const svg = ICONS[card.icon] ?? ICONS['star'];
        const cardTitle = normalize(card.title, 'aboutCardTitle');
        const cardDesc = normalize(card.desc, 'aboutCard');
        return `<div class="${uid}-card">`
            + `<div class="${uid}-icon">${svg}</div>`
            + `<div class="${uid}-card-copy">`
            + (cardTitle.text ? `<h3 class="${uid}-card-title" style="${textStyle(cardTitle)}">${escapeHtml(cardTitle.text)}</h3>` : '')
            + (cardDesc.text ? `<p  class="${uid}-card-desc"  style="${textStyle(cardDesc)}">${cardDesc.text}</p>` : '')
            + `</div></div>`;
    }).join('');
    const css = `<style>
.${uid}{font-family:'Poppins',sans-serif;background:#fff;padding:48px ${pR}px 48px ${pL}px;box-sizing:border-box;}
.${uid}-inner{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,1fr);gap:56px;align-items:start;}
.${uid}-left,.${uid}-right{min-width:0;}
.${uid}-ey{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#204280;margin:0 0 12px;}
.${uid}-title{font-size:26px;font-weight:600;color:#202124;line-height:1.25;margin:0 0 18px;}
.${uid}-para{line-height:1.75;margin:0 0 14px;}
.${uid}-cta{display:inline-flex;align-items:center;gap:6px;margin-top:14px;font-size:14px;font-weight:600;color:#204280!important;text-decoration:none!important;}
.${uid}-cta:hover{text-decoration:underline!important;}
.${uid}-cards{display:flex;flex-direction:column;gap:16px;}
.${uid}-card{display:grid;grid-template-columns:38px minmax(0,1fr);gap:14px;align-items:start;background:#f4f3ee;border-radius:8px;padding:18px 20px;box-sizing:border-box;}
.${uid}-icon{width:28px;height:28px;border-radius:6px;background:#0d2341;color:#fff;display:flex;align-items:center;justify-content:center;margin-top:1px;}
.${uid}-icon svg{width:15px;height:15px;display:block;}
.${uid}-card-title{font-size:14px;font-weight:700;color:#222;margin:0 0 4px;line-height:1.35;}
.${uid}-card-desc{line-height:1.55;margin:0;}
@media(max-width:900px){.${uid}-inner{display:flex!important;flex-direction:column!important;grid-template-columns:1fr!important;gap:28px;}.${uid}-left,.${uid}-right{width:100%!important;max-width:none!important;}.${uid}{padding:38px ${pR}px 38px ${pL}px;}}
@media(max-width:520px){.${uid}-title{font-size:24px;}.${uid}-card{grid-template-columns:34px minmax(0,1fr);padding:16px;}}
</style>`;
    const body = `<section class="${uid}">`
        + `<div class="${uid}-inner">`
        + `<div class="${uid}-left">`
        + (eyebrow.text ? `<div class="${uid}-ey" style="${textStyle(eyebrow)}">${escapeHtml(eyebrow.text)}</div>` : '')
        + (title.text ? `<h2 class="${uid}-title" style="${textStyle(title)}">${escapeHtml(title.text)}</h2>` : '')
        + paragraphsHtml
        + (ctaText.text ? `<a class="${uid}-cta" href="${escapeHtml(sec.ctaUrl || '#')}" style="${textStyle(ctaText)}">${escapeHtml(ctaText.text)}</a>` : '')
        + `</div>`
        + (cardsHtml ? `<div class="${uid}-right"><div class="${uid}-cards">${cardsHtml}</div></div>` : '')
        + `</div></section>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n${css}\n${body}`;
}
