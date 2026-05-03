import { escapeHtml, normalize, textStyle } from '../../utils/text';
function attr(s) {
    return escapeHtml(s).replace(/'/g, '&#39;');
}
function safeHex(value, fallback) {
    return /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : fallback;
}
function clampInt(value, fallback, min, max) {
    const n = parseInt(String(value), 10);
    if (Number.isNaN(n))
        return fallback;
    return Math.min(max, Math.max(min, n));
}
function tv(value, key) {
    return normalize(value, key);
}
function cardHtml(card, mode, imageBoxWidth, imageBoxHeight) {
    const defaults = mode === 'left'
        ? { bg: '#f8f9fa', border: '#e5e7eb', iconBg: '#e8edf5', iconColor: '#204280', ctaBg: '#204280', title: 'lgsCardTitle', desc: 'lgsCardDesc', cta: 'lgsCardCta' }
        : { bg: '#1a2d4a', border: '#1e3a5f', iconBg: '#1e3a5f', iconColor: '#f59e0b', ctaBg: '#3b82f6', title: 'rpsCardTitle', desc: 'rpsCardDesc', cta: 'rpsCardCta' };
    const type = card.type || 'card';
    const imgW = clampInt(imageBoxWidth, 100, 10, 100);
    const imgH = clampInt(imageBoxHeight, 180, 40, 800);
    const imageBoxStyle = `width:${imgW}%;height:${imgH}px;max-width:100%;overflow:hidden;`;
    const imageStyle = 'width:100%;height:100%;object-fit:cover;display:block;';
    if (type === 'image') {
        const radius = clampInt(card.borderRadius, 8, 0, 60);
        const maxWidth = (card.maxWidth || '').trim();
        const spanStyle = mode === 'left' ? `grid-column:span ${card.halfWidth ? 1 : 2};` : '';
        return `    <div style="${spanStyle}${imageBoxStyle}border-radius:${radius}px;${maxWidth ? `max-width:${attr(maxWidth)};` : ''}">
      <img src="${attr(card.imageUrl || '')}" alt="${attr(card.imageAlt || '')}" style="${imageStyle}">
    </div>`;
    }
    const cardBg = safeHex(card.cardBg, defaults.bg);
    const cardBorder = safeHex(card.cardBorder, defaults.border);
    const title = tv(card.title, defaults.title);
    const desc = tv(card.desc, defaults.desc);
    const descText = desc.text.trim();
    if (type === 'card-image') {
        const cta = tv(card.ctaText, defaults.cta);
        let body = '';
        if (title.text)
            body += `<div style="font-family:'Poppins',sans-serif;margin:0 0 8px;${textStyle(title)}">${escapeHtml(title.text)}</div>`;
        if (descText)
            body += `<div style="font-family:'Poppins',sans-serif;margin:0${cta.text ? ' 0 12px' : ''};line-height:1.6;${textStyle(desc)}">${descText}</div>`;
        if (cta.text)
            body += `<a href="${attr(card.ctaUrl || '#')}" style="display:inline-block;font-family:'Poppins',sans-serif;padding:8px 18px;background:${safeHex(card.ctaBg, defaults.ctaBg)};border-radius:6px;text-decoration:none;${textStyle(cta)}color:${safeHex(card.ctaColor, '#ffffff')};">${escapeHtml(cta.text)}</a>`;
        const spanStyle = mode === 'left' ? `grid-column:span ${card.halfWidth ? 1 : 2};` : '';
        const frameW = mode === 'left' ? Math.min(imgW, 45) : Math.min(imgW, 42);
        const frameStyle = `width:${frameW}%;height:${imgH}px;min-width:140px;max-width:320px;border:1px solid ${cardBorder};border-radius:${mode === 'left' ? 8 : 10}px;overflow:hidden;background:${safeHex(card.cardBorder, defaults.border)};flex-shrink:0;`;
        return `    <div style="${spanStyle}background:${cardBg};border:1px solid ${cardBorder};border-radius:${mode === 'left' ? 10 : 12}px;overflow:hidden;display:flex;align-items:stretch;gap:0;">
${card.imageUrl ? `      <div style="${frameStyle}"><img src="${attr(card.imageUrl)}" alt="${attr(card.imageAlt || '')}" style="${imageStyle}"></div>\n` : ''}      <div style="padding:${mode === 'left' ? 16 : 20}px;flex:1;min-width:0;">${body}</div>
    </div>`;
    }
    if (mode === 'right') {
        const hasIcon = (card.icon || '').trim();
        const hasStat = (card.statValue || '').trim();
        let out = `    <div style="background:${cardBg};border:1px solid ${cardBorder};border-radius:12px;padding:20px;">\n`;
        if (hasIcon) {
            out += `      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <div style="width:36px;height:36px;min-width:36px;background:${safeHex(card.iconBg, defaults.iconBg)};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:${safeHex(card.iconColor, defaults.iconColor)};">${escapeHtml(hasIcon)}</div>
${title.text ? `        <h3 style="margin:0;font-family:'Poppins',sans-serif;line-height:1.3;${textStyle(title)}">${escapeHtml(title.text)}</h3>\n` : ''}      </div>\n`;
        }
        else if (title.text) {
            out += `      <h3 style="margin:0 0 10px;font-family:'Poppins',sans-serif;line-height:1.3;${textStyle(title)}">${escapeHtml(title.text)}</h3>\n`;
        }
        if (descText)
            out += `      <div style="margin:0${hasStat ? ' 0 16px' : ''};font-family:'Poppins',sans-serif;line-height:1.6;${textStyle(desc)}">${descText}</div>\n`;
        if (hasStat) {
            out += `      <div style="background:${safeHex(card.statBg, defaults.iconBg)};border-radius:8px;padding:12px 16px;display:flex;gap:14px;align-items:center;">
        <span style="font-family:'Poppins',sans-serif;font-size:28px;font-weight:800;color:${safeHex(card.statValueColor, '#ffffff')};white-space:nowrap;">${escapeHtml(hasStat)}</span>
${card.statLabel ? `        <span style="font-family:'Poppins',sans-serif;font-size:13px;color:${safeHex(card.statLabelColor, '#94a3b8')};line-height:1.4;">${escapeHtml(card.statLabel)}</span>\n` : ''}      </div>\n`;
        }
        return out + '    </div>';
    }
    const spanStyle = `grid-column:span ${card.halfWidth ? 1 : 2};`;
    return `    <div style="${spanStyle}background:${cardBg};border:1px solid ${cardBorder};border-radius:10px;padding:14px 16px;display:flex;gap:14px;align-items:flex-start;">
      <div style="width:30px;height:30px;min-width:30px;background:${safeHex(card.iconBg, defaults.iconBg)};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:${safeHex(card.iconColor, defaults.iconColor)};margin-top:1px;">${escapeHtml(card.icon || '+')}</div>
      <div style="flex:1;min-width:0;">
${title.text ? `        <div style="font-family:'Poppins',sans-serif;${textStyle(title)}">${escapeHtml(title.text)}</div>\n` : ''}${descText ? `        <div style="font-family:'Poppins',sans-serif;${textStyle(desc)};line-height:1.55;${title.text ? 'margin-top:4px;' : ''}">${descText}</div>\n` : ''}      </div>
    </div>`;
}
export function generatePanelHtml(section, mode) {
    const bg = safeHex(section.bg, mode === 'left' ? '#ffffff' : '#0f1e3c');
    const eyebrow = tv(section.eyebrow, mode === 'left' ? 'lgsEyebrow' : 'rpsEyebrow');
    const heading = tv(section.heading, mode === 'left' ? 'lgsHeading' : 'rpsHeading');
    const desc = tv(section.desc, mode === 'left' ? 'lgsDesc' : 'rpsDesc');
    const uid = `${mode === 'left' ? 'lgs' : 'rps'}${Date.now().toString(36)}`;
    const imageBoxWidth = clampInt(section.imageBoxWidth, 100, 10, 100);
    const imageBoxHeight = clampInt(section.imageBoxHeight, 180, 40, 800);
    const cards = (section.cards || []).map(card => cardHtml(card, mode, imageBoxWidth, imageBoxHeight)).join('\n');
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>.${uid}{font-family:'Poppins',sans-serif;background:${bg};box-sizing:border-box;}${mode === 'left' ? `.${uid}-cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;}@media(max-width:600px){.${uid}-cards>*{grid-column:span 2!important;}}` : `.${uid}-cards{display:flex;flex-direction:column;gap:12px;}`}</style>
<div class="${uid}">
${eyebrow.text ? `  <div style="font-family:'Poppins',sans-serif;text-transform:uppercase;margin:0 0 ${mode === 'left' ? 10 : 16}px;${mode === 'right' ? 'padding:20px 0 0 20px;' : ''}${textStyle(eyebrow)}">${escapeHtml(eyebrow.text)}</div>\n` : ''}${heading.text ? `  <h2 style="font-family:'Poppins',sans-serif;margin:0 0 16px;${mode === 'right' ? 'padding:0 0 0 20px;' : ''}line-height:1.2;${textStyle(heading)}">${escapeHtml(heading.text)}</h2>\n` : ''}${desc.text ? `  <div style="font-family:'Poppins',sans-serif;margin:0 0 24px;${mode === 'right' ? 'padding:0 0 0 20px;' : ''}line-height:1.6;${textStyle(desc)}">${desc.text}</div>\n` : ''}${cards ? `  <div class="${uid}-cards"${mode === 'right' ? ' style="padding:0 20px 20px;"' : ''}>\n${cards}\n  </div>\n` : ''}</div>`;
}
export function generateLeftHeroHtml(data) {
    const uid = `plh${Date.now().toString(36)}`;
    const heading = tv(data.heading, 'plhHeading');
    const statsDiv = safeHex(data.statsDiv, '#1e3a5f');
    let out = `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>#${uid}{font-family:'Poppins',sans-serif;box-sizing:border-box;}#${uid} *{box-sizing:border-box;}@media(max-width:767px){#${uid}{padding:32px 20px!important;}#${uid} .plh-heading{font-size:clamp(24px,7vw,40px)!important;}#${uid} .plh-stats{flex-wrap:wrap;}#${uid} .plh-stat{flex:0 0 calc(50% - 1px)!important;border-right:none!important;padding:12px 16px!important;border-bottom:1px solid ${statsDiv};}}</style>
<div id="${uid}" style="background:${safeHex(data.bg, '#0d1f3c')};padding:${clampInt(data.padTop, 48, 0, 200)}px ${clampInt(data.padRight, 40, 0, 200)}px ${clampInt(data.padBot, 56, 0, 200)}px ${clampInt(data.padLeft, 60, 0, 200)}px;">
`;
    if (data.breadcrumb)
        out += `  <p style="font-family:'Poppins',sans-serif;font-size:12px;color:${safeHex(data.breadcrumbTc, '#94a3b8')};margin:0 0 20px;font-weight:400;">${escapeHtml(data.breadcrumb)}</p>\n`;
    const labels = (data.eyebrowLabels || []).filter(Boolean);
    if (labels.length) {
        out += `  <div style="display:flex;align-items:center;margin-bottom:16px;flex-wrap:wrap;"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${safeHex(data.eyebrowDotColor, '#4a90d9')};margin-right:10px;flex-shrink:0;"></span>`;
        labels.forEach((label, i) => {
            if (i > 0)
                out += `<span style="color:${safeHex(data.eyebrowTc, '#4a90d9')};margin:0 8px;font-family:'Poppins',sans-serif;font-size:11px;">&middot;</span>`;
            out += `<span style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:${safeHex(data.eyebrowTc, '#4a90d9')};letter-spacing:.1em;text-transform:uppercase;">${escapeHtml(label)}</span>`;
        });
        out += '</div>\n';
    }
    if (heading.text || data.headingAccent) {
        out += `  <h1 class="plh-heading" style="${textStyle(heading)}margin:0 0 20px;line-height:1.15;">${escapeHtml(heading.text)}${data.headingAccent ? ` <span style="color:${safeHex(data.headingAccentColor, '#4a90d9')};">${escapeHtml(data.headingAccent)}</span>` : ''}</h1>\n`;
    }
    (data.descs || []).filter(Boolean).forEach(desc => {
        out += `  <p style="font-family:'Poppins',sans-serif;font-size:${clampInt(data.descSize, 15, 11, 24)}px;color:${safeHex(data.descTc, '#cbd5e1')};margin:0 0 14px;line-height:1.65;font-weight:400;">${escapeHtml(desc)}</p>\n`;
    });
    const pathway = (data.pathwayItems || []).filter(item => item.text);
    if (pathway.length) {
        out += '  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:20px 0 24px;">\n';
        pathway.forEach((item, i) => {
            if (i > 0)
                out += `    <span style="font-family:'Poppins',sans-serif;font-size:16px;color:${safeHex(data.arrowColor, '#4a90d9')};">-&gt;</span>\n`;
            out += `    <div style="display:inline-flex;align-items:center;gap:8px;background:${safeHex(data.pillBg, '#132343')};border:1px solid ${safeHex(data.pillBorder, '#1e3a5f')};border-radius:8px;padding:8px 14px;">${item.icon ? `<span>${escapeHtml(item.icon)}</span>` : ''}<span style="font-family:'Poppins',sans-serif;font-size:13px;font-weight:600;color:${safeHex(data.pillTc, '#ffffff')};">${escapeHtml(item.text)}</span></div>\n`;
        });
        out += '  </div>\n';
    }
    if (data.primaryCta || data.secondaryCta) {
        out += '  <div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:36px;">\n';
        if (data.primaryCta)
            out += `    <a href="${attr(data.primaryCtaUrl || '#')}" style="display:inline-block;padding:13px 26px;background:${safeHex(data.primaryBg, '#204280')};color:${safeHex(data.primaryTc, '#ffffff')};font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;">${escapeHtml(data.primaryCta)}</a>\n`;
        if (data.secondaryCta)
            out += `    <a href="${attr(data.secondaryCtaUrl || '#')}" style="display:inline-block;padding:13px 26px;border:2px solid ${safeHex(data.secondaryBorder, '#4a5568')};color:${safeHex(data.secondaryTc, '#ffffff')};font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;border-radius:8px;text-decoration:none;background:transparent;">${escapeHtml(data.secondaryCta)}</a>\n`;
        out += '  </div>\n';
    }
    const stats = (data.statsItems || []).filter(s => s.value);
    if (stats.length) {
        out += '  <div class="plh-stats" style="display:flex;flex-wrap:nowrap;gap:0;margin-bottom:28px;">\n';
        stats.forEach((stat, i) => {
            out += `    <div class="plh-stat" style="flex:1;min-width:0;padding:${i === 0 ? '0 24px 0 0' : '0 24px'};${i === stats.length - 1 ? '' : `border-right:1px solid ${statsDiv};`}"><div style="font-family:'Poppins',sans-serif;font-size:26px;font-weight:700;color:${safeHex(data.statsVc, '#ffffff')};line-height:1.1;margin-bottom:4px;">${escapeHtml(stat.value)}</div>${stat.label1 ? `<div style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;color:${safeHex(data.statsLc, '#94a3b8')};letter-spacing:.08em;text-transform:uppercase;line-height:1.5;">${escapeHtml(stat.label1)}</div>` : ''}${stat.label2 ? `<div style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;color:${safeHex(data.statsLc, '#94a3b8')};letter-spacing:.08em;text-transform:uppercase;line-height:1.5;">${escapeHtml(stat.label2)}</div>` : ''}</div>\n`;
        });
        out += '  </div>\n';
    }
    const trust = (data.trustItems || []).filter(item => item.text);
    if (trust.length) {
        out += '  <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 0;">\n';
        trust.forEach((item, i) => {
            if (i > 0)
                out += `    <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:${safeHex(data.trustSep, '#4a90d9')};margin:0 10px;vertical-align:middle;flex-shrink:0;"></span>\n`;
            out += `    <span style="display:inline-flex;align-items:center;gap:6px;font-family:'Poppins',sans-serif;font-size:12px;color:${safeHex(data.trustTc, '#94a3b8')};">${item.icon ? `<span>${escapeHtml(item.icon)}</span>` : ''}${escapeHtml(item.text)}</span>\n`;
        });
        out += '  </div>\n';
    }
    return out + '</div>';
}
