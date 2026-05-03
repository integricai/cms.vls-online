import type { DcsState, Dcs2State, Dcs3State, ReachState, PhbState, Phv2State } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

const e = escapeHtml;

function uid() { return 'vls' + Math.random().toString(36).slice(2, 7); }

function n(v: unknown, key: Parameters<typeof normalize>[1]) {
  return normalize(v as any, key);
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
    L.push(`    <p style="font-family:Poppins,sans-serif;${textStyle(desc)};line-height:1.7;margin:0 0 20px;">${e(desc.text)}</p>`);
  }
  if (d.trustItems.length) {
    L.push(`    <div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;">`);
    d.trustItems.forEach((item, i) => {
      if (i === 0 && item.icon) L.push(`      <span style="color:${e(d.trustDot)};">${e(item.icon)}</span>`);
      else if (i > 0) L.push(`      <span style="color:${e(d.trustDot)};font-size:12px;">·</span>`);
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
