import type { GradientBannerSection } from '../../types/cms';
import { escapeHtml, normalize, textStyle } from '../../utils/text';

function safeHex(value: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value! : fallback;
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value ?? fallback);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

function attr(value: string | undefined): string {
  return escapeHtml(value || '#');
}

export function generateGradientBannerHtml(section: GradientBannerSection): string {
  const uid = `gb${Date.now().toString(36)}`;
  const left = safeHex(section.gradientLeft, '#0d1f3c');
  const right = safeHex(section.gradientRight, '#1f6ab4');
  const padTop = clamp(section.padTop, 48, 0, 240);
  const padBot = clamp(section.padBot, 48, 0, 240);
  const padLeft = clamp(section.padLeft, 34, 0, 240);
  const padRight = clamp(section.padRight, 34, 0, 240);
  const eyebrow = normalize(section.eyebrow, 'gbEyebrow');
  const title = normalize(section.title, 'gbTitle');
  const desc = normalize(section.desc, 'gbDesc');
  const primary = normalize(section.primaryText, 'gbPrimary');
  const secondary = normalize(section.secondaryText, 'gbSecondary');
  const primaryBg = safeHex(section.primaryBg, '#ffffff');
  const secondaryBg = safeHex(section.secondaryBg, '#2d659b');
  const secondaryBorder = safeHex(section.secondaryBorder, '#5f91c5');

  return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
#${uid}{font-family:'Poppins',sans-serif;box-sizing:border-box;background:linear-gradient(112deg,${left} 0%,${left} 28%,${right} 100%);padding:${padTop}px ${padRight}px ${padBot}px ${padLeft}px;}
#${uid} *{box-sizing:border-box;}
#${uid} .${uid}-inner{display:flex;align-items:center;justify-content:space-between;gap:36px;width:100%;}
#${uid} .${uid}-copy{min-width:0;max-width:740px;}
#${uid} .${uid}-eyebrow{text-transform:uppercase;margin:0 0 12px;line-height:1.2;${textStyle(eyebrow)}}
#${uid} .${uid}-title{font-family:'Poppins',sans-serif;margin:0 0 12px;line-height:1.2;${textStyle(title)}}
#${uid} .${uid}-desc{font-family:'Poppins',sans-serif;margin:0;max-width:760px;line-height:1.65;${textStyle(desc)}}
#${uid} .${uid}-actions{width:184px;flex:0 0 184px;display:flex;flex-direction:column;gap:9px;}
#${uid} .${uid}-btn{display:flex;align-items:center;justify-content:center;min-height:40px;border-radius:7px;padding:10px 16px;text-align:center;text-decoration:none;line-height:1.2;font-family:'Poppins',sans-serif;}
@media(max-width:720px){#${uid}{padding:34px 22px!important;}#${uid} .${uid}-inner{align-items:stretch;flex-direction:column;gap:24px;}#${uid} .${uid}-actions{width:100%;flex-basis:auto;}#${uid} .${uid}-btn{width:100%;}}
</style>
<section id="${uid}">
  <div class="${uid}-inner">
    <div class="${uid}-copy">
${eyebrow.text ? `      <div class="${uid}-eyebrow">${escapeHtml(eyebrow.text)}</div>\n` : ''}${title.text ? `      <h2 class="${uid}-title">${escapeHtml(title.text)}</h2>\n` : ''}${desc.text ? `      <div class="${uid}-desc">${escapeHtml(desc.text)}</div>\n` : ''}    </div>
    <div class="${uid}-actions">
${primary.text ? `      <a class="${uid}-btn" href="${attr(section.primaryUrl)}" style="background:${primaryBg};${textStyle(primary)}">${escapeHtml(primary.text)}</a>\n` : ''}${secondary.text ? `      <a class="${uid}-btn" href="${attr(section.secondaryUrl)}" style="background:${secondaryBg};border:1px solid ${secondaryBorder};${textStyle(secondary)}">${escapeHtml(secondary.text)}</a>\n` : ''}    </div>
  </div>
</section>`;
}
