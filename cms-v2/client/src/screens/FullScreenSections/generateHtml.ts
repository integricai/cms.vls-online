import type { DcsState, Dcs2State, Dcs3State, ReachState, PhbState, Phv2State, Phv3State, BmsState, CbState, Bv2State, TestimonialsState, PaymentPlansState, PaymentPlanCard } from '../../types/cms';
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

// ── Testimonials (TST) — single-column auto-scrolling cards ─────────────────

function tstRating(value: number): number {
  return Math.max(0, Math.min(5, Number(value) || 5));
}

function tstStars(rating: number): string {
  const value = tstRating(rating);
  const width = Math.round((value / 5) * 1000) / 10;
  return `<span class="tst-stars-base">★★★★★</span><span class="tst-stars-fill" style="width:${width}%;">★★★★★</span>`;
}

function tstCleanHtml(value: string): string {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+=(["']).*?\1/gi, '')
    .replace(/\s(?:href|src)=(["'])javascript:[\s\S]*?\1/gi, '');
}

function tstPlainText(value: string): string {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function tstQuoteExcerpt(value: string, charLimit = 250, wordLimit = 10000): { text: string; html: string; truncated: boolean } {
  const plain = tstPlainText(value);
  const words = plain.split(/\s+/).filter(Boolean);
  let text = words.slice(0, wordLimit).join(' ');
  if (text.length > charLimit) text = text.slice(0, charLimit).replace(/\s+\S*$/, '').trim();
  return { text, html: tstCleanHtml(value), truncated: text.length < plain.length };
}

function tstQuoteHtml(value: string, charLimit = 250, wordLimit = 10000): string {
  const excerpt = tstQuoteExcerpt(value, charLimit, wordLimit);
  return excerpt.truncated ? `${e(excerpt.text)}...` : excerpt.html;
}

function tstQuoteReadMore(value: string, charLimit = 250, wordLimit = 10000, readMoreText = 'Read more in Trustpilot'): string {
  return tstQuoteExcerpt(value, charLimit, wordLimit).truncated ? `<span class="__TST_READMORE__">${e(readMoreText)}</span>` : '';
}

function tstCountryFlag(code: string): string {
  const upper = code.toUpperCase().replace(/[^A-Z]/g, '');
  if (upper.length !== 2) return e(code);
  return [...upper].map(c => `&#x${(0x1F1E6 - 65 + c.charCodeAt(0)).toString(16).toUpperCase()};`).join('');
}

function tstFontVars(d: TestimonialsState): string {
  const ff = ((d.fontFamily || 'Poppins') + '').replace(/['"<>]/g, '').trim() || 'Poppins';
  const sz = (v: number | undefined, def: number, max = 96) => `${Math.max(8, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : def))}px`;
  const wt = (v: number | undefined, def: number) => [400, 500, 600, 700, 800, 900].includes(Number(v)) ? String(Number(v)) : String(def);
  return [
    `--tst-ff:'${ff}'`,
    `--tst-eyebrow-sz:${sz(d.eyebrowSize, 12)}`, `--tst-eyebrow-wt:${wt(d.eyebrowWeight, 800)}`,
    `--tst-title-sz:${sz(d.titleSize, 34, 120)}`, `--tst-title-wt:${wt(d.titleWeight, 800)}`,
    `--tst-sub-sz:${sz(d.subtitleSize, 13)}`, `--tst-sub-wt:${wt(d.subtitleWeight, 500)}`,
    `--tst-card-title-sz:${sz(d.cardTitleSize, 15)}`, `--tst-card-title-wt:${wt(d.cardTitleWeight, 800)}`,
    `--tst-quote-sz:${sz(d.quoteSize, 14)}`, `--tst-quote-wt:${wt(d.quoteWeight, 400)}`,
    `--tst-name-sz:${sz(d.nameSize, 13)}`, `--tst-name-wt:${wt(d.nameWeight, 800)}`,
    `--tst-date-sz:${sz(d.dateSize, 11)}`, `--tst-date-wt:${wt(d.dateWeight, 700)}`,
  ].join(';');
}

export function generateTestimonialsHtml(d: TestimonialsState, componentId = ''): string {
  const id = uid();
  const cards = (d.cards || []).filter(card => card.quote || card.name || card.title || card.dateLabel || card.country);
  const url = (d.url || '#').trim() || '#';
  const gap = Math.max(8, Number(d.cardGap) || 18);
  const cardHeight = Math.max(300, Math.min(900, Number(d.cardHeight) || 566));
  const mobileCardHeight = Math.max(300, Math.min(900, cardHeight));
  const quoteCharLimit = Math.max(40, Math.min(1000, Number(d.quoteCutoffChars) || 250));
  const quoteWordLimit = 10000;
  const readMoreLabel = (d.readMoreText || 'Read more in Trustpilot').trim() || 'Read more in Trustpilot';
  const interval = Math.max(1000, Number(d.autoScrollMs) || 4500);
  const L: string[] = [];

  if (!PP_SYSTEM_FONTS.has(d.fontFamily || 'Poppins')) {
    L.push(`<link href="https://fonts.googleapis.com/css2?family=${(d.fontFamily || 'Poppins').replace(/\s+/g, '+')}:wght@400;500;600;700;800&display=swap" rel="stylesheet">`);
  }
  L.push('<style>');
  L.push(`.${id}-outer{${tstFontVars(d)}background:linear-gradient(135deg,${e(d.gradientStart)},${e(d.gradientEnd)});box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;font-family:var(--tst-ff),Arial,sans-serif;overflow:hidden;}`);
  L.push(`.${id}-shell{max-width:${d.maxWidth}px;margin:0 auto;}`);
  L.push(`.${id}-head{text-align:center;margin:0 auto 34px;}`);
  L.push(`.${id}-eyebrow{display:flex;align-items:center;justify-content:center;gap:10px;color:${e(d.eyebrowColor)};font-size:var(--tst-eyebrow-sz);font-weight:var(--tst-eyebrow-wt);letter-spacing:.16em;text-transform:uppercase;margin-bottom:10px;}`);
  L.push(`.${id}-eyebrow:before,.${id}-eyebrow:after{content:"";width:18px;height:1px;background:currentColor;opacity:.42;}`);
  L.push(`.${id}-title{font-size:var(--tst-title-sz);font-weight:var(--tst-title-wt);line-height:1.15;letter-spacing:0;color:${e(d.titleColor)};margin:0 0 8px;}`);
  L.push(`.${id}-title em{font-style:italic;color:${e(d.accentColor)};}`);
  L.push(`.${id}-sub{font-size:var(--tst-sub-sz);font-weight:var(--tst-sub-wt);color:${e(d.subtitleColor)};margin:0;}`);
  L.push(`.${id}-viewport{overflow:hidden;padding:2px 2px 14px;}`);
  L.push(`.${id}-track{display:flex;gap:${gap}px;transition:transform .45s ease;will-change:transform;}`);
  L.push(`.${id}-card{flex:0 0 calc((100% - ${gap * 2}px) / 3);height:${cardHeight}px;max-height:${cardHeight}px;min-width:0;display:flex;flex-direction:column;background:${e(d.cardBg)};border:1px solid ${e(d.cardBorder)};border-radius:${d.cardRadius}px;box-shadow:${e(d.cardShadow)};padding:24px 24px 18px;text-decoration:none!important;color:inherit;box-sizing:border-box;overflow:hidden;}`);
  L.push(`.${id}-card:hover{transform:translateY(-2px);box-shadow:0 16px 34px rgba(28,45,85,.12);}`);
  L.push(`.${id}-stars{position:relative;display:inline-block;font-size:16px;letter-spacing:3px;line-height:1;margin-bottom:14px;color:#ffffff;}`);
  L.push(`.${id}-stars .tst-stars-base{display:block;color:#ffffff;-webkit-text-stroke:1px ${e(d.starColor)};text-stroke:1px ${e(d.starColor)};}`);
  L.push(`.${id}-stars .tst-stars-fill{position:absolute;left:0;top:0;overflow:hidden;white-space:nowrap;color:${e(d.starColor)};}`);
  L.push(`.${id}-card-title{font-size:var(--tst-card-title-sz);font-weight:var(--tst-card-title-wt);line-height:1.35;color:${e(d.cardTitleColor)};margin:0 0 10px;}`);
  L.push(`.${id}-quote{position:relative;flex:1 1 auto;min-height:0;overflow:hidden;color:${e(d.quoteColor)};font-size:var(--tst-quote-sz);font-weight:var(--tst-quote-wt);line-height:1.65;margin:0 0 10px;}`);
  L.push(`.${id}-quote p{margin:0 0 10px;}.${id}-quote p:last-child{margin-bottom:0;}.${id}-quote strong,.${id}-quote b{font-weight:800;}.${id}-quote em,.${id}-quote i{font-style:italic;}`);
  L.push(`.${id}-quote:after{content:"\\201C";position:absolute;right:0;top:-28px;color:${e(d.quoteMarkColor)};font-size:58px;font-weight:800;line-height:1;opacity:.75;}`);
  L.push(`.${id}-readmore{display:inline-block;flex:0 0 auto;margin:0 0 12px;color:#003087;font-size:var(--tst-quote-sz);font-weight:800;line-height:1.35;text-decoration:underline;text-underline-offset:2px;}`);
  L.push(`.${id}-person{border-top:1px solid #e7edf7;padding-top:14px;margin-top:0;flex:0 0 auto;display:flex;align-items:flex-end;justify-content:space-between;gap:12px;}`);
  L.push(`.${id}-person-main{display:flex;align-items:center;gap:11px;min-width:0;}`);
  L.push(`.${id}-avatar{width:34px;height:34px;border-radius:999px;background:${e(d.avatarBg)};color:${e(d.avatarColor)};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;}`);
  L.push(`.${id}-name{font-size:var(--tst-name-sz);font-weight:var(--tst-name-wt);line-height:1.2;color:${e(d.nameColor)};}`);
  L.push(`.${id}-date{display:flex;align-items:center;gap:5px;font-size:var(--tst-date-sz);font-weight:var(--tst-date-wt);line-height:1.2;color:${e(d.dateColor)};margin-top:3px;}`);
  L.push(`.${id}-date svg{width:12px;height:12px;flex-shrink:0;}`);
  L.push(`.${id}-country{display:flex;align-items:center;line-height:1;white-space:nowrap;font-size:20px;}`);
  L.push(`.${id}-controls{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:18px;}`);
  L.push(`.${id}-btn{width:38px;height:38px;border-radius:999px;border:1px solid #e1e9f6;background:#fff;color:#11244a;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 7px 18px rgba(28,45,85,.1);font-size:20px;line-height:1;}`);
  L.push(`.${id}-dots{display:flex;align-items:center;gap:8px;}`);
  L.push(`.${id}-dot{width:7px;height:7px;border-radius:999px;background:#cfd9e8;}`);
  L.push(`.${id}-dot.is-active{width:22px;background:${e(d.accentColor)};}`);
  L.push(`@media(max-width:900px){.${id}-card{flex-basis:calc((100% - ${gap}px) / 2);}}`);
  L.push(`@media(max-width:640px){.${id}-outer{padding-left:18px!important;padding-right:18px!important;}.${id}-title{font-size:28px;}.${id}-card{flex-basis:100%;height:${mobileCardHeight}px;max-height:${mobileCardHeight}px;}}`);
  L.push('</style>');
  L.push(`<section id="${id}" class="${id}-outer" data-testimonials-component="${e(componentId)}">`);
  L.push(`  <div class="${id}-shell">`);
  L.push(`    <div class="${id}-head">`);
  if (d.eyebrow) L.push(`      <div class="${id}-eyebrow">${e(d.eyebrow)}</div>`);
  L.push(`      <h2 class="${id}-title">${e(d.titlePre)}${d.titleAccent ? ` <em>${e(d.titleAccent)}</em>` : ''}</h2>`);
  if (d.subtitle) L.push(`      <p class="${id}-sub">${e(d.subtitle)}</p>`);
  L.push(`    </div>`);
  L.push(`    <div class="${id}-viewport">`);
  L.push(`      <div class="${id}-track">`);
  cards.forEach(card => {
    const cardUrl = (card.url || url).trim() || '#';
    L.push(`        <a class="${id}-card" href="${e(cardUrl)}" target="_blank" rel="nofollow noopener">`);
    L.push(`          <div class="${id}-stars" aria-label="${e(String(tstRating(card.rating)))} out of 5 stars">${tstStars(card.rating)}</div>`);
    if (card.title) L.push(`          <h3 class="${id}-card-title">${e(card.title)}</h3>`);
    L.push(`          <div class="${id}-quote">${tstQuoteHtml(card.quote, quoteCharLimit, quoteWordLimit)}</div>`);
    const readMore = tstQuoteReadMore(card.quote, quoteCharLimit, quoteWordLimit, readMoreLabel).replace(/__TST_READMORE__/g, `${id}-readmore`);
    if (readMore) L.push(`          ${readMore}`);
    L.push(`          <div class="${id}-person"><div class="${id}-person-main"><div class="${id}-avatar">${e(card.initials || (card.name || 'ST').slice(0, 2).toUpperCase())}</div><div><div class="${id}-name">${e(card.name)}</div><div class="${id}-date"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 2v3M11 2v3M3 6.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>${e(card.dateLabel)}</div></div></div>${card.country ? `<div class="${id}-country" aria-label="${e(card.country)}">${tstCountryFlag(card.country)}</div>` : ''}</div>`);
    L.push(`        </a>`);
  });
  L.push(`      </div>`);
  L.push(`    </div>`);
  L.push(`    <div class="${id}-controls" aria-label="Testimonials controls">`);
  L.push(`      <button class="${id}-btn" type="button" data-dir="-1" aria-label="Previous testimonial">&#8249;</button>`);
  L.push(`      <div class="${id}-dots"></div>`);
  L.push(`      <button class="${id}-btn" type="button" data-dir="1" aria-label="Next testimonial">&#8250;</button>`);
  L.push(`    </div>`);
  L.push(`  </div>`);
  L.push(`</section>`);
  L.push(`<script type="text/javascript">(function(){var root=document.getElementById(${JSON.stringify(id)});if(!root)return;var track=root.querySelector(".${id}-track"),dots=root.querySelector(".${id}-dots"),idx=0,timer=null,delay=${interval},CID=${JSON.stringify(componentId)},QCH=${quoteCharLimit},QWD=${quoteWordLimit},RML=${JSON.stringify(readMoreLabel)},API="https://api.cms.vls-online.com/api/publish-testimonials-components";function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}function cleanHtml(s){return String(s==null?"":s).replace(/<script[\\s\\S]*?<\\/script>/gi,"").replace(/\\son\\w+=(["']).*?\\1/gi,"").replace(/\\s(?:href|src)=(["'])javascript:[\\s\\S]*?\\1/gi,"");}function plain(s){var el=document.createElement("div");el.innerHTML=String(s||"");return (el.textContent||el.innerText||"").replace(/\\s+/g," ").trim();}function excerpt(s){var text=plain(s),words=text.split(/\\s+/).filter(Boolean),out=words.slice(0,QWD).join(" ");if(out.length>QCH)out=out.slice(0,QCH).replace(/\\s+\\S*$/,"").trim();return{text:text,out:out,long:out.length<text.length};}function quoteHtml(s){var x=excerpt(s);return x.long?esc(x.out)+'...':cleanHtml(s);}function readMore(s){return excerpt(s).long?'<span class="${id}-readmore">'+esc(RML)+'</span>':'';}function flag(code){var u=String(code||'').toUpperCase().replace(/[^A-Z]/g,'');if(u.length!==2)return esc(code);return u.split('').map(function(c){return'&#x'+(0x1F1E6-65+c.charCodeAt(0)).toString(16).toUpperCase()+';';}).join('');}function cards(){return [].slice.call(root.querySelectorAll(".${id}-card"));}function perView(){if(window.matchMedia("(max-width:640px)").matches)return 1;if(window.matchMedia("(max-width:900px)").matches)return 2;return 3;}function maxIdx(){return Math.max(0,cards().length-perView());}function render(){var list=cards();idx=Math.max(0,Math.min(idx,maxIdx()));if(list[0]){var left=list[idx].offsetLeft-list[0].offsetLeft;track.style.transform="translateX("+(-left)+"px)";}var pages=maxIdx()+1;dots.innerHTML="";for(var i=0;i<pages;i++){var dot=document.createElement("span");dot.className="${id}-dot"+(i===idx?" is-active":"");dot.addEventListener("click",(function(n){return function(){idx=n;render();restart();};})(i));dots.appendChild(dot);}}function move(n){idx=maxIdx()?((idx+n+maxIdx()+1)%(maxIdx()+1)):0;render();}function restart(){clearInterval(timer);if(cards().length>perView())timer=setInterval(function(){move(1);},delay);}function rating(n){return Math.max(0,Math.min(5,Number(n)||5));}function stars(n){var w=Math.round((rating(n)/5)*1000)/10;return '<span class="tst-stars-base">★★★★★</span><span class="tst-stars-fill" style="width:'+w+'%;">★★★★★</span>';}function calendar(){return '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="10" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M5 2v3M11 2v3M3 6.5h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';}function cardHtml(c,url){var initials=c.initials||String(c.name||"ST").slice(0,2).toUpperCase(),date=c.dateLabel||c.course||"",href=(c.url||url||"#"),country=String(c.country||"").toUpperCase(),quote=String(c.quote||"");return '<a class="${id}-card" href="'+esc(href)+'" target="_blank" rel="nofollow noopener"><div class="${id}-stars" aria-label="'+esc(rating(c.rating))+' out of 5 stars">'+stars(c.rating)+'</div>'+(c.title?'<h3 class="${id}-card-title">'+esc(c.title)+'</h3>':'')+'<div class="${id}-quote">'+quoteHtml(quote)+'</div>'+readMore(quote)+'<div class="${id}-person"><div class="${id}-person-main"><div class="${id}-avatar">'+esc(initials)+'</div><div><div class="${id}-name">'+esc(c.name||"")+'</div><div class="${id}-date">'+calendar()+esc(date)+'</div></div></div>'+(country?'<div class="${id}-country" aria-label="'+esc(country)+'">'+flag(country)+'</div>':'')+'</div></a>';}function setText(sel,value){var el=root.querySelector(sel);if(el)el.textContent=value||"";}function applyData(data){if(!data||!track)return;var nextCards=Array.isArray(data.cards)?data.cards.filter(function(c){return c&&(c.quote||c.name||c.title||c.dateLabel||c.course||c.country);}):[];var url=(data.url||"#").trim()||"#";if(data.gradientStart&&data.gradientEnd)root.style.background="linear-gradient(135deg,"+data.gradientStart+","+data.gradientEnd+")";setText(".${id}-eyebrow",data.eyebrow);var title=root.querySelector(".${id}-title");if(title)title.innerHTML=esc(data.titlePre||"")+(data.titleAccent?' <em>'+esc(data.titleAccent)+'</em>':"");setText(".${id}-sub",data.subtitle);if(nextCards.length){track.innerHTML=nextCards.map(function(c){return cardHtml(c,url);}).join("");idx=0;render();restart();}}root.querySelectorAll("[data-dir]").forEach(function(btn){btn.addEventListener("click",function(){move(Number(btn.getAttribute("data-dir"))||1);restart();});});root.addEventListener("mouseenter",function(){clearInterval(timer);});root.addEventListener("mouseleave",restart);window.addEventListener("resize",function(){render();restart();});render();restart();if(CID){fetch(API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("VLS Testimonials API returned "+r.status);return r.json();}).then(function(data){var cmp=(data.components||[]).find(function(x){return x.id===CID;});if(cmp&&cmp.data)applyData(cmp.data);}).catch(function(e){console.error("VLS Testimonials ["+CID+"]:",e.message||e);});}})();<\/script>`);

  return L.join('\n');
}

// ── Payment Plans (PP) — live cards connected to Global Course Prices ─────────

function ppMoney(value: number): string {
  const rounded = Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function ppCardCalc(card: { regularPrice: number; discountPercent: number }) {
  const regular = Math.max(0, Number(card.regularPrice) || 0);
  const discount = Math.max(0, Math.min(100, Number(card.discountPercent) || 0));
  const saving = regular * (discount / 100);
  return { regular, discount, saving, final: Math.max(0, regular - saving), hasDiscount: discount > 0 && saving > 0 };
}

function ppText(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

const PP_SYSTEM_FONTS = new Set(['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New', 'Impact']);

function ppFontVars(card: PaymentPlanCard): string {
  const ff = ((card.fontFamily || 'Poppins') + '').replace(/['"<>]/g, '').trim() || 'Poppins';
  const sz = (v: number | undefined, def: number) => `${Math.max(8, Math.min(80, Number.isFinite(Number(v)) ? Number(v) : def))}px`;
  const wt = (v: number | undefined, def: number) => [400, 500, 600, 700, 800, 900].includes(Number(v)) ? String(Number(v)) : String(def);
  return [
    `--pp-ff:'${ff}'`,
    `--pp-lbl-sz:${sz(card.labelSize, 12)}`, `--pp-lbl-wt:${wt(card.labelWeight, 800)}`,
    `--pp-ttl-sz:${sz(card.titleSize, 16)}`, `--pp-ttl-wt:${wt(card.titleWeight, 800)}`,
    `--pp-reg-sz:${sz(card.regularPriceSize, 14)}`, `--pp-reg-wt:${wt(card.regularPriceWeight, 400)}`,
    `--pp-disc-sz:${sz(card.discountBadgeSize, 11)}`, `--pp-disc-wt:${wt(card.discountBadgeWeight, 800)}`,
    `--pp-plbl-sz:${sz(card.priceLabelSize, 11)}`, `--pp-plbl-wt:${wt(card.priceLabelWeight, 800)}`,
    `--pp-amt-sz:${sz(card.amountSize, 46)}`,
    `--pp-feat-sz:${sz(card.featureSize, 14)}`, `--pp-feat-wt:${wt(card.featureWeight, 400)}`,
    `--pp-cta-sz:${sz(card.ctaSize, 15)}`, `--pp-cta-wt:${wt(card.ctaWeight, 800)}`,
    `--pp-rfnd-sz:${sz(card.refundSize, 12)}`, `--pp-rfnd-wt:${wt(card.refundWeight, 400)}`,
    `--pp-badge-sz:${sz(card.badgeSize, 10)}`, `--pp-badge-wt:${wt(card.badgeWeight, 800)}`,
  ].join(';');
}

export function generatePaymentPlansHtml(d: PaymentPlansState, componentId = ''): string {
  const id = uid();
  const cards = (d.cards || []).filter(card => ppText(card.title).trim() || ppText(card.label).trim());
  const included = (d.includedItems || []).filter(item => ppText(item.text).trim());
  const L: string[] = [];

  // Load Google Fonts for all unique non-system font families used across cards
  const fontFamilies = new Set<string>();
  cards.forEach(card => {
    const ff = ((card.fontFamily || 'Poppins') + '').replace(/['"<>]/g, '').trim();
    if (ff) fontFamilies.add(ff);
  });
  if (!fontFamilies.size) fontFamilies.add('Poppins');
  fontFamilies.forEach(ff => {
    if (!PP_SYSTEM_FONTS.has(ff)) {
      L.push(`<link href="https://fonts.googleapis.com/css2?family=${ff.replace(/\s+/g, '+')}:wght@400;500;600;700;800&display=swap" rel="stylesheet">`);
    }
  });
  L.push('<style>');
  L.push(`.${id}-outer{background:${e(d.bg)};box-sizing:border-box;padding:${d.padTop}px ${d.padRight}px ${d.padBot}px ${d.padLeft}px;font-family:Poppins,Arial,sans-serif;}`);
  L.push(`.${id}-shell{max-width:${d.maxWidth}px;margin:0 auto;background:${e(d.sectionBg)};border:1px solid ${e(d.border)};border-radius:${d.radius}px;overflow:hidden;box-shadow:0 14px 36px rgba(15,23,42,.05);}`);
  L.push(`.${id}-head{padding:34px 44px 28px;border-bottom:1px solid ${e(d.border)};}`);
  L.push(`.${id}-eyebrow{font-size:12px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:${e(d.eyebrowColor)};display:flex;align-items:center;gap:9px;margin-bottom:12px;}`);
  L.push(`.${id}-eyebrow:before{content:"";width:6px;height:6px;border-radius:999px;background:${e(d.eyebrowColor)};}`);
  L.push(`.${id}-title{font-size:25px;font-weight:800;line-height:1.2;color:#111827;margin:0 0 10px;letter-spacing:0;}`);
  L.push(`.${id}-desc{font-size:15px;line-height:1.65;color:#4b5563;margin:0;max-width:860px;}`);
  L.push(`.${id}-cards{display:grid;grid-template-columns:repeat(${Math.max(1, cards.length || 3)},minmax(0,1fr));gap:18px;padding:34px 44px;}`);
  L.push(`.${id}-card{position:relative;display:flex;flex-direction:column;min-height:350px;border:1px solid #e3e5e8;border-top:3px solid var(--pp-accent,#204280);border-radius:14px;background:#fff;padding:24px 26px 22px;box-sizing:border-box;font-family:var(--pp-ff,'Poppins'),Arial,sans-serif;}`);
  L.push(`.${id}-card.is-featured{border-color:var(--pp-accent,#204280);box-shadow:0 10px 28px rgba(32,66,128,.09);}`);
  L.push(`.${id}-badge{position:absolute;top:-1px;right:22px;background:var(--pp-accent,#204280);color:#fff;border-radius:0 0 7px 7px;padding:6px 12px;font-size:var(--pp-badge-sz,10px);font-weight:var(--pp-badge-wt,800);letter-spacing:.08em;text-transform:uppercase;}`);
  L.push(`.${id}-label{font-size:var(--pp-lbl-sz,12px);font-weight:var(--pp-lbl-wt,800);letter-spacing:.12em;text-transform:uppercase;color:#374151;margin:2px 0 10px;}`);
  L.push(`.${id}-name{font-size:var(--pp-ttl-sz,16px);font-weight:var(--pp-ttl-wt,800);line-height:1.35;color:#111827;min-height:44px;margin:0 0 20px;}`);
  L.push(`.${id}-rule{height:1px;background:#e4e4e4;margin:0 0 20px;}`);
  L.push(`.${id}-discount-row{display:flex;align-items:center;gap:9px;min-height:24px;margin-bottom:6px;}`);
  L.push(`.${id}-regular{font-size:var(--pp-reg-sz,14px);font-weight:var(--pp-reg-wt,400);color:#4b5563;text-decoration:line-through;text-decoration-thickness:1.4px;}`);
  L.push(`.${id}-discount{display:inline-flex;align-items:center;justify-content:center;border:1px solid #a7d8bb;background:#e9f8ef;color:#006b3c;border-radius:999px;min-width:82px;padding:3px 10px;font-size:var(--pp-disc-sz,11px);font-weight:var(--pp-disc-wt,800);}`);
  L.push(`.${id}-price-label{font-size:var(--pp-plbl-sz,11px);font-weight:var(--pp-plbl-wt,800);letter-spacing:.1em;color:#4b5563;text-transform:uppercase;margin:0 0 3px;}`);
  L.push(`.${id}-price{display:flex;align-items:flex-start;color:#0f1d3d;margin-bottom:28px;}`);
  L.push(`.${id}-curr{font-size:18px;font-weight:800;line-height:1;margin-top:22px;margin-right:5px;}`);
  L.push(`.${id}-amount{font-size:var(--pp-amt-sz,46px);font-weight:800;line-height:1;letter-spacing:0;}`);
  L.push(`.${id}-feature{display:flex;align-items:flex-start;gap:10px;color:#4b5563;font-size:var(--pp-feat-sz,14px);font-weight:var(--pp-feat-wt,400);line-height:1.45;margin:0 0 24px;}`);
  L.push(`.${id}-feature:before{content:"";width:6px;height:6px;border-radius:999px;background:#c9c9c9;flex-shrink:0;margin-top:8px;}`);
  L.push(`.${id}-cta{display:flex;align-items:center;justify-content:center;min-height:46px;border-radius:9px;text-decoration:none;font-size:var(--pp-cta-sz,15px);font-weight:var(--pp-cta-wt,800);margin-top:auto;}`);
  L.push(`.${id}-cta.solid{background:var(--pp-accent,#204280);border:1px solid var(--pp-accent,#204280);color:#fff;}`);
  L.push(`.${id}-cta.outline{background:#f7f6f0;border:1px solid #d8d5cc;color:var(--pp-accent,#204280);}`);
  L.push(`.${id}-refund{text-align:center;margin:14px 0 0;color:#4b5563;font-size:var(--pp-rfnd-sz,12px);font-weight:var(--pp-rfnd-wt,400);line-height:1.45;}`);
  L.push(`.${id}-included{background:${e(d.includedBg)};border-top:1px solid ${e(d.border)};padding:32px 44px 38px;}`);
  L.push(`.${id}-included-title{font-size:13px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:#404040;margin:0 0 24px;}`);
  L.push(`.${id}-included-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px 28px;}`);
  L.push(`.${id}-inc{display:grid;grid-template-columns:30px 1fr;gap:12px;align-items:flex-start;font-size:15px;line-height:1.35;color:#171717;}`);
  L.push(`.${id}-check{width:24px;height:24px;border-radius:7px;background:#e8f4ff;border:1px solid #a8d2fb;color:#1d75bd;display:flex;align-items:center;justify-content:center;font-size:13px;}`);
  L.push(`.${id}-help{display:flex;gap:14px;align-items:flex-start;margin-top:30px;background:#fff;border:1px solid #ddd;border-radius:12px;padding:17px 20px;color:#3f3f3f;font-size:14px;line-height:1.55;}`);
  L.push(`@media(max-width:980px){.${id}-cards{grid-template-columns:1fr!important;}.${id}-included-grid{grid-template-columns:1fr 1fr;}.${id}-head,.${id}-cards,.${id}-included{padding-left:28px;padding-right:28px;}}`);
  L.push(`@media(max-width:620px){.${id}-outer{padding-left:0!important;padding-right:0!important;}.${id}-shell{border-left:0;border-right:0;border-radius:0;}.${id}-head{padding:26px 20px 22px;}.${id}-title{font-size:23px;}.${id}-desc{font-size:14px;}.${id}-cards{padding:24px 20px;gap:16px;}.${id}-card{padding:24px 22px 22px;min-height:0;}.${id}-included{padding:28px 20px 32px;}.${id}-included-grid{grid-template-columns:1fr;gap:16px;}}`);
  L.push('</style>');

  L.push(`<div id="${id}-data" data-payment-plan-component="${e(componentId)}" style="display:none"></div>`);

  L.push(`<section id="${id}-root" class="${id}-outer">`);
  L.push(`  <div class="${id}-shell">`);
  L.push(`    <div class="${id}-head">`);
  if (d.eyebrow) L.push(`      <div class="${id}-eyebrow">${e(d.eyebrow)}</div>`);
  if (d.title) L.push(`      <h2 class="${id}-title">${e(d.title)}</h2>`);
  if (d.desc) L.push(`      <p class="${id}-desc">${e(d.desc)}</p>`);
  L.push(`    </div>`);
  L.push(`    <div class="${id}-cards">`);
  cards.forEach((card, index) => {
    const style = `--pp-accent:${card.accent || '#204280'};${ppFontVars(card)}`;
    const calc = ppCardCalc(card);
    L.push(`      <article class="${id}-card${card.featured ? ' is-featured' : ''}" style="${style}">`);
    if (card.badge) L.push(`        <div class="${id}-badge">${e(card.badge)}</div>`);
    L.push(`        <div class="${id}-label">${e(card.label || `Plan ${index + 1}`)}</div>`);
    L.push(`        <h3 class="${id}-name">${e(card.title)}</h3>`);
    L.push(`        <div class="${id}-rule"></div>`);
    if (calc.hasDiscount) L.push(`        <div class="${id}-discount-row"><span class="${id}-regular">${e(card.currency || '$')}${e(ppMoney(calc.regular))}</span><span class="${id}-discount">Save ${e(ppMoney(calc.discount))}%</span></div>`);
    L.push(`        <div class="${id}-price-label">${e(card.priceLabel || 'YOUR PRICE')}</div>`);
    L.push(`        <div class="${id}-price"><span class="${id}-curr">${e(card.currency || '$')}</span><span class="${id}-amount">${e(ppMoney(calc.final))}</span></div>`);
    if (card.feature) L.push(`        <div class="${id}-feature"><span>${e(card.feature)}</span></div>`);
    L.push(`        <a class="${id}-cta ${card.ctaStyle === 'outline' ? 'outline' : 'solid'}" href="${e(card.ctaUrl || '#')}">${e(card.ctaText || 'Enrol Now →')}</a>`);
    if (card.refundText) L.push(`        <div class="${id}-refund">${e(card.refundText)}</div>`);
    L.push(`      </article>`);
  });
  L.push(`    </div>`);
  if (included.length || d.includedTitle || d.helpText) {
    L.push(`    <div class="${id}-included">`);
    if (d.includedTitle) L.push(`      <h3 class="${id}-included-title">${e(d.includedTitle)}</h3>`);
    if (included.length) {
      L.push(`      <div class="${id}-included-grid">`);
      included.forEach(item => L.push(`        <div class="${id}-inc"><span class="${id}-check">✓</span><span>${e(item.text)}</span></div>`));
      L.push(`      </div>`);
    }
    if (d.helpText) L.push(`      <div class="${id}-help"><span aria-hidden="true">💡</span><span>${e(d.helpText)}</span></div>`);
    L.push(`    </div>`);
  }
  L.push(`  </div>`);
  L.push(`</section>`);

  if (componentId) {
    L.push(`<script type="text/javascript">(function(){var CID=${JSON.stringify(componentId)},ROOT=${JSON.stringify(`${id}-root`)},API="https://api.cms.vls-online.com/api/publish-payment-plan-components";function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}function num(v,f){var n=Number(v);return isFinite(n)?n:f;}function money(v){var n=Math.round(num(v,0)*100)/100;return Math.abs(n%1)<.001?String(Math.round(n)):n.toFixed(2);}function calc(c){var r=Math.max(0,num(c.regularPrice,0)),d=Math.max(0,Math.min(100,num(c.discountPercent,0))),s=r*(d/100);return{regular:r,discount:d,final:Math.max(0,r-s),has:d>0&&s>0};}function cardHtml(c,i){var x=calc(c),curr=esc(c.currency||"$"),accent=esc(c.accent||"#204280"),cls="${id}-card"+(c.featured?" is-featured":"");return '<article class="'+cls+'" style="--pp-accent:'+accent+'">'+(c.badge?'<div class="${id}-badge">'+esc(c.badge)+'</div>':'')+'<div class="${id}-label">'+esc(c.label||("Plan "+(i+1)))+'</div><h3 class="${id}-name">'+esc(c.title||"")+'</h3><div class="${id}-rule"></div>'+(x.has?'<div class="${id}-discount-row"><span class="${id}-regular">'+curr+money(x.regular)+'</span><span class="${id}-discount">Save '+money(x.discount)+'%</span></div>':'')+'<div class="${id}-price-label">'+esc(c.priceLabel||"YOUR PRICE")+'</div><div class="${id}-price"><span class="${id}-curr">'+curr+'</span><span class="${id}-amount">'+money(x.final)+'</span></div>'+(c.feature?'<div class="${id}-feature"><span>'+esc(c.feature)+'</span></div>':'')+'<a class="${id}-cta '+(c.ctaStyle==="outline"?"outline":"solid")+'" href="'+esc(c.ctaUrl||"#")+'">'+esc(c.ctaText||"Enrol Now →")+'</a>'+(c.refundText?'<div class="${id}-refund">'+esc(c.refundText)+'</div>':'')+'</article>';}function render(d){var root=document.getElementById(ROOT);if(!root||!d)return;root.style.background=d.bg||root.style.background;var cards=Array.isArray(d.cards)?d.cards:[],inc=Array.isArray(d.includedItems)?d.includedItems:[];var html='<div class="${id}-shell"><div class="${id}-head">'+(d.eyebrow?'<div class="${id}-eyebrow">'+esc(d.eyebrow)+'</div>':'')+(d.title?'<h2 class="${id}-title">'+esc(d.title)+'</h2>':'')+(d.desc?'<p class="${id}-desc">'+esc(d.desc)+'</p>':'')+'</div><div class="${id}-cards" style="grid-template-columns:repeat('+Math.max(1,cards.length)+',minmax(0,1fr))">'+cards.map(cardHtml).join("")+'</div>';if(inc.length||d.includedTitle||d.helpText){html+='<div class="${id}-included">'+(d.includedTitle?'<h3 class="${id}-included-title">'+esc(d.includedTitle)+'</h3>':'')+(inc.length?'<div class="${id}-included-grid">'+inc.filter(function(x){return x&&x.text;}).map(function(x){return '<div class="${id}-inc"><span class="${id}-check">✓</span><span>'+esc(x.text)+'</span></div>';}).join("")+'</div>':'')+(d.helpText?'<div class="${id}-help"><span aria-hidden="true">💡</span><span>'+esc(d.helpText)+'</span></div>':'')+'</div>';}root.innerHTML=html+'</div>';}function load(){fetch(API+"?t="+Date.now()).then(function(r){if(!r.ok)throw new Error("VLS Payment Plans API returned "+r.status);return r.json();}).then(function(data){var cmp=(data.components||[]).find(function(x){return x.id===CID;});if(cmp&&cmp.data)render(cmp.data);}).catch(function(e){console.error("VLS Payment Plans ["+CID+"]:",e.message||e);});}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",load);else load();})();<\/script>`);
  }

  return L.join('\n');
}
