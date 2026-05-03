import { normalize, textStyle, escapeHtml } from '../../utils/text';
export function generateBannerHtml(b, deadlineMs) {
    const bg = b.bg || '#204280';
    const fg = b.fg || '#ffffff';
    const btnBg = b.btnBg || '#e63946';
    const title = normalize(b.title, 'bannerTitle');
    const subtitle = normalize(b.sub, 'bannerSubtitle');
    const ctaText = normalize(b.ctaText, 'bannerCta');
    const pL = Math.min(200, Math.max(0, b.padLeft ?? 24));
    const pR = Math.min(200, Math.max(0, b.padRight ?? 24));
    const r = Math.max(0, deadlineMs - Date.now());
    const pad = (n) => String(n).padStart(2, '0');
    const d = Math.floor(r / 86400000);
    const h = Math.floor((r % 86400000) / 3600000);
    const m = Math.floor((r % 3600000) / 60000);
    const s = Math.floor((r % 60000) / 1000);
    const us = `display:flex;flex-direction:column;align-items:center;gap:2px;`;
    const ns = `font-size:20px;font-weight:700;line-height:1;font-family:'Poppins',sans-serif;color:${fg};`;
    const ls = `font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;opacity:0.75;font-family:'Poppins',sans-serif;color:${fg};`;
    const ss = `font-size:24px;font-weight:700;line-height:1;padding:0 4px;margin-top:-4px;color:${fg};opacity:0.6;`;
    let html = `<style>
@media(max-width:600px){
.vls-bnp-wrap{flex-direction:column!important;padding-top:12px!important;padding-bottom:12px!important;}
.vls-bnp-text{width:100%!important;flex:none!important;}
.vls-bnp-right{width:100%!important;align-items:center!important;margin-top:10px!important;}
.vls-bnp-cta{display:none!important;}
}
</style>`;
    html += `<div style="background:${bg};padding:10px ${pR}px 10px ${pL}px;">`;
    html += `<div class="vls-bnp-wrap" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">`;
    html += `<div class="vls-bnp-text" style="flex:1;min-width:0;">`;
    if (title.text)
        html += `<div style="font-family:'Poppins',sans-serif;line-height:1.3;${textStyle(title)}">${escapeHtml(title.text)}</div>`;
    if (subtitle.text)
        html += `<div style="font-family:'Poppins',sans-serif;opacity:0.8;margin-top:3px;${textStyle(subtitle)}">${escapeHtml(subtitle.text)}</div>`;
    html += `</div>`;
    html += `<div class="vls-bnp-right" style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0;">`;
    html += `<div style="display:flex;align-items:center;gap:6px;">`;
    html += `<div style="${us}"><span style="${ns}">${pad(d)}</span><span style="${ls}">Days</span></div>`;
    html += `<span style="${ss}">:</span>`;
    html += `<div style="${us}"><span style="${ns}">${pad(h)}</span><span style="${ls}">Hours</span></div>`;
    html += `<span style="${ss}">:</span>`;
    html += `<div style="${us}"><span style="${ns}">${pad(m)}</span><span style="${ls}">Mins</span></div>`;
    html += `<span style="${ss}">:</span>`;
    html += `<div style="${us}"><span style="${ns}">${pad(s)}</span><span style="${ls}">Secs</span></div>`;
    html += `</div>`;
    if (ctaText.text) {
        html += `<div class="vls-bnp-cta"><a href="${escapeHtml(b.ctaUrl || '#')}" style="display:inline-block;padding:8px 20px;background:${btnBg};border-radius:6px;text-decoration:none;white-space:nowrap;${textStyle(ctaText)}">${escapeHtml(ctaText.text)}</a></div>`;
    }
    html += `</div></div></div>`;
    return html;
}
