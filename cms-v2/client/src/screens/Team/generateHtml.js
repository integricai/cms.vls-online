import { normalize, textStyle, escapeHtml } from '../../utils/text';
function teamInitials(name) {
    if (!name)
        return '';
    return name.trim().split(/\s+/).map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
}
function getStr(v) {
    if (!v)
        return '';
    if (typeof v === 'string')
        return v;
    return v.text || '';
}
export function generateTeamHtml(cards) {
    if (!cards.length)
        return '<!-- No team members -->';
    const uid = 'vlsteam' + Math.random().toString(36).slice(2, 7);
    const L = [];
    const e = escapeHtml;
    L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
    L.push('<style>');
    L.push(`.${uid}{display:flex;flex-direction:column;gap:24px;width:100%;}`);
    L.push(`.${uid}-card{display:flex;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.08);border:1px solid #f0f0f5;}`);
    L.push(`.${uid}-left{width:160px;flex-shrink:0;background:#f8f9fb;border-right:1px solid #e8eaf0;padding:24px 16px;display:flex;flex-direction:column;align-items:center;gap:12px;}`);
    L.push(`.${uid}-photo{width:100px;height:100px;border-radius:50%;object-fit:cover;object-position:top center;display:block;border:3px solid #534AB7;}`);
    L.push(`.${uid}-initials{width:100px;height:100px;border-radius:50%;background:#EEEDFE;display:flex;align-items:center;justify-content:center;border:3px solid #534AB7;}`);
    L.push(`.${uid}-initials span{font-family:Poppins,sans-serif;font-size:28px;font-weight:700;color:#534AB7;}`);
    L.push(`.${uid}-badge{display:inline-block;padding:4px 12px;background:#EEEDFE;border-radius:999px;font-family:Poppins,sans-serif;text-align:center;word-break:break-word;}`);
    L.push(`.${uid}-feat{width:100%;background:#fff;border-radius:8px;padding:10px 8px;text-align:center;border:1px solid #e8eaf0;box-sizing:border-box;}`);
    L.push(`.${uid}-fv{font-family:Poppins,sans-serif;line-height:1.1;}`);
    L.push(`.${uid}-fl{font-family:Poppins,sans-serif;text-transform:uppercase;margin-top:4px;}`);
    L.push(`.${uid}-right{flex:1;min-width:0;padding:28px 28px 24px;}`);
    L.push(`.${uid}-ey{font-family:Poppins,sans-serif;text-transform:uppercase;margin-bottom:8px;}`);
    L.push(`.${uid}-name{font-family:Poppins,sans-serif;margin:0 0 4px;text-align:left;}`);
    L.push(`.${uid}-role{font-family:Poppins,sans-serif;margin:0 0 16px;text-align:left;}`);
    L.push(`.${uid}-para{font-family:Poppins,sans-serif;line-height:1.75;margin:0 0 12px;text-align:left;}`);
    L.push(`.${uid}-para:last-of-type{margin-bottom:0;}`);
    L.push(`.${uid}-tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;}`);
    L.push(`.${uid}-tag{display:inline-block;padding:5px 14px;border:1.5px solid #e2e8f0;border-radius:999px;font-family:Poppins,sans-serif;}`);
    L.push('@media(max-width:640px){');
    L.push(`  .${uid}-card{flex-direction:column;}`);
    L.push(`  .${uid}-left{width:100%;border-right:none;border-bottom:1px solid #e8eaf0;flex-direction:row;flex-wrap:wrap;justify-content:center;gap:10px;padding:20px;}`);
    L.push(`  .${uid}-right{padding:20px;}`);
    L.push('}');
    L.push('</style>');
    L.push('');
    L.push(`<div class="${uid}">`);
    for (const card of cards) {
        const eyebrow = normalize(card.eyebrow, 'teamEyebrow');
        const name = normalize(card.name, 'teamName');
        const designation = normalize(card.designation, 'teamDesignation');
        const validFeats = (card.features || []).filter(f => getStr(f.value).trim());
        const validTags = (card.tags || []).filter(t => getStr(t).trim());
        const validParas = (card.paras || []).filter(p => getStr(p).trim());
        L.push(`  <div class="${uid}-card">`);
        // Left panel
        L.push(`    <div class="${uid}-left">`);
        if (card.imgUrl) {
            L.push(`      <img class="${uid}-photo" src="${e(card.imgUrl)}" alt="${e(name.text)}">`);
        }
        else {
            L.push(`      <div class="${uid}-initials"><span>${e(teamInitials(name.text))}</span></div>`);
        }
        if (designation.text) {
            L.push(`      <span class="${uid}-badge" style="${textStyle(designation)}">${e(designation.text)}</span>`);
        }
        for (const f of validFeats) {
            const fv = normalize(f.value, 'teamFeatureValue');
            const fl = normalize(f.label, 'teamFeatureLabel');
            L.push(`      <div class="${uid}-feat">`);
            L.push(`        <div class="${uid}-fv" style="${textStyle(fv)}">${e(fv.text)}</div>`);
            if (fl.text)
                L.push(`        <div class="${uid}-fl" style="${textStyle(fl)}">${e(fl.text)}</div>`);
            L.push(`      </div>`);
        }
        L.push(`    </div>`);
        // Right panel
        L.push(`    <div class="${uid}-right">`);
        if (eyebrow.text)
            L.push(`      <div class="${uid}-ey" style="${textStyle(eyebrow)}">${e(eyebrow.text)}</div>`);
        L.push(`      <h3 class="${uid}-name" style="${textStyle(name)}">${e(name.text)}</h3>`);
        if (designation.text)
            L.push(`      <p class="${uid}-role" style="${textStyle(designation)}">${e(designation.text)}</p>`);
        for (const p of validParas) {
            const para = normalize(p, 'team');
            L.push(`      <p class="${uid}-para" style="${textStyle(para)}">${e(para.text)}</p>`);
        }
        if (validTags.length) {
            L.push(`      <div class="${uid}-tags">`);
            for (const t of validTags) {
                const tag = normalize(t, 'teamTag');
                L.push(`        <span class="${uid}-tag" style="${textStyle(tag)}">${e(tag.text)}</span>`);
            }
            L.push(`      </div>`);
        }
        L.push(`    </div>`);
        L.push(`  </div>`);
    }
    L.push('</div>');
    return L.join('\n');
}
