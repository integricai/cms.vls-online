import type { DcsState, Dcs2State, Dcs3State, ReachState, PhbState, Phv2State, Phv3State, BmsState, CbState, Bv2State } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

const e = escapeHtml;

function uid() { return 'vls' + Math.random().toString(36).slice(2, 7); }

function n(v: unknown, key: Parameters<typeof normalize>[1]) {
  return normalize(v as any, key);
}

function jsString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function actionAttrs(url?: string, scroll?: string): string {
  const target = (scroll || url || '#').trim() || '#';
  const href = scroll ? (scroll.startsWith('#') ? scroll : '#') : target;
  const click = scroll
    ? ` onclick="var t=document.querySelector('${jsString(scroll)}');if(t){event.preventDefault();t.scrollIntoView({behavior:'smooth',block:'start'});}"`
    : '';
  return `href="${e(href)}"${click}`;
}

// ── DCS (Two Column v1) ────────────────────────────────────────────────────────

export function generateDcsHtml(d: DcsState): string {
  const id = uid();
  const lLabel = n(d.leftLabel, 'dcsLabel');
  const lTitle = n(d.leftTitle, 'dcsTitle');
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-wrap{flex-direction:column!important;}.${id}-left,.${id}-right{width:100%!important;}}`);
  L.push('</style>');
  L.push(`<div class="${id}-wrap" style="display:flex;width:100%;box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);

  // Left
  L.push(`  <div class="${id}-left" style="width:${d.leftWidth}%;background:${d.leftBg};padding:40px 36px;box-sizing:border-box;">`);
  if (lLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(lLabel)};margin-bottom:12px;text-transform:uppercase;">${e(lLabel.text)}</div>`);
  L.push(`    <h2 style="font-family:Poppins,sans-serif;${textStyle(lTitle)};margin:0 0 20px;">${e(lTitle.text)}</h2>`);
  for (const p of d.leftParas) {
    const para = n(p, 'dcsPara');
    if (para.text) L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(para)};margin:0 0 14px;line-height:1.7;">${e(para.text)}</p>`);
  }
  L.push(`  </div>`);

  // Right
  L.push(`  <div class="${id}-right" style="flex:1;background:${d.rightBg};padding:40px 36px;box-sizing:border-box;">`);
  const rLabel = n(d.rightLabel, 'dcsLabel');
  if (rLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(rLabel)};margin-bottom:20px;text-transform:uppercase;">${e(rLabel.text)}</div>`);
  L.push(`    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;">`);
  for (const card of d.cards) {
    const ct = n(card.title, 'dcsCardTitle');
    const cd = n(card.desc, 'dcsCardDesc');
    L.push(`      <div style="background:${d.cardBg};border-radius:12px;padding:20px;">`);
    L.push(`        <div style="width:40px;height:40px;border-radius:10px;background:${e(card.iconBg)};display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:12px;">${e(card.icon)}</div>`);
    L.push(`        <div style="font-family:Poppins,sans-serif;${textStyle(ct)};margin-bottom:6px;">${e(ct.text)}</div>`);
    L.push(`        <div style="font-family:Poppins,sans-serif;${textStyle(cd)};line-height:1.6;">${e(cd.text)}</div>`);
    L.push(`      </div>`);
  }
  L.push(`    </div>`);
  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── DCS2 (Two Column v2) ───────────────────────────────────────────────────────

export function generateDcs2Html(d: Dcs2State): string {
  const id = uid();
  const cols = Math.min(Math.max(Number(d.statsPerRow) || 2, 1), 4);
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-wrap{flex-direction:column!important;}.${id}-left,.${id}-right{width:100%!important;}}`);
  L.push('</style>');
  L.push(`<div class="${id}-wrap" style="display:flex;width:100%;box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);

  // Left
  const lLabel = n(d.leftLabel, 'dcs2Label');
  const lTitle = n(d.leftTitle, 'dcs2Title');
  L.push(`  <div class="${id}-left" style="width:${d.leftWidth}%;background:${d.leftBg};padding:40px 36px;box-sizing:border-box;">`);
  if (lLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(lLabel)};margin-bottom:12px;text-transform:uppercase;">${e(lLabel.text)}</div>`);
  L.push(`    <h2 style="font-family:Poppins,sans-serif;${textStyle(lTitle)};margin:0 0 20px;">${e(lTitle.text)}</h2>`);
  for (const p of d.leftParas) {
    const para = n(p, 'dcs2Para');
    if (para.text) L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(para)};margin:0 0 14px;line-height:1.7;">${e(para.text)}</p>`);
  }
  if (d.leftBullets?.length) {
    L.push(`    <ul style="list-style:none;padding:0;margin:16px 0 0;">`);
    for (const b of d.leftBullets) {
      const bt = n(b, 'dcs2Bullet');
      if (bt.text) L.push(`      <li style="font-family:Poppins,sans-serif;${textStyle(bt)};padding:6px 0;display:flex;align-items:center;gap:10px;"><span style="width:6px;height:6px;border-radius:50%;background:${e(d.bulletColor)};flex-shrink:0;display:inline-block;"></span>${e(bt.text)}</li>`);
    }
    L.push(`    </ul>`);
  }
  L.push(`  </div>`);

  // Right
  const rLabel = n(d.rightLabel, 'dcs2RLabel');
  L.push(`  <div class="${id}-right" style="flex:1;background:${d.rightBg};padding:40px 36px;box-sizing:border-box;">`);
  if (rLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(rLabel)};margin-bottom:20px;text-transform:uppercase;">${e(rLabel.text)}</div>`);
  L.push(`    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;margin-bottom:24px;">`);
  for (const st of d.stats) {
    const sv = n(st.value, 'dcs2StatVal');
    const sl = n(st.label, 'dcs2StatLbl');
    L.push(`      <div style="background:${d.statBg};border:1px solid ${d.statBorder};border-radius:10px;padding:16px;text-align:center;">`);
    L.push(`        <div style="font-family:Poppins,sans-serif;${textStyle(sv)};">${e(sv.text)}</div>`);
    if (sl.text) L.push(`        <div style="font-family:Poppins,sans-serif;${textStyle(sl)};margin-top:4px;">${e(sl.text)}</div>`);
    L.push(`      </div>`);
  }
  L.push(`    </div>`);
  if (d.quoteShow) {
    const qt = n(d.quoteText, 'dcs2Quote');
    const qa = n(d.quoteAttrib, 'dcs2Attrib');
    L.push(`    <div style="background:${d.quoteBg};border-radius:10px;padding:20px 24px;">`);
    if (qt.text) L.push(`      <p style="font-family:Poppins,sans-serif;${textStyle(qt)};margin:0 0 8px;line-height:1.6;">${e(qt.text)}</p>`);
    if (qa.text) L.push(`      <p style="font-family:Poppins,sans-serif;${textStyle(qa)};margin:0;">${e(qa.text)}</p>`);
    L.push(`    </div>`);
  }
  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── DCS3 (Two Column v3) ───────────────────────────────────────────────────────

