import type { HeroV2State } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

function safeHex(v: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v! : fallback;
}
function clamp(v: number | undefined, def: number, min: number, max: number): number {
  const n = Number(v ?? def);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}

function buildScrollScript(uid: string): string {
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

function cardType(value: string | undefined): 'stat' | 'info' | 'tags' {
  return value === 'stat' || value === 'tags' ? value : 'info';
}

function splitTags(tags: string[] | undefined, fallback: string | undefined): string[] {
  const explicit = (tags ?? []).map(tag => tag.trim()).filter(Boolean);
  if (explicit.length) return explicit;
  return String(fallback || '')
    .split(/\n|,/)
    .map(tag => tag.trim())
    .filter(Boolean);
}

export function generateHeroV2Html(d: HeroV2State): string {
  const uid    = 'h2-' + Date.now().toString(36);
  const bg     = safeHex(d.bg,       '#0d1f3c');
  const dot    = safeHex(d.dotColor, '#4a90d9');
  const hlc    = safeHex(d.hlColor,  '#4a90d9');
  const tagBg  = safeHex(d.tagBg,    '#1e3550');
  const tagTc  = safeHex(d.tagTc,    '#94a3b8');
  const cardBg = safeHex(d.cardBg,   '#1e3550');
  const lw     = clamp(d.leftW,  55, 35, 70);
  const pT     = clamp(d.padTop, 80, 0, 300);
  const pB     = clamp(d.padBot, 80, 0, 300);
  const pL     = clamp(d.padLeft, 60, 0, 300);
  const pR     = clamp(d.padRight, 60, 0, 300);

  const ew  = normalize(d.eyebrow,   'h2Eyebrow');
  const hw  = normalize(d.heading,   'h2Heading');
  const hlw = normalize(d.highlight, 'h2Highlight');
  const bw  = normalize(d.body,      'h2Body');

  const leftParts: string[] = [];

  // Eyebrow
  if (ew.text) {
    leftParts.push(
      `<p style="font-family:'Poppins',sans-serif;margin:0 0 16px;${textStyle(ew)}display:flex;align-items:center;gap:6px;">`
      + `<span style="width:7px;height:7px;border-radius:50%;background:${dot};display:inline-block;flex-shrink:0;"></span>`
      + escapeHtml(ew.text) + `</p>`,
    );
  }

  // Heading + highlight (last line gets the highlight appended)
  const headingLines = (hw.text || '').split('\n').map(l => escapeHtml(l));
  const lastLine = headingLines.pop() ?? '';
  let headingHtml = headingLines.join('<br>') + (headingLines.length ? '<br>' : '') + lastLine;
  if (hlw.text) headingHtml += ` <span style="color:${hlc};">${escapeHtml(hlw.text)}</span>`;
  leftParts.push(
    `<h1 style="font-family:'Poppins',sans-serif;margin:0 0 20px;line-height:1.15;${textStyle(hw)}">${headingHtml}</h1>`,
  );

  // Body (raw HTML allowed — multiline field)
  if (bw.text) {
    leftParts.push(
      `<p style="font-family:'Poppins',sans-serif;margin:0 0 24px;line-height:1.7;${textStyle(bw)}">${bw.text}</p>`,
    );
  }

  // Tags
  const tags = d.tags ?? [];
  if (tags.length) {
    const tagItems = tags.map(t =>
      `<span style="font-family:'Poppins',sans-serif;font-size:12px;font-weight:500;padding:5px 14px;border-radius:999px;background:${tagBg};color:${tagTc};white-space:nowrap;">${escapeHtml(t)}</span>`,
    ).join('\n    ');
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
    const statItems = stats.map(s =>
      `<div>`
      + `<p style="font-family:'Poppins',sans-serif;font-size:28px;font-weight:700;color:#ffffff;margin:0 0 4px;">${escapeHtml(s.value || '')}</p>`
      + `<p style="font-family:'Poppins',sans-serif;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#64748b;margin:0;">${escapeHtml(s.label || '')}</p>`
      + `</div>`,
    ).join('');
    leftParts.push(`<div style="display:flex;flex-wrap:wrap;gap:28px;">${statItems}</div>`);
  }

  // Right column: stat, info and tags boxes
  const rcards = d.rcards ?? [];
  const rCardsHtml = rcards.map((r, index) => {
    const type = cardType(r.type);
    const ibg = safeHex(r.iconBg, '#1a56a3');
    if (type === 'stat') {
      return `<div style="background:${cardBg};border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:18px 20px;min-height:105px;">`
        + `<p style="font-family:'Poppins',sans-serif;font-size:28px;line-height:1;font-weight:800;color:#ffffff;margin:0 0 12px;">${escapeHtml(r.title || r.count || '')}</p>`
        + `<p style="font-family:'Poppins',sans-serif;font-size:11px;line-height:1.5;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#9bb2ca;margin:0;">${escapeHtml(r.subtitle || '')}</p>`
        + `</div>`;
    }

    if (type === 'tags') {
      const tagsHtml = splitTags(r.tags, r.subtitle).map((tag, tagIndex) =>
        `<div style="display:flex;align-items:center;gap:8px;">`
        + `<span style="width:18px;height:18px;border-radius:4px;background:${ibg};display:inline-flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;font-size:10px;font-weight:700;color:#9bd7ff;flex-shrink:0;">${escapeHtml(String.fromCharCode(65 + (tagIndex % 26)))}</span>`
        + `<span style="font-family:'Poppins',sans-serif;font-size:12px;line-height:1.45;color:#c3d0df;">${escapeHtml(tag)}</span>`
        + `</div>`,
      ).join('');
      return `<div style="grid-column:1/-1;background:${cardBg};border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:18px 20px;">`
        + `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;color:#5fb3e7;margin:0 0 12px;">${escapeHtml(r.title || '')}</p>`
        + `<div style="display:grid;gap:7px;">${tagsHtml}</div>`
        + `</div>`;
    }

    const badge = (r.icon || String(index + 1)).trim();
    const content = `<div style="display:flex;align-items:flex-start;gap:14px;background:${cardBg};border-radius:8px;padding:16px 18px;text-decoration:none;border:1px solid rgba(255,255,255,0.08);grid-column:1/-1;">`
      + `<div style="width:28px;height:28px;min-width:28px;border-radius:999px;background:${ibg};display:flex;align-items:center;justify-content:center;font-family:'Poppins',sans-serif;font-size:13px;font-weight:800;color:#ffffff;">${escapeHtml(badge)}</div>`
      + `<div style="flex:1;min-width:0;">`
      + `<p style="font-family:'Poppins',sans-serif;font-weight:800;font-size:13px;line-height:1.35;color:#ffffff;margin:0 0 4px;">${escapeHtml(r.title || '')}</p>`
      + `<p style="font-family:'Poppins',sans-serif;font-size:12px;line-height:1.55;color:#9bb2ca;margin:0;">${escapeHtml(r.subtitle || '')}</p>`
      + `</div>`
      + (r.count ? `<span style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:600;color:#ffffff;background:rgba(255,255,255,0.12);border-radius:999px;padding:3px 10px;white-space:nowrap;">${escapeHtml(r.count)}</span>` : '')
      + `</div>`;
    return r.url && r.url !== '#'
      ? `<a href="${escapeHtml(r.url)}" style="display:block;text-decoration:none;grid-column:1/-1;">${content}</a>`
      : content;
  }).join('\n    ');

  const css = `<style>`
    + `#${uid}{font-family:'Poppins',sans-serif;}`
    + `#${uid} *{box-sizing:border-box;}`
    + `#${uid} .h2-body{display:flex;flex-wrap:wrap;gap:40px;align-items:center;}`
    + `#${uid} .h2-left{flex:0 0 ${lw}%;min-width:280px;}`
    + `#${uid} .h2-right{flex:1;min-width:260px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;}`
    + `@media(max-width:768px){`
    + `#${uid} .h2-left{flex:none;width:100%;}`
    + `#${uid} .h2-right{width:100%;grid-template-columns:1fr;}`
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
