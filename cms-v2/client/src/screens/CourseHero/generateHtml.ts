import type { CourseHeroState } from '../../types/cms';
import { normalize, textStyle, escapeHtml } from '../../utils/text';

export interface CourseHeroFaqSchema {
  id?: string;
  items: Array<{ question: string; answer: string }>;
}

function safeHex(v: string | undefined, fallback: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(v ?? '') ? v! : fallback;
}
function clamp(v: number | undefined, def: number, min: number, max: number): number {
  const n = Number(v ?? def);
  return isNaN(n) ? def : Math.min(max, Math.max(min, n));
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function schemaQuestionName(value: string) {
  return value
    .replace(/^\s*(?:\d+[\).\:-]|\(\d+\)|Q\d+[\).\:-]?)\s*/i, '')
    .trim();
}

export function generateCourseHeroSchema(d: CourseHeroState, faq?: CourseHeroFaqSchema): string {
  if (d.schemaEnabled === false) return '';
  const courseName = String(d.schemaCourseName || '').trim();
  const courseUrl = String(d.schemaUrl || '').trim();
  if (!courseName || !courseUrl) return '';

  const graph: any = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        '@id': String(d.schemaCourseId || `${courseUrl.replace(/\/$/, '')}/#course`).trim(),
        name: courseName,
        description: String(d.schemaDescription || '').trim(),
        url: courseUrl,
        provider: {
          '@id': String(d.schemaProviderId || 'https://vls-online.com/#organization').trim(),
        },
        offers: {
          '@type': 'Offer',
          url: courseUrl,
          price: String(d.schemaPrice || '').trim(),
          priceCurrency: String(d.schemaPriceCurrency || 'USD').trim(),
          availability: String(d.schemaAvailability || 'https://schema.org/InStock').trim(),
        },
      },
    ],
  };

  const breadcrumbs = (d.schemaBreadcrumbs || [])
    .filter(item => String(item.name || '').trim() && String(item.item || '').trim())
    .map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: String(item.name || '').trim(),
      item: String(item.item || '').trim(),
    }));

  if (breadcrumbs.length) {
    graph['@graph'].push({
      '@type': 'BreadcrumbList',
      '@id': String(d.schemaBreadcrumbId || `${courseUrl.replace(/\/$/, '')}/#breadcrumb`).trim(),
      itemListElement: breadcrumbs,
    });
  }

  const faqEntities = (faq?.items || [])
    .map(item => ({
      question: schemaQuestionName(String(item.question || '')),
      answer: String(item.answer || '').trim(),
    }))
    .filter(item => item.question && item.answer)
    .map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    }));

  if (faqEntities.length) {
    graph['@graph'].push({
      '@type': 'FAQPage',
      '@id': String(faq?.id || `${courseUrl.replace(/\/$/, '')}/#faq`).trim(),
      mainEntity: faqEntities,
    });
  }

  return `<script type="application/ld+json">
${safeJson(graph)}
</script>`;
}