export function generateDcs3Html(d: Dcs3State): string {
  const id = uid();
  const featCols = Math.min(Math.max(Number(d.featCols) || 2, 1), 4);
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-wrap{flex-direction:column!important;}.${id}-left,.${id}-right{width:100%!important;}}`);
  L.push('</style>');
  L.push(`<div class="${id}-wrap" style="display:flex;width:100%;box-sizing:border-box;">`);

  // Left
  const lLabel = n(d.leftLabel, 'dcs3Label');
  const lTitle = n(d.leftTitle, 'dcs3Title');
  const lPara  = n(d.leftPara,  'dcs3Para');
  L.push(`  <div class="${id}-left" style="width:${d.leftWidth}%;background:${d.leftBg};padding:${d.padTop}px ${d.leftPadH}px ${d.padBot}px;box-sizing:border-box;">`);
  if (lLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(lLabel)};margin-bottom:12px;text-transform:uppercase;">${e(lLabel.text)}</div>`);
  L.push(`    <h2 style="font-family:Poppins,sans-serif;${textStyle(lTitle)};margin:0 0 16px;">${e(lTitle.text)}</h2>`);
  if (lPara.text) L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(lPara)};margin:0 0 24px;line-height:1.7;">${e(lPara.text)}</p>`);
  if (d.features.length) {
    L.push(`    <div style="display:grid;grid-template-columns:repeat(${featCols},1fr);gap:12px;">`);
    for (const f of d.features) {
      const ft = n(f.title, 'dcs3FeatTitle');
      const fd = n(f.desc,  'dcs3FeatDesc');
      L.push(`      <div style="background:${d.featBg};border-radius:8px;padding:14px 16px;display:flex;align-items:flex-start;gap:10px;">`);
      L.push(`        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="flex-shrink:0;margin-top:2px;"><circle cx="8" cy="8" r="8" fill="${e(d.checkColor)}20"/><path d="M4.5 8L7 10.5L11.5 6" stroke="${e(d.checkColor)}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      L.push(`        <div><div style="font-family:Poppins,sans-serif;${textStyle(ft)};">${e(ft.text)}</div><div style="font-family:Poppins,sans-serif;${textStyle(fd)};margin-top:2px;">${e(fd.text)}</div></div>`);
      L.push(`      </div>`);
    }
    L.push(`    </div>`);
  }
  L.push(`  </div>`);

  // Right
  const rLabel = n(d.rightLabel, 'dcs3RLabel');
  const rTitle = n(d.rightTitle, 'dcs3RTitle');
  const rPara  = n(d.rightPara,  'dcs3RPara');
  const cta    = n(d.ctaText,    'dcs3Cta');
  L.push(`  <div class="${id}-right" style="flex:1;background:${d.rightBg};padding:${d.padTop}px ${d.rightPadH}px ${d.padBot}px;box-sizing:border-box;">`);
  if (rLabel.text) L.push(`    <div style="font-family:Poppins,sans-serif;${textStyle(rLabel)};margin-bottom:12px;text-transform:uppercase;">${e(rLabel.text)}</div>`);
  L.push(`    <h3 style="font-family:Poppins,sans-serif;${textStyle(rTitle)};margin:0 0 16px;">${e(rTitle.text)}</h3>`);
  if (rPara.text) L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(rPara)};margin:0 0 24px;line-height:1.7;">${e(rPara.text)}</p>`);
  if (d.tags.length) {
    L.push(`    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:28px;">`);
    for (const tag of d.tags) {
      const tt = n(tag.text, 'dcs3Tag');
      L.push(`      <span style="background:${d.tagBg};border-radius:999px;padding:6px 14px;font-family:Poppins,sans-serif;${textStyle(tt)};display:flex;align-items:center;gap:6px;">${e(tag.icon)} ${e(tt.text)}</span>`);
    }
    L.push(`    </div>`);
  }
  if (cta.text && d.ctaUrl) {
    L.push(`    <a href="${e(d.ctaUrl)}" style="display:inline-flex;align-items:center;padding:12px 24px;border-radius:8px;border:2px solid ${e(d.ctaBorder)};background:${e(d.ctaFill)};font-family:Poppins,sans-serif;${textStyle(cta)};text-decoration:none;">${e(cta.text)}</a>`);
  }
  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── Global Reach ───────────────────────────────────────────────────────────────
// Layout (matches old CMS):
//   TOP ROW:  [text left (leftWidth%)]  [stats right (flex:1)]
//   FULL-WIDTH image block with dark bg container
//   FULL-WIDTH regions badge row

export function generateReachHtml(d: ReachState): string {
  const id = uid();
  const label = n(d.label, 'reachLabel');
  const title = n(d.title, 'reachTitle');
  const para  = n(d.para,  'reachPara');
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-top{flex-direction:column!important;}.${id}-textcol{width:100%!important;}.${id}-statcol{width:100%!important;}.${id}-stats{flex-direction:column!important;}}`);
  L.push('</style>');

  // Outer wrapper — full background + all padding
  L.push(`<div style="background:${d.bg};box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);

  // ── Top row: text left | stats right ──────────────────────────────────────
  L.push(`  <div class="${id}-top" style="display:flex;gap:40px;align-items:flex-start;margin-bottom:32px;">`);

  // Left: label + title + para
  L.push(`    <div class="${id}-textcol" style="width:${d.leftWidth}%;">`);
  if (label.text) L.push(`      <div style="font-family:Poppins,sans-serif;${textStyle(label)};text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">${e(label.text)}</div>`);
  L.push(`      <h2 style="font-family:Poppins,sans-serif;${textStyle(title)};margin:0 0 16px;">${e(title.text)}</h2>`);
  if (para.text) L.push(`      <p style="font-family:Poppins,sans-serif;${textStyle(para)};line-height:1.7;margin:0;">${e(para.text)}</p>`);
  L.push(`    </div>`);

  // Right: stats in a row
  if (d.stats.length) {
    L.push(`    <div class="${id}-statcol" style="flex:1;">`);
    L.push(`      <div class="${id}-stats" style="display:flex;gap:12px;">`);
    for (const st of d.stats) {
      const sv = n(st.value, 'reachStatVal');
      const sl = n(st.label, 'reachStatLbl');
      L.push(`        <div style="flex:1;background:${d.statBg};border-radius:12px;padding:20px 16px;">`);
      L.push(`          <div style="font-family:Poppins,sans-serif;${textStyle(sv)};line-height:1;">${e(sv.text)}</div>`);
      if (sl.text) L.push(`          <div style="font-family:Poppins,sans-serif;${textStyle(sl)};margin-top:6px;text-transform:uppercase;letter-spacing:0.08em;">${e(sl.text)}</div>`);
      L.push(`        </div>`);
    }
    L.push(`      </div>`);
    L.push(`    </div>`);
  }
  L.push(`  </div>`);

  // ── Full-width image block ─────────────────────────────────────────────────
  if (d.imgUrl || d.imgPlaceholder) {
    L.push(`  <div style="background:${d.imgBg};border-radius:12px;overflow:hidden;margin-bottom:24px;display:flex;align-items:center;justify-content:center;">`);
    if (d.imgUrl) {
      L.push(`    <img src="${e(d.imgUrl)}" alt="${e(d.imgAlt)}" style="width:100%;height:${d.imgHeight}px;object-fit:contain;">`);
    } else {
      L.push(`    <div style="width:100%;height:${d.imgHeight}px;display:flex;align-items:center;justify-content:center;font-family:Poppins,sans-serif;font-size:14px;color:#6b7280;">${e(d.imgPlaceholder)}</div>`);
    }
    L.push(`  </div>`);
  }

  // ── Regions row ────────────────────────────────────────────────────────────
  if (d.regions.length) {
    L.push(`  <div style="display:flex;flex-wrap:wrap;gap:8px;">`);
    for (const r of d.regions) {
      const rn = n(r.name, 'reachRegName');
      const rs = n(r.sub,  'reachRegSub');
      L.push(`    <div style="flex:1;min-width:140px;background:${d.regionBg};border-radius:8px;padding:10px 14px;display:flex;align-items:center;gap:8px;">`);
      L.push(`      <span style="font-size:18px;line-height:1;">${e(r.flag)}</span>`);
      L.push(`      <div><div style="font-family:Poppins,sans-serif;${textStyle(rn)};line-height:1.2;">${e(rn.text)}</div>${rs.text ? `<div style="font-family:Poppins,sans-serif;${textStyle(rs)};line-height:1.2;margin-top:2px;">${e(rs.text)}</div>` : ''}</div>`);
      L.push(`    </div>`);
    }
    L.push(`  </div>`);
  }

  L.push(`</div>`);
  return L.join('\n');
}

// ── Page Hero Banner (PHB) ─────────────────────────────────────────────────────
// Layout: [eyebrow + heading + bullets row] [badge card (optional right)]

export function generatePhbHtml(d: PhbState): string {
  const L: string[] = [];
  const heading   = n(d.heading,   'phbHeading');
  const badgeMain = n(d.badgeMain, 'phbBadgeMain');

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push(`<div style="background:${d.bg};border-radius:${d.radius}px;box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);
  L.push(`  <div style="display:flex;align-items:center;gap:40px;flex-wrap:wrap;">`);

  // Left: eyebrow + heading + bullets
  L.push(`    <div style="flex:1;min-width:240px;">`);
  if (d.eyebrow) {
    L.push(`      <div style="font-family:Poppins,sans-serif;font-size:13px;font-weight:600;color:${e(d.eyebrowTc)};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:8px;">`);
    if (d.showDot) L.push(`        <span style="color:${e(d.dotColor)};">●</span>`);
    L.push(`        ${e(d.eyebrow)}`);
    L.push(`      </div>`);
  }
  L.push(`      <h2 style="font-family:Poppins,sans-serif;${textStyle(heading)};margin:0 0 16px;line-height:1.2;">${e(heading.text)}</h2>`);
  if (d.bullets.length) {
    L.push(`      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;">`);
    d.bullets.forEach((b, i) => {
      if (i > 0) L.push(`        <span style="color:${e(d.sepColor)};font-size:13px;">·</span>`);
      L.push(`        <span style="font-family:Poppins,sans-serif;font-size:14px;color:${e(d.bulletTc)};">${e(b)}</span>`);
    });
    L.push(`      </div>`);
  }
  L.push(`    </div>`);

  // Right: optional badge card
  if (d.showBadge) {
    L.push(`    <div style="background:${d.badgeBg};border-radius:${d.badgeRadius}px;padding:24px 28px;text-align:center;min-width:180px;">`);
    if (d.badgeEyebrow) L.push(`      <div style="font-family:Poppins,sans-serif;font-size:11px;font-weight:600;color:${e(d.badgeEyebrowTc)};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:8px;">${e(d.badgeEyebrow)}</div>`);
    L.push(`      <div style="font-family:Poppins,sans-serif;${textStyle(badgeMain)};line-height:1;">${e(badgeMain.text)}</div>`);
    if (d.badgeSub) L.push(`      <div style="font-family:Poppins,sans-serif;font-size:13px;color:${e(d.badgeSubTc)};margin-top:8px;">${e(d.badgeSub)}</div>`);
    L.push(`    </div>`);
  }

  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── Page Hero Banner V2 (PHV2) ─────────────────────────────────────────────────
// Layout: left text column (split%) | right card grid (flex:1)

export function generatePhv2Html(d: Phv2State): string {
  const id = uid();
  const L: string[] = [];
  const heading = n(d.heading, 'phv2Heading');
  const desc    = n(d.desc,    'phv2Desc');

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-wrap{flex-direction:column!important;}.${id}-left,.${id}-right{width:100%!important;}}`);
  L.push(`.${id}-desc{font-family:Poppins,sans-serif;line-height:1.7;margin:0 0 20px;}`);
  L.push(`.${id}-desc p{margin:0 0 14px;line-height:inherit;}`);
  L.push(`.${id}-desc p:last-child{margin-bottom:0;}`);
  L.push(`.${id}-desc ul{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:10px;}`);
  L.push(`.${id}-desc li{position:relative;display:block;margin:0;padding-left:30px;line-height:1.55;}`);
  L.push(`.${id}-desc li::before{content:"✓";position:absolute;left:0;top:1px;width:20px;height:20px;border-radius:6px;background:rgba(74,144,217,.28);border:1px solid rgba(74,144,217,.32);color:#7dc4ff;display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1;}`);
  L.push(`.${id}-desc strong{display:inline;color:#ffffff;font-weight:600;}`);
  L.push('</style>');
  L.push(`<div class="${id}-wrap" style="display:flex;gap:${d.colGap}px;align-items:flex-start;background:${d.bg};box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);

  // Left column
  L.push(`  <div class="${id}-left" style="width:${d.split}%;min-width:0;">`);
  if (d.breadcrumb) {
    L.push(`    <div style="font-family:Poppins,sans-serif;font-size:13px;color:${e(d.breadcrumbTc)};margin-bottom:16px;">${e(d.breadcrumb)}</div>`);
  }
  if (d.eyebrowLabels.length) {
    L.push(`    <div style="font-family:Poppins,sans-serif;font-size:12px;font-weight:600;color:${e(d.eyebrowTc)};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:8px;">`);
    L.push(`      <span style="color:${e(d.eyebrowDot)};">●</span>`);
    L.push(`      ${d.eyebrowLabels.map(l => e(l)).join(`<span style="color:${e(d.eyebrowDot)};margin:0 4px;">·</span>`)}`);
    L.push(`    </div>`);
  }
  L.push(`    <h1 style="font-family:Poppins,sans-serif;${textStyle(heading)};margin:0 0 16px;line-height:1.2;">`);
  if (heading.text) L.push(`      ${e(heading.text)}`);
  if (d.headingAccent) L.push(`      <span style="color:${e(d.headingAccentColor)};">${e(d.headingAccent)}</span>`);
  if (d.headingPost) L.push(`      ${e(d.headingPost)}`);
  L.push(`    </h1>`);
  if (desc.text) {
    L.push(`    <div class="${id}-desc" style="${textStyle(desc)}">${desc.text}</div>`);
  }
  if (d.trustItems.length) {
    L.push(`    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;">`);
    d.trustItems.forEach((item, i) => {
      if (i > 0) L.push(`      <span style="color:${e(d.trustDot)};font-size:12px;">·</span>`);
      if (item.icon) L.push(`      <span>${e(item.icon)}</span>`);
      L.push(`      <span style="font-family:Poppins,sans-serif;font-size:13px;color:${e(d.trustTc)};">${e(item.text)}</span>`);
    });
    L.push(`    </div>`);
  }
  L.push(`  </div>`);

  // Right column — card grid
  if (d.cards.length) {
    L.push(`  <div class="${id}-right" style="flex:1;">`);
    L.push(`    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">`);
    for (const card of d.cards) {
      const colSpan = card.full ? 'grid-column:1/-1;' : '';
      L.push(`      <div style="${colSpan}background:${d.cardBg};border:1px solid ${d.cardBorder};border-radius:${d.cardRadius}px;padding:16px 20px;">`);
      if (card.type === 'stat') {
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:28px;font-weight:700;color:${e(d.cardVc)};line-height:1;">${e(card.value)}</div>`);
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:11px;font-weight:600;color:${e(d.cardLc)};margin-top:6px;letter-spacing:0.08em;text-transform:uppercase;">${e(card.label)}</div>`);
      } else if (card.type === 'info') {
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:16px;font-weight:700;color:${e(d.cardVc)};margin-bottom:4px;">${e(card.value)}</div>`);
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:12px;color:${e(d.cardLc)};letter-spacing:0.04em;">${e(card.label)}</div>`);
      } else {
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:13px;font-weight:600;color:${e(d.cardVc)};margin-bottom:8px;">${e(card.value)}</div>`);
        L.push(`        <div style="font-family:Poppins,sans-serif;font-size:12px;color:${e(d.cardLc)};line-height:1.6;">${e(card.label)}</div>`);
      }
      L.push(`      </div>`);
    }
    L.push(`    </div>`);
    L.push(`  </div>`);
  }

  L.push(`</div>`);
  return L.join('\n');
}

// ── Page Hero Banner V3 (PHV3) ────────────────────────────────────────────────
// The left rail width controls both the feature chips and exam format box, so the
// exam format right edge aligns with the top "solutions by email" chip.

export function generatePhv3Html(d: Phv3State): string {
  const id = uid();
  const heading = n(d.heading, 'phv2Heading');
  const desc    = n(d.desc,    'phv2Desc');
  const rail = Math.max(420, Number(d.railMaxWidth) || 690);
  const actionWidth = Math.max(360, Number(d.actionMaxWidth) || 520);
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`.${id}-hero{background:linear-gradient(135deg,${e(d.bg)} 0%,#073c77 100%);box-sizing:border-box;min-height:610px;overflow:hidden;position:relative;}`);
  L.push(`.${id}-wrap{display:flex;gap:${d.colGap}px;align-items:flex-start;max-width:1240px;margin:0 auto;box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;}`);
  L.push(`.${id}-left{width:${d.split}%;min-width:0;}`);
  L.push(`.${id}-right{flex:1;min-width:320px;display:flex;justify-content:flex-end;}`);
  L.push(`.${id}-rail{width:100%;max-width:${rail}px;}`);
  L.push(`.${id}-actions{width:100%;max-width:${actionWidth}px;}`);
  L.push(`.${id}-chips{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin:24px 0 28px;}`);
  L.push(`.${id}-chip{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 18px;border-radius:8px;background:${e(d.chipBg)};border:1px solid ${e(d.chipBorder)};color:${e(d.chipTc)};font-family:Poppins,sans-serif;font-size:13px;font-weight:700;box-sizing:border-box;}`);
  L.push(`.${id}-format{width:100%;box-sizing:border-box;background:${e(d.formatBg)};border:1px solid ${e(d.formatBorder)};border-radius:10px;padding:24px 22px 22px;margin-bottom:28px;}`);
  L.push(`.${id}-statgrid{display:grid;grid-template-columns:repeat(${Math.max(1, d.stats.length || 4)},1fr);gap:14px;text-align:center;}`);
  L.push(`.${id}-cta{display:flex;flex-wrap:wrap;gap:12px;}`);
  L.push(`.${id}-card{width:100%;max-width:400px;overflow:hidden;border-radius:18px;background:${e(d.cardBg)};border:1px solid ${e(d.cardBorder)};box-shadow:0 20px 48px rgba(4,27,49,.22);font-family:Poppins,sans-serif;}`);
  L.push(`.${id}-cardhead{position:relative;min-height:118px;background:${e(d.cardHeaderBg)};overflow:hidden;padding:14px 16px;box-sizing:border-box;}`);
  L.push(`.${id}-cardhead:after{content:"";position:absolute;right:-24px;top:-36px;width:124px;height:124px;border-radius:50%;background:rgba(255,255,255,.08);}`);
  L.push(`.${id}-desc p{margin:0 0 12px;line-height:inherit;}.${id}-desc p:last-child{margin-bottom:0;}`);
  L.push(`@media(max-width:900px){.${id}-wrap{flex-direction:column!important;padding-left:22px!important;padding-right:22px!important;}.${id}-left,.${id}-right{width:100%!important;}.${id}-actions{max-width:100%!important;}.${id}-right{justify-content:flex-start;}.${id}-card{max-width:100%;}.${id}-statgrid{grid-template-columns:repeat(2,1fr)!important;}}`);
  L.push(`@media(max-width:520px){.${id}-statgrid{grid-template-columns:1fr!important;}.${id}-cta a{width:100%;justify-content:center;}.${id}-chip{width:100%;}}`);
  L.push('</style>');

  L.push(`<section class="${id}-hero">`);
  L.push(`  <div class="${id}-wrap">`);
  L.push(`    <div class="${id}-left">`);
  if (d.breadcrumb) L.push(`      <div style="font-family:Poppins,sans-serif;font-size:12px;color:rgba(255,255,255,.55);margin-bottom:18px;">${e(d.breadcrumb)}</div>`);
  if (d.eyebrowLabels.length) {
    L.push(`      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;">`);
    for (const label of d.eyebrowLabels) {
      L.push(`        <span style="display:inline-flex;align-items:center;border-radius:999px;background:rgba(74,144,217,.36);border:1px solid rgba(255,255,255,.14);padding:6px 16px;font-family:Poppins,sans-serif;font-size:12px;font-weight:700;color:#b9ddff;">${e(label)}</span>`);
    }
    L.push(`      </div>`);
  }
  L.push(`      <div class="${id}-rail">`);
  L.push(`        <h1 style="font-family:Poppins,sans-serif;${textStyle(heading)};white-space:pre-line;margin:0 0 14px;line-height:1.12;color:${heading.color || '#ffffff'};">${e(heading.text)}</h1>`);
  if (desc.text) L.push(`        <div class="${id}-desc" style="font-family:Poppins,sans-serif;${textStyle(desc)};line-height:1.7;color:${desc.color || '#c8e1f7'};">${e(desc.text)}</div>`);

  if (d.features.length) {
    L.push(`        <div class="${id}-actions">`);
    L.push(`        <div class="${id}-chips">`);
    for (const item of d.features) {
      L.push(`          <span class="${id}-chip"><span>${e(item.icon)}</span><span>${e(item.text)}</span></span>`);
    }
    L.push(`        </div>`);

    L.push(`        <div class="${id}-format">`);
  } else {
    L.push(`        <div class="${id}-actions">`);
    L.push(`        <div class="${id}-format">`);
  }
  L.push(`          <div style="font-family:Poppins,sans-serif;font-size:13px;font-weight:800;color:rgba(255,255,255,.52);letter-spacing:.08em;margin-bottom:18px;">${e(d.formatLabel)}</div>`);
  L.push(`          <div class="${id}-statgrid">`);
  for (const stat of d.stats) {
    L.push(`            <div><div style="font-family:Poppins,sans-serif;font-size:25px;font-weight:800;color:#ffffff;line-height:1;">${e(stat.value)}</div><div style="font-family:Poppins,sans-serif;font-size:10px;font-weight:700;color:rgba(255,255,255,.38);letter-spacing:.05em;margin-top:7px;">${e(stat.label)}</div></div>`);
  }
  L.push(`          </div>`);
  L.push(`        </div>`);

  L.push(`        <div class="${id}-cta">`);
  if (d.primaryText) L.push(`          <a ${actionAttrs(d.primaryUrl, d.primaryScroll)} style="display:inline-flex;align-items:center;justify-content:center;min-width:148px;min-height:50px;border-radius:9px;background:${e(d.primaryBg)};color:${e(d.primaryTc)};font-family:Poppins,sans-serif;font-size:14px;font-weight:800;text-decoration:none;">${e(d.primaryText)}</a>`);
  if (d.secondaryText) L.push(`          <a ${actionAttrs(d.secondaryUrl, d.secondaryScroll)} style="display:inline-flex;align-items:center;justify-content:center;min-width:164px;min-height:50px;border-radius:9px;background:${e(d.secondaryBg)};border:1px solid ${e(d.secondaryBorder)};color:${e(d.secondaryTc)};font-family:Poppins,sans-serif;font-size:14px;font-weight:700;text-decoration:none;">${e(d.secondaryText)}</a>`);
  L.push(`        </div>`);
  L.push(`        </div>`);
  L.push(`      </div>`);
  L.push(`    </div>`);

  L.push(`    <div class="${id}-right">`);
  L.push(`      <aside class="${id}-card">`);
  L.push(`        <div class="${id}-cardhead">`);
  if (d.cardLabel) L.push(`          <span style="position:relative;z-index:1;display:inline-flex;border-radius:999px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.26);padding:6px 13px;font-size:11px;font-weight:800;color:#ffffff;">${e(d.cardLabel)}</span>`);
  L.push(`          <div style="position:relative;z-index:1;text-align:center;margin-top:8px;font-size:56px;line-height:.9;font-weight:800;color:rgba(255,255,255,.18);">${e(d.cardTitle)}</div>`);
  L.push(`        </div>`);
  L.push(`        <div style="padding:24px 24px 22px;">`);
  L.push(`          <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:16px;"><span style="font-size:13px;font-weight:700;color:#8b8f98;">${e(d.cardTop)}</span><span style="font-size:14px;font-weight:800;color:#07172d;">${e(d.cardMarks)}</span></div>`);
  if (d.cardPrimaryText) L.push(`          <a ${actionAttrs(d.cardPrimaryUrl, d.cardPrimaryScroll)} style="display:flex;align-items:center;justify-content:center;min-height:52px;border-radius:9px;background:${e(d.cardButtonBg)};color:#ffffff;font-size:14px;font-weight:800;text-decoration:none;margin-bottom:12px;">${e(d.cardPrimaryText)}</a>`);
  if (d.sampleText) L.push(`          <a ${actionAttrs(d.sampleUrl, d.sampleScroll)} style="display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:9px;background:#f5f7fb;border:1px solid #d9e1ec;color:#2168ad;font-size:13px;font-weight:800;text-decoration:none;margin-bottom:20px;">${e(d.sampleText)}</a>`);
  L.push(`          <div style="height:1px;background:#e7edf5;margin-bottom:16px;"></div>`);
  if (d.includesTitle) L.push(`          <div style="font-size:12px;font-weight:800;color:#9299a4;letter-spacing:.08em;margin-bottom:12px;">${e(d.includesTitle)}</div>`);
  for (const item of d.includes) {
    L.push(`          <div style="display:flex;align-items:center;gap:12px;margin:0 0 12px;"><span style="width:25px;height:25px;border-radius:7px;background:#eaf6ff;display:inline-flex;align-items:center;justify-content:center;font-size:13px;flex-shrink:0;">${e(item.icon)}</span><span style="font-size:13px;color:#455162;"><strong style="color:#07172d;font-weight:800;">${e(item.title)}</strong>${item.desc ? ` ${e(item.desc)}` : ''}</span></div>`);
  }
  if (d.refundText) L.push(`          <div style="margin-top:18px;border-radius:10px;background:#f6f7fb;padding:13px 14px;font-size:11px;line-height:1.55;color:#6d7480;">${e(d.refundText)}</div>`);
  L.push(`        </div>`);
  L.push(`      </aside>`);
  L.push(`    </div>`);
  L.push(`  </div>`);
  L.push(`</section>`);
  return L.join('\n');
}

// ── Book a Meeting Section (BMS) ───────────────────────────────────────────────

export function generateBmsHtml(d: BmsState): string {
  const id = uid();
  const headingPre = n(d.headingPre, 'bmsHeadingPre');
  const desc       = n(d.desc,       'bmsDesc');
  const ctaText    = n(d.ctaText,    'bmsCta');
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`@media(max-width:768px){.${id}-wrap{flex-direction:column!important;}.${id}-left{width:100%!important;min-height:280px;}.${id}-right{padding:40px 24px!important;}}`);
  L.push('</style>');
  L.push(`<div class="${id}-wrap" style="display:flex;align-items:stretch;background:${e(d.bg)};box-sizing:border-box;">`);

  // Left: image
  L.push(`  <div class="${id}-left" style="width:${d.imgSplit}%;overflow:hidden;flex-shrink:0;">`);
  if (d.imgUrl) {
    const fit = d.imgFit || 'cover';
    const pos = d.imgPosition || 'center';
    L.push(`    <img src="${e(d.imgUrl)}" alt="${e(d.imgAlt)}" style="width:100%;height:100%;object-fit:${fit};object-position:${e(pos)};display:block;">`);
  } else {
    L.push(`    <div style="width:100%;height:100%;min-height:400px;background:#e5e7eb;display:flex;align-items:center;justify-content:center;font-family:Poppins,sans-serif;font-size:14px;color:#9ca3af;">Image</div>`);
  }
  L.push(`  </div>`);

  // Right: content
  L.push(`  <div class="${id}-right" style="flex:1;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;box-sizing:border-box;">`);

  // Eyebrow
  if (d.eyebrow) {
    L.push(`    <div style="font-family:Poppins,sans-serif;font-size:13px;font-weight:600;color:${e(d.eyebrowColor)};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:6px;">`);
    if (d.eyebrowDot) L.push(`      <span>●</span>`);
    L.push(`      ${e(d.eyebrow)}`);
    L.push(`    </div>`);
  }

  // Heading
  L.push(`    <h2 style="font-family:Poppins,sans-serif;${textStyle(headingPre)};margin:0 0 16px;line-height:1.25;">`);
  if (headingPre.text) L.push(`      ${e(headingPre.text)}`);
  if (d.headingAccent) L.push(`      <span style="color:${e(d.headingAccentColor)};">${e(d.headingAccent)}</span>`);
  L.push(`    </h2>`);

  // Description
  if (desc.text) {
    L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(desc)};margin:0 0 24px;line-height:1.7;">${e(desc.text)}</p>`);
  }

  // Checklist
  if (d.checks.length) {
    L.push(`    <ul style="list-style:none;padding:0;margin:0 0 28px;">`);
    for (const ch of d.checks) {
      const cht = n(ch.text, 'bmsCheck');
      L.push(`      <li style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">`);
      L.push(`        <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:${e(d.checkColor)}20;display:flex;align-items:center;justify-content:center;">`);
      L.push(`          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="${e(d.checkColor)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      L.push(`        </span>`);
      if (cht.text) L.push(`        <span style="font-family:Poppins,sans-serif;${textStyle(cht)};line-height:1.5;">${e(cht.text)}</span>`);
      L.push(`      </li>`);
    }
    L.push(`    </ul>`);
  }

  // CTA button
  if (ctaText.text && d.ctaUrl) {
    L.push(`    <div style="margin-bottom:16px;">`);
    L.push(`      <a href="${e(d.ctaUrl)}" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:8px;background:${e(d.ctaBg)};color:${e(d.ctaTc)};font-family:Poppins,sans-serif;${textStyle(ctaText)};text-decoration:none;">`);
    L.push(`        ${e(ctaText.text)}`);
    L.push(`        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    L.push(`      </a>`);
    L.push(`    </div>`);
  }

  // Footer note
  if (d.footerNote) {
    L.push(`    <p style="font-family:Poppins,sans-serif;font-size:13px;color:${e(d.footerNoteTc)};margin:0;line-height:1.5;">${e(d.footerNote)}</p>`);
  }

  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── Content CTA Block (CB) — single column, no image ──────────────────────────

export function generateCbHtml(d: CbState): string {
  const id = uid();
  const headingPre = n(d.headingPre, 'bmsHeadingPre');
  const desc       = n(d.desc,       'bmsDesc');
  const ctaText    = n(d.ctaText,    'bmsCta');
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet">');
  L.push(`<div id="${id}" style="background:${e(d.bg)};box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);
  L.push(`  <div style="max-width:${d.maxWidth || 800}px;margin:0 auto;">`);

  if (d.eyebrow) {
    L.push(`    <div style="font-family:Poppins,sans-serif;font-size:13px;font-weight:600;color:${e(d.eyebrowColor)};letter-spacing:0.1em;text-transform:uppercase;margin-bottom:16px;display:flex;align-items:center;gap:6px;">`);
    if (d.eyebrowDot) L.push(`      <span>●</span>`);
    L.push(`      ${e(d.eyebrow)}`);
    L.push(`    </div>`);
  }

  L.push(`    <h2 style="font-family:Poppins,sans-serif;${textStyle(headingPre)};margin:0 0 16px;line-height:1.25;">`);
  if (headingPre.text) L.push(`      ${e(headingPre.text)}`);
  if (d.headingAccent) L.push(`      <span style="color:${e(d.headingAccentColor)};">${e(d.headingAccent)}</span>`);
  L.push(`    </h2>`);

  if (desc.text) {
    L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(desc)};margin:0 0 24px;line-height:1.7;">${e(desc.text)}</p>`);
  }

  if (d.checks.length) {
    L.push(`    <ul style="list-style:none;padding:0;margin:0 0 28px;">`);
    for (const ch of d.checks) {
      const cht = n(ch.text, 'bmsCheck');
      L.push(`      <li style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">`);
      L.push(`        <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:${e(d.checkColor)}20;display:flex;align-items:center;justify-content:center;">`);
      L.push(`          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6L5 9L10 3" stroke="${e(d.checkColor)}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
      L.push(`        </span>`);
      if (cht.text) L.push(`        <span style="font-family:Poppins,sans-serif;${textStyle(cht)};line-height:1.5;">${e(cht.text)}</span>`);
      L.push(`      </li>`);
    }
    L.push(`    </ul>`);
  }

  if (ctaText.text && d.ctaUrl) {
    L.push(`    <div style="margin-bottom:16px;">`);
    L.push(`      <a href="${e(d.ctaUrl)}" style="display:inline-flex;align-items:center;gap:8px;padding:14px 28px;border-radius:8px;background:${e(d.ctaBg)};color:${e(d.ctaTc)};font-family:Poppins,sans-serif;${textStyle(ctaText)};text-decoration:none;">`);
    L.push(`        ${e(ctaText.text)}`);
    L.push(`        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`);
    L.push(`      </a>`);
    L.push(`    </div>`);
  }

  if (d.footerNote) {
    L.push(`    <p style="font-family:Poppins,sans-serif;font-size:13px;color:${e(d.footerNoteTc)};margin:0;line-height:1.5;">${e(d.footerNote)}</p>`);
  }

  L.push(`  </div>`);
  L.push(`</div>`);
  return L.join('\n');
}

// ── Banner V2 (BV2) — single-column process strip ────────────────────────────

export function generateBv2Html(d: Bv2State): string {
  const id = uid();
  const L: string[] = [];

  L.push('<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap" rel="stylesheet">');
  L.push('<style>');
  L.push(`.${id}-steps{display:grid;grid-template-columns:repeat(${Math.max(1, d.steps.length || 4)},minmax(0,1fr));gap:${d.gap}px;}`);
  L.push(`@media(max-width:900px){.${id}-steps{grid-template-columns:repeat(2,minmax(0,1fr))!important;}}`);
  L.push(`@media(max-width:560px){.${id}-steps{grid-template-columns:1fr!important;}}`);
  L.push('</style>');
  L.push(`<section style="background:${e(d.bg)};box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;">`);
  L.push(`  <div style="max-width:${d.maxWidth}px;margin:0 auto;">`);
  if (d.eyebrow) {
    L.push(`    <div style="font-family:Poppins,sans-serif;font-size:12px;font-weight:800;letter-spacing:.12em;color:${e(d.eyebrowColor)};text-transform:uppercase;margin-bottom:28px;">${e(d.eyebrow)}</div>`);
  }
  L.push(`    <div class="${id}-steps">`);
  d.steps.forEach((step, i) => {
    const copy = n(step.desc, 'bmsDesc');
    L.push(`      <div style="display:flex;align-items:flex-start;gap:18px;min-width:0;">`);
    L.push(`        <div style="width:34px;height:34px;border-radius:50%;background:${e(d.numberBg)};color:${e(d.numberTc)};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:Poppins,sans-serif;font-size:13px;font-weight:800;line-height:1;">${e(step.number || String(i + 1))}</div>`);
    L.push(`        <div style="min-width:0;">`);
    L.push(`          <h3 style="font-family:Poppins,sans-serif;font-size:14px;font-weight:800;color:${e(d.titleTc)};line-height:1.35;margin:0 0 6px;">${e(step.title)}</h3>`);
    if (copy.text) L.push(`          <p style="font-family:Poppins,sans-serif;${textStyle(copy)};line-height:1.55;margin:0;">${e(copy.text)}</p>`);
    L.push(`        </div>`);
    L.push(`      </div>`);
  });
  L.push(`    </div>`);
  L.push(`  </div>`);
  L.push(`</section>`);
  return L.join('\n');
}
