import { normalize, textStyle, escapeHtml } from '../../utils/text';
export function generateCfHtml(d) {
    const uid = 'cf-' + Date.now().toString(36);
    const pT = Math.min(200, Math.max(0, d.padTop ?? 24));
    const pB = Math.min(200, Math.max(0, d.padBot ?? 24));
    const pL = Math.min(300, Math.max(0, d.padLeft ?? 48));
    const pR = Math.min(300, Math.max(0, d.padRight ?? 48));
    const lw = Math.min(70, Math.max(30, d.leftWidth ?? 55));
    const rw = 100 - lw;
    const bg = d.bg || '#ffffff';
    const bdr = d.border || '#e5e7eb';
    const lbl = normalize(d.label, 'cfLabel');
    const company = normalize(d.company, 'cfCompany');
    const addr = normalize(d.address, 'cfAddress');
    let leftHtml = '';
    if (lbl.text)
        leftHtml += `<p style="font-family:'Poppins',sans-serif;margin:0 0 8px;text-transform:uppercase;${textStyle(lbl)}">${escapeHtml(lbl.text)}</p>`;
    if (company.text)
        leftHtml += `<h3 style="font-family:'Poppins',sans-serif;margin:0 0 6px;${textStyle(company)}">${escapeHtml(company.text)}</h3>`;
    if (addr.text)
        leftHtml += `<p style="font-family:'Poppins',sans-serif;margin:0;line-height:1.5;${textStyle(addr)}">${addr.text}</p>`;
    const itemsHtml = (d.items || []).map(item => {
        const title = normalize(item.title, 'cfItemTitle');
        const value = normalize(item.value, 'cfItemValue');
        const ibg = item.iconBg || '#1e3a5f';
        const valHtml = value.text
            ? (item.href
                ? `<a href="${escapeHtml(item.href)}" style="font-family:'Poppins',sans-serif;text-decoration:none;${textStyle(value)}">${escapeHtml(value.text)}</a>`
                : `<span style="font-family:'Poppins',sans-serif;${textStyle(value)}">${escapeHtml(value.text)}</span>`)
            : '';
        return `<div style="display:flex;align-items:center;gap:12px;">`
            + `<div style="width:36px;height:36px;min-width:36px;border-radius:8px;background:${escapeHtml(ibg)};display:flex;align-items:center;justify-content:center;font-size:17px;line-height:1;">${escapeHtml(item.icon || '📌')}</div>`
            + `<div>`
            + (title.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 1px;${textStyle(title)}">${escapeHtml(title.text)}</p>` : '')
            + (valHtml ? `<p style="margin:0;">${valHtml}</p>` : '')
            + `</div></div>`;
    }).join('\n');
    const rightHtml = `<div style="display:flex;flex-direction:column;gap:14px;">${itemsHtml}</div>`;
    return [
        `<div class="${uid}" style="background:${escapeHtml(bg)};border-top:1px solid ${escapeHtml(bdr)};padding:${pT}px ${pR}px ${pB}px ${pL}px;box-sizing:border-box;">`,
        `  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:24px;">`,
        `    <div style="flex:0 0 ${lw}%;min-width:220px;">${leftHtml}</div>`,
        `    <div style="flex:0 0 ${rw}%;min-width:200px;">${rightHtml}</div>`,
        `  </div>`,
        `</div>`,
    ].join('\n');
}
