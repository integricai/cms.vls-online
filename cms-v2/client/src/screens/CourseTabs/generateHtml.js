import { normalize, textStyle, escapeHtml } from '../../utils/text';
function safeHex(v, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v : fallback;
}
function safeUrl(v) {
    const s = (v ?? '').trim();
    if (!s)
        return '#';
    if (/^(https?:\/\/|\/|#|mailto:)/.test(s))
        return escapeHtml(s);
    return '#';
}
function renderCard(card, style) {
    const ct = normalize(card.title, 'ctabsCardTitle');
    const cd = normalize(card.desc, 'ctabsCardDesc');
    if (style === 'inc') {
        return `<div style="display:flex;gap:12px;align-items:flex-start;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;">`
            + `<div style="background:#f0f4ff;border-radius:8px;width:42px;height:42px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${escapeHtml(card.icon || '')}</div>`
            + `<div style="flex:1;">`
            + `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:3px;">`
            + (ct.text ? `<p style="font-family:'Poppins',sans-serif;margin:0;${textStyle(ct)}">${escapeHtml(ct.text)}</p>` : '')
            + (card.badge ? `<span style="background:#e0e7ff;color:#3730a3;font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;">${escapeHtml(card.badge)}</span>` : '')
            + `</div>`
            + (cd.text ? `<p style="font-family:'Poppins',sans-serif;margin:0;line-height:1.5;${textStyle(cd)}">${cd.text}</p>` : '')
            + `</div></div>`;
    }
    if (style === 'support') {
        return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;display:flex;flex-direction:column;">`
            + `<div style="width:44px;height:44px;background:#f0f4ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;margin-bottom:12px;">${escapeHtml(card.icon || '')}</div>`
            + (card.subtitle ? `<p style="font-family:'Poppins',sans-serif;font-size:12px;font-style:italic;color:#6b7280;margin:0 0 4px;">${escapeHtml(card.subtitle)}</p>` : '')
            + (ct.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 6px;${textStyle(ct)}">${escapeHtml(ct.text)}</p>` : '')
            + (cd.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 14px;line-height:1.5;flex:1;${textStyle(cd)}">${cd.text}</p>` : '')
            + (card.cta ? `<a href="${safeUrl(card.url)}" style="display:block;text-align:center;background:#0f1e3c;color:#fff;font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;padding:10px 16px;border-radius:8px;text-decoration:none;margin-top:auto;">${escapeHtml(card.cta)}</a>` : '')
            + `</div>`;
    }
    // more-cards
    return `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:24px 20px;display:flex;flex-direction:column;align-items:center;text-align:center;">`
        + `<div style="width:52px;height:52px;background:#f0f4ff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;margin-bottom:14px;">${escapeHtml(card.icon || '')}</div>`
        + (ct.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 8px;${textStyle(ct)}">${escapeHtml(ct.text)}</p>` : '')
        + (cd.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 16px;line-height:1.5;flex:1;${textStyle(cd)}">${cd.text}</p>` : '')
        + (card.cta ? `<a href="${safeUrl(card.url)}" style="display:block;width:100%;box-sizing:border-box;text-align:center;background:#0f1e3c;color:#fff;font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;padding:11px 16px;border-radius:8px;text-decoration:none;margin-top:auto;">${escapeHtml(card.cta)}</a>` : '')
        + `</div>`;
}
function renderStep(step, index, isLast) {
    const st = normalize(step.title, 'ctabsStepTitle');
    const sd = normalize(step.desc, 'ctabsStepDesc');
    return `<div style="display:flex;gap:16px;align-items:flex-start;">`
        + `<div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;width:44px;">`
        + `<div style="width:44px;height:44px;border-radius:50%;background:#0f1e3c;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${escapeHtml(step.icon || String(index + 1))}</div>`
        + (!isLast ? `<div style="width:2px;flex:1;background:#dde4f0;margin:4px 0;min-height:20px;"></div>` : '')
        + `</div>`
        + `<div style="padding-bottom:${isLast ? 0 : 22}px;padding-top:8px;">`
        + (st.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 5px;${textStyle(st)}">${escapeHtml(st.text)}</p>` : '')
        + (sd.text ? `<p style="font-family:'Poppins',sans-serif;margin:0 0 8px;line-height:1.6;${textStyle(sd)}">${sd.text}</p>` : '')
        + (step.cta ? `<a href="${safeUrl(step.url)}" style="display:inline-block;padding:6px 16px;border:1.5px solid #204280;color:#204280;font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;border-radius:20px;text-decoration:none;">${escapeHtml(step.cta)}</a>` : '')
        + `</div></div>`;
}
function renderBlock(blk, uid) {
    const d = blk.data;
    if (blk.type === 'panel-intro') {
        const eyebrow = (d.eyebrow || '').toUpperCase();
        return `<div class="${uid}-panel" style="background:#0f1e3c;border-radius:12px;margin-bottom:1.5rem;">`
            + (eyebrow ? `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:#7c9fc0;letter-spacing:.1em;text-transform:uppercase;margin:0 0 8px;">${escapeHtml(eyebrow)}</p>` : '')
            + (d.heading ? `<h2 style="font-family:'Poppins',sans-serif;font-size:22px;font-weight:700;color:#ffffff;margin:0 0 10px;line-height:1.3;">${escapeHtml(d.heading)}</h2>` : '')
            + (d.desc ? `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:#c7d2fe;margin:0;line-height:1.6;">${escapeHtml(d.desc)}</p>` : '')
            + `</div>`;
    }
    if (blk.type === 'paragraph') {
        const para = normalize(d.para, 'ctabsPara');
        return para.text
            ? `<p style="font-family:'Poppins',sans-serif;line-height:1.6;margin-bottom:1.25rem;${textStyle(para)}">${para.text}</p>`
            : '';
    }
    if (blk.type === 'heading-para') {
        const h = normalize(d.headingRich, 'ctabsHeading');
        const p = normalize(d.para, 'ctabsPara');
        return `<div style="margin-bottom:1.25rem;">`
            + (h.text ? `<h3 style="font-family:'Poppins',sans-serif;margin:0 0 6px;${textStyle(h)}">${escapeHtml(h.text)}</h3>` : '')
            + (p.text ? `<p style="font-family:'Poppins',sans-serif;margin:0;line-height:1.6;${textStyle(p)}">${p.text}</p>` : '')
            + `</div>`;
    }
    if (blk.type === 'bullets') {
        const bh = normalize(d.headingRich, 'ctabsHeading');
        const items = d.items ?? [];
        return `<div style="margin-bottom:1.25rem;">`
            + (bh.text ? `<h3 style="font-family:'Poppins',sans-serif;margin:0 0 8px;${textStyle(bh)}">${escapeHtml(bh.text)}</h3>` : '')
            + `<ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">`
            + items.map(item => {
                const bi = normalize(item, 'ctabsBullet');
                return bi.text
                    ? `<li style="display:flex;gap:8px;align-items:flex-start;font-family:'Poppins',sans-serif;${textStyle(bi)}"><span style="color:#204280;font-weight:700;flex-shrink:0;">&#10003;</span><span>${bi.text}</span></li>`
                    : '';
            }).join('')
            + `</ul></div>`;
    }
    if (blk.type === 'assurance') {
        const eyebrow = (d.eyebrow || '').toUpperCase();
        return `<div class="${uid}-assur" style="background:#0f1e3c;border-radius:12px;margin-bottom:1.5rem;display:flex;gap:20px;align-items:flex-start;">`
            + (d.icon ? `<div style="background:#1e3a6e;border-radius:10px;width:50px;height:50px;display:flex;align-items:center;justify-content:center;font-size:24px;flex-shrink:0;">${escapeHtml(d.icon)}</div>` : '')
            + `<div>`
            + (eyebrow ? `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:#7c9fc0;letter-spacing:.1em;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(eyebrow)}</p>` : '')
            + (d.heading ? `<h3 style="font-family:'Poppins',sans-serif;font-size:16px;font-weight:700;color:#ffffff;margin:0 0 8px;">${escapeHtml(d.heading)}</h3>` : '')
            + (d.desc ? `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:#c7d2fe;margin:0;line-height:1.6;">${escapeHtml(d.desc)}</p>` : '')
            + `</div></div>`;
    }
    if (blk.type === 'inc-cards') {
        const cards = d.cards ?? [];
        if (!cards.length)
            return '';
        return `<div class="${uid}-grid2">`
            + cards.map(c => renderCard(c, 'inc')).join('\n')
            + `</div>`;
    }
    if (blk.type === 'steps') {
        const steps = d.steps ?? [];
        if (!steps.length)
            return '';
        return `<div style="display:flex;flex-direction:column;margin-bottom:1.5rem;">`
            + steps.map((s, i) => renderStep(s, i, i === steps.length - 1)).join('\n')
            + `</div>`;
    }
    if (blk.type === 'support-cards') {
        let rows = d.rows ?? [];
        if (!rows.length && d.cards?.length) {
            for (let i = 0; i < d.cards.length; i += 2) {
                const slice = d.cards.slice(i, i + 2);
                rows.push({ cols: slice.length, cards: slice });
            }
        }
        return rows.map(row => {
            const rc = row.cards ?? [];
            if (!rc.length)
                return '';
            const gridClass = row.cols === 1 ? `${uid}-grid1` : `${uid}-grid2`;
            return `<div class="${gridClass}">${rc.map(c => renderCard(c, 'support')).join('\n')}</div>`;
        }).join('\n');
    }
    if (blk.type === 'more-cards') {
        const cards = d.cards ?? [];
        if (!cards.length)
            return '';
        return `<div class="${uid}-grid3">`
            + cards.map(c => renderCard(c, 'more')).join('\n')
            + `</div>`;
    }
    if (blk.type === 'banner') {
        const bg = safeHex(d.bg, '#204280');
        const eyebrow = (d.eyebrow || '').toUpperCase();
        return `<div class="${uid}-banner" style="background:${bg};border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:1.5rem;flex-wrap:wrap;">`
            + `<div style="flex:1;min-width:200px;">`
            + (eyebrow ? `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);letter-spacing:.1em;text-transform:uppercase;margin:0 0 6px;">${escapeHtml(eyebrow)}</p>` : '')
            + (d.title ? `<h3 style="font-family:'Poppins',sans-serif;font-size:20px;font-weight:700;color:#ffffff;margin:0 0 8px;line-height:1.3;">${escapeHtml(d.title)}</h3>` : '')
            + (d.desc ? `<p style="font-family:'Poppins',sans-serif;font-size:14px;color:rgba(255,255,255,0.8);margin:0;line-height:1.6;">${escapeHtml(d.desc)}</p>` : '')
            + `</div>`
            + (d.cta ? `<div style="flex-shrink:0;"><a href="${safeUrl(d.url)}" style="display:inline-block;padding:12px 28px;border:2px solid rgba(255,255,255,0.8);color:#ffffff;font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;white-space:nowrap;">${escapeHtml(d.cta)}</a></div>` : '')
            + `</div>`;
    }
    return '';
}
export function generateCourseTabsHtml(d) {
    const uid = 'vct' + Date.now().toString(36);
    const tabs = d.tabs ?? [];
    function makeClick(panelId) {
        let js = `var w=this.closest('[data-vctabs]');`;
        js += `w.querySelectorAll('[data-vctbtn]').forEach(function(b){b.classList.remove('${uid}-active');});`;
        js += `this.classList.add('${uid}-active');`;
        js += `w.querySelectorAll('[data-vctpanel]').forEach(function(p){p.style.display='none';});`;
        js += `document.getElementById('${panelId}').style.display='block';`;
        return js.replace(/"/g, '&quot;');
    }
    const css = `<style>`
        + `.${uid}-nav{display:flex;gap:0;border-bottom:2px solid #e5e7eb;margin-bottom:1.5rem;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;scrollbar-width:none;}`
        + `.${uid}-nav::-webkit-scrollbar{display:none;}`
        + `.${uid}-btn{background:none;border:none;border-bottom:3px solid transparent;padding:12px 20px;font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;color:#6b7280;cursor:pointer;white-space:nowrap;margin-bottom:-2px;transition:color .15s,border-color .15s;display:flex;align-items:center;gap:6px;}`
        + `.${uid}-btn:hover{color:#204280;}`
        + `.${uid}-active{border-bottom-color:#204280!important;color:#204280!important;background:rgba(32,66,128,0.04);}`
        + `.${uid}-grid1{display:grid;grid-template-columns:1fr;gap:14px;margin-bottom:1.5rem;}`
        + `.${uid}-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:1.5rem;}`
        + `.${uid}-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:1.5rem;}`
        + `.${uid}-panel{padding:28px 32px;}`
        + `.${uid}-assur{padding:24px 28px;}`
        + `.${uid}-banner{padding:28px 32px;}`
        + `@media(max-width:640px){`
        + `.${uid}-nav{flex-wrap:wrap;overflow-x:visible;overflow-y:visible;border-bottom:none;margin-bottom:1rem;}`
        + `.${uid}-btn{flex:0 0 50%;width:50%;box-sizing:border-box;white-space:normal;text-align:center;justify-content:center;font-size:13px;padding:10px 8px;margin-bottom:0;border-bottom:2px solid #e5e7eb;border-radius:0;}`
        + `.${uid}-grid2,.${uid}-grid3{grid-template-columns:1fr!important;}`
        + `.${uid}-panel{padding:20px 18px!important;}`
        + `.${uid}-assur{padding:20px 18px!important;gap:14px!important;flex-wrap:wrap!important;}`
        + `.${uid}-banner{padding:20px 18px!important;}`
        + `}`
        + `</style>\n\n`;
    let out = css;
    out += `<div data-vctabs="1" style="font-family:'Poppins',sans-serif;font-size:15px;font-weight:400;line-height:1.6;color:#1a1a1a;width:100%;box-sizing:border-box;">\n\n`;
    out += `<div class="${uid}-nav">\n`;
    tabs.forEach((tab, i) => {
        const pid = `${uid}-${i}`;
        const label = tab.label || `Tab ${i + 1}`;
        const activeClass = i === 0 ? ` ${uid}-active` : '';
        const iconSpan = tab.icon ? `<span style="font-size:16px;line-height:1;">${escapeHtml(tab.icon)}</span>` : '';
        out += `  <button data-vctbtn="1" class="${uid}-btn${activeClass}" onclick="${makeClick(pid)}">${iconSpan}${escapeHtml(label)}</button>\n`;
    });
    out += `</div>\n\n`;
    tabs.forEach((tab, i) => {
        const pid = `${uid}-${i}`;
        out += `<div id="${pid}" data-vctpanel="1" style="display:${i === 0 ? 'block' : 'none'};">\n`;
        (tab.blocks ?? []).forEach(blk => {
            const html = renderBlock(blk, uid);
            if (html)
                out += `  ${html}\n`;
        });
        out += `</div>\n\n`;
    });
    out += `</div>`;
    return out;
}
