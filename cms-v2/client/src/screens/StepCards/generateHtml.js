import { normalize, textStyle, escapeHtml } from '../../utils/text';
export function generateStepCardsHtml(data) {
    const uid = 'ss' + Date.now().toString(36);
    const cols = Math.max(1, Math.min(6, data.cols || 4));
    const tabletCols = Math.min(cols, 2);
    const padLeft = Math.max(0, Math.min(200, data.padLeft ?? 32));
    const padRight = Math.max(0, Math.min(200, data.padRight ?? 32));
    const eyebrow = normalize(data.eyebrow, 'stepsEyebrow');
    const title = normalize(data.title, 'stepsTitle');
    const desc = normalize(data.desc, 'stepsSection');
    const cardsHtml = (data.cards || []).map((card, i) => {
        const cardTitle = normalize(card.title, 'stepsCardTitle');
        const cardDesc = normalize(card.desc, 'stepsCard');
        return `<div class="${uid}-card">`
            + `<div class="${uid}-num">${i + 1}</div>`
            + (cardTitle.text ? `<h3 class="${uid}-ctitle" style="${textStyle(cardTitle)}">${escapeHtml(cardTitle.text)}</h3>` : '')
            + (cardDesc.text ? `<p class="${uid}-cdesc" style="${textStyle(cardDesc)}">${escapeHtml(cardDesc.text)}</p>` : '')
            + `</div>`;
    }).join('\n');
    const css = `<style>`
        + `.${uid}{font-family:'Poppins',sans-serif;background-color:${escapeHtml(data.bg || '#f7f6f1')};padding:48px ${padRight}px 48px ${padLeft}px;box-sizing:border-box;}`
        + `.${uid}-inner{max-width:1100px;margin:0 auto;}`
        + `.${uid}-ey{font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#204280;margin:0 0 10px;}`
        + `.${uid}-title{font-size:26px;font-weight:600;color:#1a1a1a;margin:0 0 8px;line-height:1.25;}`
        + `.${uid}-desc{margin:0 0 28px;line-height:1.6;}`
        + `.${uid}-grid{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:14px;}`
        + `.${uid}-card{background:rgba(255,255,255,.54);border-radius:6px;padding:16px 16px 18px;min-height:142px;box-sizing:border-box;}`
        + `.${uid}-num{width:28px;height:28px;border-radius:999px;background:#0f1f3a;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;margin:0 0 10px;}`
        + `.${uid}-ctitle{font-size:14px;font-weight:600;color:#202124;margin:0 0 6px;line-height:1.35;}`
        + `.${uid}-cdesc{margin:0;line-height:1.55;}`
        + `@media(max-width:900px){.${uid}-grid{grid-template-columns:repeat(${tabletCols},minmax(0,1fr));}}`
        + `@media(max-width:640px){.${uid}{padding:36px ${padRight}px 36px ${padLeft}px;}.${uid}-title{font-size:24px;}.${uid}-grid{grid-template-columns:1fr;}}`
        + `</style>`;
    const body = `<section class="${uid}">`
        + `<div class="${uid}-inner">`
        + (eyebrow.text ? `<div class="${uid}-ey" style="${textStyle(eyebrow)}">${escapeHtml(eyebrow.text)}</div>` : '')
        + (title.text ? `<h2 class="${uid}-title" style="${textStyle(title)}">${escapeHtml(title.text)}</h2>` : '')
        + (desc.text ? `<p class="${uid}-desc" style="${textStyle(desc)}">${escapeHtml(desc.text)}</p>` : '')
        + (cardsHtml ? `<div class="${uid}-grid">${cardsHtml}</div>` : '')
        + `</div>`
        + `</section>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n${css}\n${body}`;
}
