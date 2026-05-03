import { normalize, textStyle, escapeHtml } from '../../utils/text';
export function generateHeroHtml(sec) {
    const uid = 'h' + Date.now().toString(36);
    const h1Size = Math.min(80, Math.max(24, sec.h1Size ?? 44));
    const eyebrow = normalize(sec.eyebrow, 'heroEyebrow');
    const h1 = normalize(sec.h1, 'heroH1');
    h1.size = h1Size;
    const h1hl = normalize(sec.h1hl, 'heroH1Highlight');
    h1hl.size = h1Size;
    const h2 = normalize(sec.h2, 'heroH2');
    const desc = normalize(sec.desc, 'hero');
    const b1Text = normalize(sec.b1t, 'heroButton');
    const b2Text = normalize(sec.b2t, 'heroButtonAlt');
    const tagsHtml = (sec.tags ?? []).map(tag => {
        const t = normalize(tag, 'heroTag');
        return `<span class="${uid}-tag" style="${textStyle(t)}">${escapeHtml(t.text)}</span>`;
    }).join('');
    const statsHtml = (sec.stats ?? []).map(stat => {
        const v = normalize(stat.v, 'heroStatValue');
        const l = normalize(stat.l, 'heroStatLabel');
        return `<div class="${uid}-stat">`
            + `<div class="${uid}-sv" style="${textStyle(v)}">${escapeHtml(v.text)}</div>`
            + `<div class="${uid}-sl" style="${textStyle(l)}">${escapeHtml(l.text)}</div>`
            + `</div>`;
    }).join('');
    const pT = sec.padTop ?? 48;
    const pB = sec.padBot ?? 48;
    const pL = sec.padLeft ?? 0;
    const pR = sec.padRight ?? 0;
    const b1Href = sec.b1s ? '#' : (sec.b1u || '#');
    const b2Href = sec.b2s ? '#' : (sec.b2u || '#');
    const css = `<style>
.${uid}{font-family:'Poppins',sans-serif;max-width:${sec.maxW || '560px'};padding:${pT}px ${pR}px ${pB}px ${pL}px;box-sizing:border-box;background-color:${sec.bg || '#ffffff'};}
.${uid}-ey{font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#204280;margin-bottom:14px;}
.${uid}-h1{line-height:1.15;margin:0 0 6px;}
.${uid}-h1 em{font-style:normal;color:#204280;}
.${uid}-h2{margin:10px 0 0;line-height:1.35;}
.${uid}-desc{line-height:1.75;margin:20px 0 24px;}
.${uid}-tags{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:28px;}
.${uid}-tag{display:inline-block;padding:6px 16px;border:1.5px solid #cbd5e1;border-radius:999px;font-size:13px;font-weight:500;color:#374151;white-space:nowrap;}
.${uid}-btns{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:32px;}
.${uid}-b1{display:inline-block;padding:12px 26px;background:#204280;color:#fff!important;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none!important;border:none;cursor:pointer;}
.${uid}-b2{display:inline-block;padding:11px 24px;background:#fff;color:#1a1a1a!important;border:1.5px solid #cbd5e1;border-radius:8px;font-size:14px;font-weight:500;text-decoration:none!important;cursor:pointer;}
.${uid}-div{border-top:1px solid #e2e8f0;margin-bottom:28px;}
.${uid}-stats{display:flex;gap:36px;flex-wrap:wrap;}
.${uid}-sv{font-size:26px;font-weight:700;color:#1a1a1a;line-height:1.1;}
.${uid}-sl{font-size:13px;font-weight:400;color:#6b7280;margin-top:4px;}
</style>`;
    const body = `<div class="${uid}">`
        + (eyebrow.text ? `<h2 class="${uid}-ey" style="${textStyle(eyebrow)}">${escapeHtml(eyebrow.text)}</h2>` : '')
        + (h1.text ? `<h1 class="${uid}-h1" style="${textStyle(h1)}">${escapeHtml(h1.text)}`
            + (h1hl.text ? `<br><em style="${textStyle(h1hl)}">${escapeHtml(h1hl.text)}</em>` : '')
            + `</h1>` : '')
        + (h2.text ? `<h2 class="${uid}-h2" style="${textStyle(h2)}">${escapeHtml(h2.text)}</h2>` : '')
        + (desc.text ? `<p class="${uid}-desc" style="${textStyle(desc)}">${desc.text}</p>` : '')
        + (tagsHtml ? `<div class="${uid}-tags">${tagsHtml}</div>` : '')
        + ((b1Text.text || b2Text.text) ? `<div class="${uid}-btns">`
            + (b1Text.text ? `<a href="${b1Href}" class="${uid}-b1" style="${textStyle(b1Text)}">${escapeHtml(b1Text.text)}</a>` : '')
            + (b2Text.text ? `<a href="${b2Href}" class="${uid}-b2" style="${textStyle(b2Text)}">${escapeHtml(b2Text.text)}</a>` : '')
            + `</div>` : '')
        + (statsHtml ? `<div class="${uid}-div"></div><div class="${uid}-stats">${statsHtml}</div>` : '')
        + `</div>`;
    return `<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">\n${css}\n${body}`;
}