export function generateCourseHeroHtml(d: CourseHeroState, _faq?: CourseHeroFaqSchema): string {
  const uid = 'ch-' + Date.now().toString(36);
  const bg  = safeHex(d.bg, '#0d1f3c');
  const pT  = clamp(d.padTop,  48, 0, 300);
  const pB  = clamp(d.padBot,  56, 0, 300);
  const pL  = clamp(d.padLeft, 60, 0, 300);
  const pR  = clamp(d.padRight,60, 0, 300);

  const hw = normalize(d.heading, 'chHeading');
  const dw = normalize(d.desc,    'chDesc');

  const eyebrowTc  = safeHex(d.eyebrowTc,  '#4a90d9');
  const eyebrowDot = safeHex(d.eyebrowDot, '#4a90d9');
  const pillBg     = safeHex(d.pillBg,     '#0f2744');
  const pillBorder = safeHex(d.pillBorder, '#1e3a5f');
  const pillVc     = safeHex(d.pillVc,     '#ffffff');
  const pillLc     = safeHex(d.pillLc,     '#94a3b8');
  const learnLabelTc = safeHex(d.learnLabelTc, '#4a90d9');
  const learnBg     = safeHex(d.learnBg,     '#132343');
  const learnBorder = safeHex(d.learnBorder, '#1e3a5f');
  const learnCc     = safeHex(d.learnCc,     '#4a90d9');
  const learnTitleTc = safeHex(d.learnTitleTc, '#ffffff');
  const learnSubTc  = safeHex(d.learnSubTc,  '#f97316');

  const parts: string[] = [];

  if (d.breadcrumb) {
    parts.push(`<p style="font-family:'Poppins',sans-serif;font-size:12px;color:rgba(255,255,255,0.45);margin:0 0 16px;letter-spacing:0.01em;">${escapeHtml(d.breadcrumb)}</p>`);
  }

  const validTags = (d.tags ?? []).filter(Boolean);
  if (validTags.length) {
    const dots = validTags.map(t => `<span>${escapeHtml(t)}</span>`).join('<span style="margin:0 6px;opacity:0.5;"> · </span>');
    parts.push(`<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${eyebrowTc};margin:0 0 14px;display:flex;align-items:center;flex-wrap:wrap;gap:2px;"><span style="color:${eyebrowDot};margin-right:6px;">&#x25CF;</span>${dots}</p>`);
  }

  if (hw.text) {
    const lines = hw.text.split('\n').map(l => escapeHtml(l)).join('<br>');
    parts.push(`<h1 class="${uid}-hd" style="font-family:'Poppins',sans-serif;margin:0 0 18px;line-height:1.15;${textStyle(hw)}">${lines}</h1>`);
  }

  if (dw.text) {
    parts.push(`<p class="${uid}-desc" style="font-family:'Poppins',sans-serif;margin:0 0 28px;line-height:1.75;max-width:640px;${textStyle(dw)}">${dw.text}</p>`);
  }

  const validPills = (d.pills ?? []).filter(p => p.label || p.value);
  if (validPills.length) {
    const pillItems = validPills.map(p => {
      let inner = '';
      if (p.icon)  inner += `<span style="font-size:16px;line-height:1;">${escapeHtml(p.icon)}</span>`;
      if (p.value) inner += `<strong style="font-family:'Poppins',sans-serif;font-weight:700;color:${pillVc};font-size:13px;">${escapeHtml(p.value)}</strong>`;
      if (p.label) inner += `<span style="font-family:'Poppins',sans-serif;color:${pillLc};font-size:13px;">${escapeHtml(p.label)}</span>`;
      return `<div style="display:inline-flex;align-items:center;gap:7px;padding:8px 14px;background:${pillBg};border:1px solid ${pillBorder};border-radius:999px;">${inner}</div>`;
    }).join('\n');
    parts.push(`<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:36px;">\n${pillItems}\n</div>`);
  }

  const validLearnItems = (d.learnItems ?? []).filter(item => item.title);
  if (validLearnItems.length) {
    const cards = validLearnItems.map(item => {
      const span = item.fullWidth ? 'grid-column:1/-1;' : '';
      return `<div style="${span}display:flex;align-items:flex-start;gap:12px;background:${learnBg};border:1px solid ${learnBorder};border-radius:10px;padding:16px 18px;">`
        + `<span style="color:${learnCc};font-size:15px;font-weight:700;flex-shrink:0;margin-top:1px;">&#x2713;</span>`
        + `<div><p style="font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;color:${learnTitleTc};margin:0 0 4px;line-height:1.4;">${escapeHtml(item.title)}</p>`
        + (item.subtitle ? `<p style="font-family:'Poppins',sans-serif;font-size:13px;color:${learnSubTc};margin:0;line-height:1.4;">${escapeHtml(item.subtitle)}</p>` : '')
        + `</div></div>`;
    }).join('\n');
    parts.push(
      `<div>`
      + `<p style="font-family:'Poppins',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${learnLabelTc};margin:0 0 16px;">${escapeHtml(d.learnLabel || "WHAT YOU'LL LEARN")}</p>`
      + `<div class="${uid}-lg" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">\n${cards}\n</div>`
      + `</div>`,
    );
  }

  const css = `<style>
#${uid}{font-family:'Poppins',sans-serif;box-sizing:border-box;}
#${uid} *{box-sizing:border-box;word-break:break-word;overflow-wrap:break-word;}
@media(max-width:767px){
#${uid}{padding-left:20px!important;padding-right:20px!important;padding-top:32px!important;padding-bottom:36px!important;}
#${uid} .${uid}-hd{font-size:clamp(22px,7vw,32px)!important;line-height:1.2!important;}
#${uid} .${uid}-desc{max-width:100%!important;}
#${uid} .${uid}-lg{grid-template-columns:1fr!important;}
}
</style>`;

  return css + `\n<div id="${uid}" style="background:${bg};padding:${pT}px ${pR}px ${pB}px ${pL}px;">\n`
    + parts.join('\n') + '\n</div>';
}
