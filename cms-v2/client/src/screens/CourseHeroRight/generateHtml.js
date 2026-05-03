import { normalize, textStyle, escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
export function generateCourseHeroRightHtml(d) {
    const uid = 'chr-' + Date.now().toString(36);
    const bg = safeHex(d.bg, '#ffffff');
    const border = safeHex(d.border, '#e2e8f0');
    const divider = safeHex(d.divider, '#f1f5f9');
    const iconBg = safeHex(d.iconBg, '#f0f4ff');
    const badgeBg = safeHex(d.badgeBg, '#e2e8f0');
    const badgeTc = safeHex(d.badgeTc, '#374151');
    const ctaBg = safeHex(d.ctaBg, '#0f172a');
    const ctaTc = safeHex(d.ctaTc, '#ffffff');
    const radius = clamp(d.radius, 12, 0, 40);
    const ctaR = clamp(d.ctaRadius, 8, 0, 40);
    const pT = clamp(d.padTop, 24, 0, 200);
    const pB = clamp(d.padBot, 24, 0, 200);
    const pL = clamp(d.padLeft, 24, 0, 200);
    const pR = clamp(d.padRight, 24, 0, 200);
    const parts = [];
    if (d.labelText) {
        parts.push(`<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6b7280;margin:0 0 16px;">${escapeHtml(d.labelText)}</p>`);
    }
    const validItems = (d.items ?? []).filter(item => {
        const t = normalize(item.title, 'chrItemTitle');
        return t.text;
    });
    validItems.forEach((item, i) => {
        const titleD = normalize(item.title, 'chrItemTitle');
        const descD = normalize(item.desc, 'chrItemDesc');
        const isUrl = item.icon && (item.icon.startsWith('http') || item.icon.startsWith('/'));
        const iconHtml = isUrl
            ? `<img src="${escapeHtml(item.icon)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:6px;display:block;">`
            : `<span style="font-size:20px;line-height:1;">${escapeHtml(item.icon || '')}</span>`;
        parts.push(`<div style="display:flex;align-items:flex-start;gap:14px;padding:14px 0;${i > 0 ? `border-top:1px solid ${divider};` : ''}">`
            + `<div style="width:44px;height:44px;flex-shrink:0;background:${iconBg};border-radius:8px;display:flex;align-items:center;justify-content:center;">${iconHtml}</div>`
            + `<div style="flex:1;min-width:0;">`
            + `<p style="font-family:'Poppins',sans-serif;margin:0 0 2px;${textStyle(titleD)}">${escapeHtml(titleD.text)}</p>`
            + (descD.text ? `<p style="font-family:'Poppins',sans-serif;margin:0${item.badge ? ' 0 6px' : ''};line-height:1.5;${textStyle(descD)}">${escapeHtml(descD.text)}</p>` : '')
            + (item.badge ? `<span style="display:inline-block;font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:${badgeTc};background:${badgeBg};border-radius:999px;padding:2px 10px;">${escapeHtml(item.badge)}</span>` : '')
            + `</div></div>`);
    });
    if (d.ctaText) {
        parts.push(`<div style="margin-top:16px;">`
            + `<a href="${escapeHtml(d.ctaUrl || '#')}" style="display:block;text-align:center;font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;color:${ctaTc};background:${ctaBg};border-radius:${ctaR}px;padding:14px 24px;text-decoration:none;">`
            + escapeHtml(d.ctaText)
            + `</a></div>`);
    }
    const css = `<style>
#${uid}{font-family:'Poppins',sans-serif;box-sizing:border-box;max-width:100%;overflow-x:hidden;}
#${uid} *{box-sizing:border-box;word-break:break-word;overflow-wrap:break-word;}
</style>`;
    return css + `\n<div id="${uid}" style="background:${bg};border:1px solid ${border};border-radius:${radius}px;padding:${pT}px ${pR}px ${pB}px ${pL}px;">`
        + '\n' + parts.join('\n') + '\n</div>';
}
