import type { FcState } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

function clamp(v: number | undefined, def: number, min: number, max: number): number {
  const n = Number(v ?? def);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}

export function generateFeatureCardsHtml(data: FcState): string {
  const uid      = 'fc' + Date.now().toString(36);
  const eyebrow  = normalize(data.eyebrow, 'featureEyebrow');
  const title    = normalize(data.title,   'featureTitle');
  const desc     = normalize(data.desc,    'featureSection');
  const padLeft  = clamp(data.padLeft,  0, 0, 200);
  const padRight = clamp(data.padRight, 0, 0, 200);

  const cardsHtml = (data.cards || []).map(card => {
    const cEy  = normalize(card.eyebrow,  'featureCardEyebrow');
    const cTi  = normalize(card.title,    'featureCardTitle');
    const cSu  = normalize(card.subtitle, 'featureCardSubtitle');
    const cCta = normalize(card.ctaText,  'featureCardCta');
    return `<div class="${uid}-card">`
      + `<div class="${uid}-top" style="background:${escapeHtml(card.color || '#204280')}">`
      + (cEy.text ? `<span class="${uid}-badge" style="${textStyle(cEy)}">${escapeHtml(cEy.text)}</span>` : '')
      + `</div>`
      + `<div class="${uid}-body">`
      + `<h3 class="${uid}-ti" style="${textStyle(cTi)}">${escapeHtml(cTi.text || '')}</h3>`
      + (cSu.text ? `<p class="${uid}-su" style="${textStyle(cSu)}">${escapeHtml(cSu.text)}</p>` : '')
      + (cCta.text ? `<a href="${escapeHtml(card.ctaUrl || '#')}" class="${uid}-cta" style="${textStyle(cCta)}">${escapeHtml(cCta.text)}</a>` : '')
      + `</div></div>`;
  }).join('\n');

  const css = `<style>`
    + `.${uid}{font-family:'Poppins',sans-serif;padding:0 ${padRight}px 0 ${padLeft}px;box-sizing:border-box;}`
    + `.${uid}-ey{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#204280;margin-bottom:12px;}`
    + `.${uid}-stitle{font-size:32px;font-weight:700;color:#1a1a1a;margin:0 0 12px;line-height:1.2;}`
    + `.${uid}-desc{margin:0 0 32px;line-height:1.7;}`
    + `.${uid}-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}`
    + `@media(max-width:900px){.${uid}-grid{grid-template-columns:repeat(2,1fr);}}`
    + `@media(max-width:600px){.${uid}-grid{grid-template-columns:1fr;}}`
    + `.${uid}-card{border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;}`
    + `.${uid}-top{height:180px;padding:16px;display:flex;align-items:flex-end;}`
    + `.${uid}-badge{display:inline-block;padding:5px 14px;background:rgba(255,255,255,0.2);border-radius:999px;font-size:12px;font-weight:600;color:#fff !important;letter-spacing:.04em;}`
    + `.${uid}-body{padding:20px;}`
    + `.${uid}-ti{font-size:16px;font-weight:700;color:#1a1a1a;margin:0 0 6px;line-height:1.35;}`
    + `.${uid}-su{font-size:13px;color:#6b7280;margin:0 0 16px;font-weight:400;}`
    + `.${uid}-cta{font-size:13px;font-weight:600;color:#204280 !important;text-decoration:none !important;}`
    + `.${uid}-cta:hover{text-decoration:underline !important;}`
    + `</style>`;

  const body = `<div class="${uid}">`
    + (eyebrow.text ? `<div class="${uid}-ey" style="${textStyle(eyebrow)}">${escapeHtml(eyebrow.text)}</div>` : '')
    + (title.text ? `<h2 class="${uid}-stitle" style="${textStyle(title)}">${escapeHtml(title.text)}</h2>` : '')
    + (desc.text ? `<p class="${uid}-desc" style="${textStyle(desc)}">${escapeHtml(desc.text)}</p>` : '')
    + (cardsHtml ? `<div class="${uid}-grid">${cardsHtml}</div>` : '')
    + `</div>`;

  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n`
    + css + '\n' + body;
}
