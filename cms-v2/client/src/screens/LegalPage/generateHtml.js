import { escapeHtml as xH } from '../../utils/text';
const xA = xH;
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{3,8}$/.test(v || '') ? v : fallback;
}
function polGridHtml(cols, gap, itemsHtml) {
    const n = parseInt(String(cols)) || 2;
    const gid = 'pg' + Math.random().toString(36).slice(2, 9);
    const css = `<style>.${gid}{display:grid;grid-template-columns:repeat(${n},1fr);gap:${gap || '16px'};margin:0 0 16px;box-sizing:border-box;}.${gid}>*{width:100%;min-width:0;box-sizing:border-box;}@media(max-width:600px){.${gid}{grid-template-columns:1fr!important;}}</style>`;
    return css + `<div class="${gid}">${itemsHtml}</div>`;
}
function polBuildBlock(b, accent) {
    if (!b || !b.type)
        return '';
    const acc = accent || '#1a56a3';
    if (b.type === 'paragraph') {
        return `<p style="font-family:'Poppins',sans-serif;font-size:15px;color:#374151;line-height:1.7;margin:0 0 16px;">${xH(b.text || '')}</p>`;
    }
    if (b.type === 'bullets') {
        const items = (b.items || []).map(String).filter(t => t.trim());
        if (!items.length)
            return '';
        return '<ul style="margin:0 0 16px;padding:0;list-style:none;">'
            + items.map(t => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px;font-family:'Poppins',sans-serif;font-size:15px;color:#374151;line-height:1.6;">`
                + `<span style="color:${xA(acc)};font-size:18px;line-height:1.4;flex-shrink:0;margin-top:1px;">&#8226;</span>`
                + `<span>${xH(t)}</span></li>`).join('')
            + '</ul>';
    }
    if (b.type === 'table') {
        const headers = String(b.headers || '').split('|').map(h => h.trim()).filter(Boolean);
        if (!headers.length)
            return '';
        const dataRows = String(b.rows || '').split(/\r?\n/).filter(r => r.trim()).map(r => r.split('|').map(c => c.trim()));
        const headHtml = headers.map(h => `<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#ffffff;font-family:'Poppins',sans-serif;white-space:nowrap;">${xH(h)}</th>`).join('');
        const bodyHtml = dataRows.map((row, ri) => {
            const cells = headers.map((_, ci) => `<td style="padding:12px 14px;font-size:14px;color:#374151;font-family:'Poppins',sans-serif;border-bottom:1px solid #e5e7eb;">${xH(row[ci] || '')}</td>`).join('');
            return `<tr${ri % 2 === 1 ? ' style="background:#f9fafb;"' : ''}>${cells}</tr>`;
        }).join('');
        return `<div style="overflow-x:auto;margin:0 0 16px;"><table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;"><thead><tr style="background:${xA(acc)};">${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
    }
    if (b.type === 'cards') {
        const items = (b.items || []).filter((c) => c.label || c.text);
        if (!items.length)
            return '';
        const cardHtml = items.map((c) => `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;">`
            + (c.label ? `<p style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:${xA(acc)};margin:0 0 8px;">${xH(c.label)}</p>` : '')
            + `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:#374151;line-height:1.5;margin:0;">${xH(c.text || '')}</p>`
            + `</div>`).join('');
        return polGridHtml(b.cols || 2, '12px', cardHtml);
    }
    if (b.type === 'rights') {
        const items = (b.items || []).filter((r) => r.title || r.text);
        if (!items.length)
            return '';
        const rightHtml = items.map((r) => `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:18px;">`
            + `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">`
            + `<span style="font-size:22px;line-height:1;">${xH(r.icon || '📋')}</span>`
            + `<p style="font-family:'Poppins',sans-serif;font-weight:700;font-size:15px;color:#1a1a1a;margin:0;">${xH(r.title || '')}</p>`
            + `</div>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:13px;color:#6b7280;line-height:1.5;margin:0;">${xH(r.text || '')}</p>`
            + `</div>`).join('');
        return polGridHtml(b.cols || 2, '12px', rightHtml);
    }
    if (b.type === 'tags') {
        const items = (b.items || []).map(String).filter(t => t.trim());
        if (!items.length)
            return '';
        const tagItems = items.map(t => `<span style="font-family:'Poppins',sans-serif;font-size:13px;color:#374151;padding:6px 16px;border:1px solid #e5e7eb;border-radius:6px;display:inline-block;">${xH(t)}</span>`).join('');
        return polGridHtml(b.cols || 4, '8px', tagItems);
    }
    if (b.type === 'definitions') {
        const items = (b.items || []).filter((d) => d.term || d.desc);
        if (!items.length)
            return '';
        return '<ul style="margin:0 0 16px;padding:0;list-style:none;">'
            + items.map((d) => `<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-family:'Poppins',sans-serif;font-size:15px;color:#374151;line-height:1.6;">`
                + `<span style="color:${xA(acc)};font-size:18px;line-height:1.4;flex-shrink:0;margin-top:1px;">&#8226;</span>`
                + `<span><strong style="color:#1a1a1a;">${xH(d.term)}</strong>${d.desc ? ' &#8212; ' + xH(d.desc) : ''}</span></li>`).join('')
            + '</ul>';
    }
    if (b.type === 'alpha-list') {
        const items = (b.items || []).map(String).filter(t => t.trim());
        if (!items.length)
            return '';
        return '<ul style="margin:0 0 16px;padding:0;list-style:none;display:flex;flex-direction:column;gap:10px;">'
            + items.map((t, i) => {
                const letter = String.fromCharCode(65 + i);
                return `<li style="display:flex;align-items:flex-start;gap:14px;">`
                    + `<span style="width:32px;height:32px;min-width:32px;border-radius:7px;background:${xA(acc)};color:#fff;font-size:13px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;margin-top:1px;">${letter}</span>`
                    + `<div style="background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;flex:1;font-family:'Poppins',sans-serif;font-size:14px;color:#374151;line-height:1.5;">${xH(t)}</div>`
                    + `</li>`;
            }).join('')
            + '</ul>';
    }
    if (b.type === 'icon-cards') {
        const items = (b.items || []).filter((c) => c.title || c.desc);
        if (!items.length)
            return '';
        const icHtml = items.map((c) => {
            const ibg = safeHex(c.iconBg, '#fef3c7');
            return `<div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;background:#ffffff;">`
                + `<span style="display:inline-flex;align-items:center;justify-content:center;width:48px;height:48px;border-radius:10px;background:${xA(ibg)};font-size:26px;line-height:1;margin-bottom:14px;">${xH(c.icon || '🔑')}</span>`
                + `<p style="font-family:'Poppins',sans-serif;font-weight:700;font-size:15px;color:#1a1a1a;margin:0 0 8px;line-height:1.3;">${xH(c.title || '')}</p>`
                + `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:#6b7280;margin:0;line-height:1.6;">${xH(c.desc || '')}</p>`
                + `</div>`;
        }).join('');
        return polGridHtml(b.cols || 2, '16px', icHtml);
    }
    if (b.type === 'link-cards') {
        const items = (b.items || []).filter((c) => c.title || c.desc);
        if (!items.length)
            return '';
        const lcHtml = items.map((c) => `<div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px 18px;display:flex;align-items:flex-start;gap:14px;">`
            + `<span style="font-size:26px;line-height:1;flex-shrink:0;margin-top:2px;">${xH(c.icon || '📄')}</span>`
            + `<div style="flex:1;min-width:0;">`
            + `<p style="font-family:'Poppins',sans-serif;font-weight:700;font-size:15px;color:#1a1a1a;margin:0 0 4px;">${xH(c.title || '')}</p>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:13px;color:#6b7280;margin:0 0 8px;line-height:1.4;">${xH(c.desc || '')}</p>`
            + (c.url ? `<a href="${xA(c.url)}" style="font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;color:${xA(acc)};text-decoration:none;">${xH(c.linkText || 'Read →')}</a>` : '')
            + `</div></div>`).join('');
        return polGridHtml(b.cols || 2, '12px', lcHtml);
    }
    if (b.type === 'cta-banner') {
        const cbg = safeHex(b.bg, '#0d1f3c');
        const ctc = safeHex(b.titleColor, '#ffffff');
        const cdc = safeHex(b.descColor, '#94a3b8');
        const cbtbg = safeHex(b.btnBg, '#1a56a3');
        const cbtc = safeHex(b.btnColor, '#ffffff');
        return `<div style="background:${xA(cbg)};border-radius:10px;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;margin:0 0 16px;">`
            + `<div style="flex:1;min-width:180px;">`
            + (b.title ? `<p style="font-family:'Poppins',sans-serif;font-weight:700;font-size:16px;color:${xA(ctc)};margin:0 0 5px;">${xH(b.title)}</p>` : '')
            + (b.desc ? `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:${xA(cdc)};margin:0;line-height:1.5;">${xH(b.desc)}</p>` : '')
            + `</div>`
            + (b.btnText ? `<a href="${xA(b.btnUrl || '#')}" style="flex-shrink:0;display:inline-block;background:${xA(cbtbg)};color:${xA(cbtc)};font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:8px;white-space:nowrap;">${xH(b.btnText)}</a>` : '')
            + `</div>`;
    }
    if (b.type === 'callout') {
        const cbg = safeHex(b.bg, '#fff7ed');
        const ccol = safeHex(b.color, '#b45309');
        return `<div style="background:${xA(cbg)};border:1px solid ${xA(ccol)}33;border-radius:10px;padding:16px 20px;margin:0 0 16px;display:flex;align-items:flex-start;gap:14px;">`
            + `<span style="font-size:22px;line-height:1;flex-shrink:0;margin-top:1px;">${xH(b.icon || '⚠️')}</span>`
            + `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:${xA(ccol)};line-height:1.6;margin:0;">${xH(b.text || '')}</p>`
            + `</div>`;
    }
    return '';
}
export function generateLegalPageHtml(data) {
    const uid = 'pol' + Date.now().toString(36);
    const hdrBg = safeHex(data.hdrBg, '#0d1f3c');
    const navBg = safeHex(data.navBg, '#f8fafc');
    const accent = safeHex(data.accent, '#1a56a3');
    const navW = Math.min(340, Math.max(140, Number(data.navWidth) || 220));
    const metaDots = (data.meta || []).map(m => `<span style="font-family:'Poppins',sans-serif;font-size:13px;color:#94a3b8;">&#8226; ${xH(m)}</span>`).join(' ');
    const headerHtml = `<div class="${uid}-header" style="background:${xA(hdrBg)};">`
        + (data.eyebrow ? `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;text-transform:uppercase;color:${xA(accent)};letter-spacing:0.12em;margin:0 0 10px;">${xH(data.eyebrow)}</p>` : '')
        + `<h1 style="font-family:'Poppins',sans-serif;font-size:36px;font-weight:700;color:#ffffff;margin:0 0 14px;">${xH(data.title || '')}</h1>`
        + (metaDots ? `<div style="display:flex;flex-wrap:wrap;gap:14px;">${metaDots}</div>` : '')
        + `</div>`;
    const navItems = (data.sections || []).map((sec, i) => {
        const n = i + 1;
        return `<li style="list-style:none;">`
            + `<a href="#${uid}-s${n}" id="${uid}-nav${n}" data-section="${n}" class="${uid}-navlink"`
            + ` style="display:flex;align-items:center;gap:10px;padding:8px 20px;text-decoration:none;color:#374151;font-size:13px;font-family:'Poppins',sans-serif;transition:background 0.15s;">`
            + `<span class="${uid}-navnum" style="width:22px;height:22px;min-width:22px;border-radius:50%;background:${xA(accent)};color:#fff;font-size:11px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;">${n}</span>`
            + `${xH(sec.title)}</a></li>`;
    }).join('');
    const navHtml = `<div class="${uid}-nav" style="width:${navW}px;background:${xA(navBg)};">`
        + `<p class="${uid}-navtitle" style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#94a3b8;padding:20px 20px 10px;margin:0;">CONTENTS</p>`
        + `<ul class="${uid}-navlist" style="padding:0;margin:0;">${navItems}</ul>`
        + `</div>`;
    const sectionsHtml = (data.sections || []).map((sec, i) => {
        const n = i + 1;
        const secBg = safeHex(sec.bg, '#ffffff');
        const blocksHtml = (sec.blocks || []).map(b => polBuildBlock(b, accent)).join('');
        return `<div id="${uid}-s${n}" class="${uid}-section" data-section="${n}" tabindex="-1" style="background:${xA(secBg)};border-bottom:1px solid #e5e7eb;">`
            + `<div style="padding:40px 48px;">`
            + `<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">`
            + `<span style="width:36px;height:36px;min-width:36px;border-radius:8px;background:${xA(hdrBg)};color:#fff;font-size:16px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;">${n}</span>`
            + `<h2 style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;color:#1a1a1a;margin:0;">${xH(sec.title)}</h2>`
            + `</div>${blocksHtml}</div></div>`;
    }).join('');
    const styleHtml = `<style>`
        + `#${uid}{font-family:Poppins,sans-serif;max-width:100%;box-sizing:border-box;}`
        + `#${uid} *,#${uid} *:before,#${uid} *:after{box-sizing:border-box;}`
        + `.${uid}-header{padding:40px 48px;}`
        + `.${uid}-layout{display:flex;align-items:flex-start;}`
        + `.${uid}-nav{flex-shrink:0;position:sticky;top:0;min-height:100vh;max-height:100vh;overflow-y:auto;border-right:1px solid #e5e7eb;}`
        + `.${uid}-navlist{padding:0;margin:0;}`
        + `.${uid}-navlink.${uid}-navlink-active{background:#e8f0fe;color:${xA(accent)};}`
        + `.${uid}-content{flex:1;min-width:0;}`
        + `.${uid}-section{scroll-margin-top:84px;}`
        + `.${uid}-section.${uid}-section-focus{box-shadow:inset 4px 0 0 ${xA(accent)};}`
        + `@media(max-width:767px){`
        + `.${uid}-layout{display:block;}`
        + `.${uid}-nav{width:100%!important;position:static;top:auto;max-height:none;overflow:visible;border-right:none;border-bottom:1px solid #e5e7eb;}`
        + `.${uid}-header{padding:28px 20px;}`
        + `.${uid}-section div{padding:28px 20px!important;}`
        + `.${uid}-navlink{padding:10px 20px;}`
        + `}</style>`;
    const scrollScript = `<script data-cfasync="false">(function(){`
        + `var uid="${uid}";`
        + `var activeClass=uid+"-navlink-active";`
        + `var focusClass=uid+"-section-focus";`
        + `var secs=document.querySelectorAll("."+uid+"-section");`
        + `function setActive(n){var all=document.querySelectorAll("."+uid+"-navlink");all.forEach(function(a){a.classList.remove(activeClass);});var t=document.getElementById(uid+"-nav"+n);if(t)t.classList.add(activeClass);}`
        + `function focusSection(n,updateHash){var s=document.getElementById(uid+"-s"+n);if(!s)return false;setActive(n);s.classList.remove(focusClass);try{s.focus({preventScroll:true});}catch(err){try{s.focus();}catch(_err){}}if(s.scrollIntoView)s.scrollIntoView({behavior:"smooth",block:"start"});s.classList.add(focusClass);window.setTimeout(function(){s.classList.remove(focusClass);},1200);if(updateHash){if(window.history&&window.history.replaceState)window.history.replaceState(null,"","#"+s.id);else window.location.hash=s.id;}return false;}`
        + `var links=document.querySelectorAll("."+uid+"-navlink");`
        + `links.forEach(function(a){a.addEventListener("click",function(e){e.preventDefault();focusSection(this.getAttribute("data-section"),true);});});`
        + `if(secs.length&&window.IntersectionObserver){var obs=new IntersectionObserver(function(entries){entries.forEach(function(e){if(e.isIntersecting){var n=e.target.getAttribute("data-section");if(n)setActive(n);}});},{threshold:0.25,rootMargin:"-10% 0px -60% 0px"});secs.forEach(function(s){obs.observe(s);});}`
        + `var hash=(window.location.hash||"").replace("#","");`
        + `if(hash.indexOf(uid+"-s")===0){window.setTimeout(function(){focusSection(hash.replace(uid+"-s",""),false);},30);}else if(secs[0]){setActive(secs[0].getAttribute("data-section")||"1");}`
        + `})();<\/script>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">`
        + `\n<div id="${uid}" style="font-family:'Poppins',sans-serif;max-width:100%;box-sizing:border-box;">`
        + styleHtml
        + headerHtml
        + `<div class="${uid}-layout">`
        + navHtml
        + `<div class="${uid}-content">${sectionsHtml}</div>`
        + `</div></div>`
        + scrollScript;
}
