import { normalize, textStyle, escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function clamp(v, def, min, max) {
    const n = Number(v ?? def);
    return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}
function buildScrollScript(uid) {
    return `<script data-cfasync="false">(function(){`
        + `window[${JSON.stringify(uid + 'Scroll')}]=function(sel){`
        + `if(!sel)return false;`
        + `var el=null;`
        + `try{el=document.querySelector(sel);}catch(e){}`
        + `var clean=String(sel).replace(/^[#.]/,'').trim();`
        + `if(!el&&clean){`
        + `el=document.getElementById(clean)`
        + `||document.querySelector('[data-scroll-target="'+clean+'"]')`
        + `||document.querySelector('[data-vls-anchor="'+clean+'"]')`
        + `||document.querySelector('[name="'+clean+'"]');`
        + `if(!el){try{el=document.querySelector('.'+clean);}catch(e){}}`
        + `}`
        + `if(el&&el.scrollIntoView){el.scrollIntoView({behavior:'smooth',block:'start'});}`
        + `return false;};`
        + `})()\<\/script>`;
}
export function generateHeroV2Html(d) {
    const uid = 'h2-' + Date.now().toString(36);
    const bg = safeHex(d.bg, '#0d1f3c');
    const dot = safeHex(d.dotColor, '#4a90d9');
    const hlc = safeHex(d.hlColor, '#4a90d9');
    const tagBg = safeHex(d.tagBg, '#1e3550');
    const tagTc = safeHex(d.tagTc, '#94a3b8');
    const cardBg = safeHex(d.cardBg, '#1e3550');
    const lw = clamp(d.leftW, 55, 35, 70);
    const pT = clamp(d.padTop, 80, 0, 300);
    const pB = clamp(d.padBot, 80, 0, 300);
    const pL = clamp(d.padLeft, 60, 0, 300);
    const pR = clamp(d.padRight, 60, 0, 300);
    const ew = normalize(d.eyebrow, 'h2Eyebrow');
    const hw = normalize(d.heading, 'h2Heading');
    const hlw = normalize(d.highlight, 'h2Highlight');
    const bw = normalize(d.body, 'h2Body');
    const leftParts = [];
    // Eyebrow
    if (ew.text) {
        leftParts.push(`<p style="font-family:'Poppins',sans-serif;margin:0 0 16px;${textStyle(ew)}display:flex;align-items:center;gap:6px;">`
            + `<span style="width:7px;height:7px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0;"></span>`
            + escapeHtml(ew.text) + `</p>`);
    }
    // Heading + highlight (last line gets the highlight appended)
    const headingLines = (hw.text || '').split('\n').map(l => escapeHtml(l));
    const lastLine = headingLines.pop() ?? '';
    let headingHtml = headingLines.join('<br>') + (headingLines.length ? '<br>' : '') + lastLine;
    if (hlw.text)
        headingHtml += ` <span style="color:${hlc};">${escapeHtml(hlw.text)}</span>`;
    leftParts.push(`<h1 style="font-family:'Poppins',sans-serif;margin:0 0 20px;line-height:1.15;${textStyle(hw)}">${headingHtml}</h1>`);
    // Body (raw HTML allowed — multiline field)
    if (bw.text) {
        leftParts.push(`<p style="font-family:'Poppins',sans-serif;margin:0 0 24px;line-height:1.7;${textStyle(bw)}">${bw.text}</p>`);
    }
    // Tags
    const tags = d.tags ?? [];
    if (tags.length) {
        const tagItems = tags.map(t => `<span style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:500;padding:5px 14px;border-radius:999px;background:${tagBg};color:${tagTc};white-space:nowrap;">${escapeHtml(t)}</span>`).join('\n    ');
        leftParts.push(`<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px;">\n    ${tagItems}\n  </div>`);
    }
    // CTAs
    const ctas = d.ctas ?? [];
    if (ctas.length) {
        const ctaItems = ctas.map(c => {
            const btnStyle = c.style === 'outlined'
                ? `background:transparent;border:1.5px solid ${safeHex(c.bc, '#ffffff')};`
                : `background:${safeHex(c.bg, '#1e3a5f')};border:1.5px solid ${safeHex(c.bg, '#1e3a5f')};`;
            const scrollAttr = c.scroll
                ? ` onclick="return window[${JSON.stringify(uid + 'Scroll').replace(/"/g, '&quot;')}](${JSON.stringify(c.scroll).replace(/"/g, '&quot;')})"`
                : '';
            const href = c.scroll ? '#' : (c.url || '#');
            return `<a href="${escapeHtml(href)}"${scrollAttr} style="font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;color:${safeHex(c.tc, '#ffffff')};text-decoration:none;padding:12px 24px;border-radius:8px;${btnStyle}display:inline-block;white-space:nowrap;">${escapeHtml(c.text || '')}</a>`;
        }).join('\n    ');
        leftParts.push(`<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:36px;">\n    ${ctaItems}\n  </div>`);
    }
    // Stats
    const stats = d.stats ?? [];
    if (stats.length) {
        const statItems = stats.map(s => `<div>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:28px;font-weight:700;color:#ffffff;margin:0 0 4px;">${escapeHtml(s.value || '')}</p>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0;">${escapeHtml(s.label || '')}</p>`
            + `</div>`).join('');
        leftParts.push(`<div style="display:flex;flex-wrap:wrap;gap:28px;">${statItems}</div>`);
    }
    // Right column: rcards
    const rcards = d.rcards ?? [];
    const rCardsHtml = rcards.map(r => {
        const ibg = safeHex(r.iconBg, '#1a56a3');
        return `<a href="${escapeHtml(r.url || '#')}" style="display:flex;align-items:center;gap:14px;background:${cardBg};border-radius:10px;padding:14px 18px;text-decoration:none;border:1px solid rgba(255,255,255,0.06);">`
            + `<div style="width:44px;height:44px;min-width:44px;border-radius:10px;background:${ibg};display:flex;align-items:center;justify-content:center;font-size:22px;">${escapeHtml(r.icon || '📚')}</div>`
            + `<div style="flex:1;min-width:0;">`
            + `<p style="font-family:'Poppins',sans-serif;font-weight:700;font-size:14px;color:#ffffff;margin:0 0 3px;">${escapeHtml(r.title || '')}</p>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:12px;color:#64748b;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(r.subtitle || '')}</p>`
            + `</div>`
            + (r.count ? `<span style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.12);border-radius:999px;padding:3px 10px;white-space:nowrap;">${escapeHtml(r.count)}</span>` : '')
            + `<span style="color:#64748b;font-size:16px;margin-left:4px;">›</span>`
            + `</a>`;
    }).join('\n    ');
    const css = `<style>`
        + `#${uid}{font-family:'Poppins',sans-serif;}`
        + `#${uid} *{box-sizing:border-box;}`
        + `#${uid} .h2-body{display:flex;flex-wrap:wrap;gap:40px;align-items:center;}`
        + `#${uid} .h2-left{flex:0 0 ${lw}%;min-width:280px;}`
        + `#${uid} .h2-right{flex:1;min-width:260px;display:flex;flex-direction:column;gap:10px;}`
        + `@media(max-width:768px){`
        + `#${uid} .h2-left{flex:none;width:100%;}`
        + `#${uid} .h2-right{width:100%;}`
        + `}`
        + `</style>`;
    return css + '\n'
        + `<div id="${uid}" style="background:${bg};padding:${pT}px ${pR}px ${pB}px ${pL}px;">`
        + `<div class="h2-body">`
        + `<div class="h2-left">${leftParts.join('\n')}</div>`
        + `<div class="h2-right">\n    ${rCardsHtml}\n  </div>`
        + `</div>`
        + `</div>\n`
        + buildScrollScript(uid);
}
