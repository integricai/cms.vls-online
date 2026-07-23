import type { ScrapedFaqItem } from '../../shared/migrationTypes';
import type {
  ScrapedLevelPage,
  ScrapedLevelMetaItem,
  ScrapedLevelPaperGroup,
  ScrapedLevelPathwayStep,
  ScrapedLevelRatingBar,
  ScrapedLevelReviewCard,
  LevelStageMode,
  ScrapedLevelWhyItem,
} from '../../shared/levelPageTypes';

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? decodeEntities(stripTags(match[1])) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

function sectionAfterComment(html: string, commentPattern: RegExp): string {
  const match = html.match(commentPattern);
  if (match?.index == null) return '';
  return html.slice(match.index);
}

function splitHeading(html: string): { prefix: string; accent: string } {
  const heading = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '';
  const accentMatch = heading.match(/<span class="accent"[^>]*>([\s\S]*?)<\/span>/i);
  if (!accentMatch) return { prefix: stripTags(heading), accent: '' };
  const accent = stripTags(accentMatch[1]);
  const prefix = stripTags(heading.replace(accentMatch[0], '')).replace(/\s+$/, '');
  return { prefix, accent };
}

function parseSecHead(sectionHtml: string): { eyebrow: string; prefix: string; accent: string } {
  const slice = sectionHtml.match(/<div class="sec-head"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? sectionHtml;
  const eyebrow = firstMatch(slice, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i);
  const heading = splitHeading(slice);
  return { eyebrow, prefix: heading.prefix, accent: heading.accent };
}

function parseBreadcrumbs(html: string) {
  const block = html.match(/<div class="wrap crumb"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  return allMatches(block, /<li[^>]*>([\s\S]*?)<\/li>/gi).map((match) => {
    const inner = match[1];
    const link = inner.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
    if (link) return { label: stripTags(link[2]), url: link[1].trim() };
    return { label: stripTags(inner), url: '' };
  }).filter(item => item.label);
}

function parseMetaItems(heroHtml: string): ScrapedLevelMetaItem[] {
  const row = heroHtml.match(/<div class="meta-row"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  return allMatches(row, /<span class="meta-item"[^>]*>([\s\S]*?)<\/span>/gi).map((match) => {
    const inner = match[1];
    const stars = inner.match(/<span class="stars"[^>]*>([\s\S]*?)<\/span>/i);
    if (stars) {
      return {
        showStars: true,
        starsText: stripTags(stars[1]),
        boldText: stripTags(inner.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? ''),
        text: stripTags(inner.replace(stars[0], '').replace(/<b[\s\S]*?<\/b>/i, '')),
        icon: 'none' as const,
      };
    }
    const bold = stripTags(inner.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? '');
    const text = stripTags(inner.replace(/<svg[\s\S]*?<\/svg>/gi, '').replace(/<b[\s\S]*?<\/b>/i, ''));
    let icon: ScrapedLevelMetaItem['icon'] = 'none';
    if (inner.includes('M3 3v18h18')) icon = 'chart';
    else if (inner.includes('rect x="3" y="4"')) icon = 'calendar';
    else if (inner.includes('M12 7v5l3 2')) icon = 'clock';
    else if (inner.includes('M20 6 9 17l-5-5')) icon = 'modules';
    return { showStars: false, starsText: '', boldText: bold, text, icon };
  }).filter(item => item.boldText || item.text || item.starsText);
}

function parseSessionOptions(sideHtml: string) {
  const selector = sideHtml.match(/<div class="session-selector"[^>]*>([\s\S]*?)<\/div>\s*(?:<a class="btn|<div class="includes")/i)?.[1] ?? '';
  if (!selector) return null;
  const label = firstMatch(selector, /<h4 class="session-label"[^>]*>([\s\S]*?)<\/h4>/i);
  const ctaPrefix = sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*data-cta-prefix=["']([^"']*)["']/i)?.[1]?.trim()
    || 'Enrol now';
  const options = allMatches(selector, /<label class="session-option"[^>]*>([\s\S]*?)<\/label>/gi).map((match) => {
    const block = match[0];
    return {
      title: firstMatch(block, /<span class="session-title"[^>]*>([\s\S]*?)<\/span>/i),
      subtitle: firstMatch(block, /<span class="session-subtitle"[^>]*>([\s\S]*?)<\/span>/i),
      price: firstMatch(block, /<span class="session-price"[^>]*>([\s\S]*?)<\/span>/i),
      badge: firstMatch(block, /<span class="session-badge"[^>]*>([\s\S]*?)<\/span>/i),
      ctaSuffix: block.match(/data-cta-suffix=["']([^"']*)["']/i)?.[1]?.trim() ?? '',
      isDefault: /checked/i.test(block),
    };
  }).filter(option => option.title);
  return options.length ? { label, ctaPrefix, options } : null;
}

function parseIncludes(sideHtml: string) {
  const includes = sideHtml.match(/<div class="includes"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  return {
    label: firstMatch(includes, /<h4[^>]*>([\s\S]*?)<\/h4>/i) || 'Every paper includes',
    items: allMatches(includes, /<li[^>]*>([\s\S]*?)<\/li>/gi)
      .map(match => stripTags(match[1].replace(/<span class="ico"[\s\S]*?<\/span>/i, '')))
      .filter(Boolean),
  };
}

function parseSubmeta(sectionHtml: string) {
  const block = sectionHtml.match(/<div class="submeta"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  return allMatches(block, /<span[^>]*>([\s\S]*?)<\/span>/gi).map((match) => {
    const inner = match[1];
    return {
      value: stripTags(inner.match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? ''),
      label: stripTags(inner.replace(/<b[\s\S]*?<\/b>/gi, '')),
    };
  }).filter(item => item.value || item.label);
}

function parsePaperModules(modulesHtml: string) {
  return allMatches(modulesHtml, /<details class="module"([^>]*)>([\s\S]*?)<\/details>/gi).map((match) => {
    const block = match[2];
    const summary = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? '';
    const body = block.match(/<div class="paper-body"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
    const cta = body.match(/<a class="paper-cta"[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
    return {
      code: firstMatch(summary, /<span class="mod-num"[^>]*>([\s\S]*?)<\/span>/i),
      title: firstMatch(summary, /<span class="mod-title"[^>]*>([\s\S]*?)<\/span>/i),
      meta: firstMatch(summary, /<span class="mod-meta"[^>]*>([\s\S]*?)<\/span>/i),
      bodyHtml: body.replace(/<a class="paper-cta"[\s\S]*?<\/a>/i, '').trim(),
      bodyText: stripTags(body.replace(/<a class="paper-cta"[\s\S]*?<\/a>/i, '')),
      ctaText: cta ? stripTags(cta[2]).replace(/\s+/g, ' ') : '',
      ctaUrl: cta?.[1]?.trim() ?? '',
      isOpen: /open/i.test(match[1]),
    };
  }).filter(item => item.title);
}

function parsePaperGroups(papersSection: string): ScrapedLevelPaperGroup[] {
  const wrap = papersSection.match(/<div class="wrap"[^>]*>([\s\S]*?)<\/div>\s*<\/section>/i)?.[1] ?? papersSection;
  const afterHead = wrap.replace(/<div class="sec-head"[\s\S]*?<\/div>/i, '');
  const groups: ScrapedLevelPaperGroup[] = [];
  const parts = afterHead.split(/<div class="group-label"[^>]*>/i);
  if (parts.length === 1) {
    const modules = parsePaperModules(parts[0]);
    if (modules.length) groups.push({ label: '', modules });
    return groups;
  }
  for (let i = 1; i < parts.length; i += 1) {
    const chunk = parts[i];
    const label = firstMatch(`<div>${chunk}`, /^([\s\S]*?)<\/div>/i);
    const modules = parsePaperModules(chunk.replace(/^[\s\S]*?<\/div>/i, ''));
    if (modules.length) groups.push({ label, modules });
  }
  return groups;
}

export function parseLevelPageHtml(html: string, sourceUrl: string, slug: string, title: string): ScrapedLevelPage {
  const heroSection = html.match(/<!-- HERO -->[\s\S]*?<section class="hero"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const heroMain = heroSection.match(/<!-- MAIN -->[\s\S]*?(?=<!-- SIDEBAR -->|<aside)/i)?.[0] ?? heroSection;
  const sideHtml = heroSection.match(/<aside class="side"[^>]*>([\s\S]*?)<\/aside>/i)?.[1] ?? '';
  const byline = heroMain.match(/<div class="byline"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const heroImageBlock = heroMain.match(/<figure class="hero-image"[^>]*>([\s\S]*?)<\/figure>/i)?.[0] ?? '';
  const captionBlock = heroImageBlock.match(/<figcaption class="hi-caption"[^>]*>([\s\S]*?)<\/figcaption>/i)?.[1] ?? '';
  const stageImageUrl = heroImageBlock.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
  const stageMode: LevelStageMode = stageImageUrl ? 'image' : 'none';

  const introSection = sectionAfterComment(html, /<!-- WHAT IS[\s\S]*?-->/i).match(/<section class="section"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const introInner = introSection.match(/<div class="wrap course-intro"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';

  const pathwaySection = sectionAfterComment(html, /<!-- PATHWAY -->/).match(/<section class="section band"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const pathwayHead = parseSecHead(pathwaySection);
  const pathwayGrid = pathwaySection.match(/<div class="path-grid"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? '';
  const pathwaySteps: ScrapedLevelPathwayStep[] = pathwayGrid
    .split(/<div class="path-step"[^>]*>/i)
    .slice(1)
    .map((chunk, index) => {
      const inner = chunk.replace(/\s*<\/div>\s*$/i, '');
      return {
        number: firstMatch(inner, /<div class="p-num"[^>]*>([\s\S]*?)<\/div>/i) || String(index + 1),
        title: firstMatch(inner, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
        body: firstMatch(inner, /<p[^>]*>([\s\S]*?)<\/p>/i),
        tag: firstMatch(inner, /<span class="p-tag"[^>]*>([\s\S]*?)<\/span>/i),
      };
    })
    .filter(step => step.title);

  const papersSection = html.match(/<!-- THE [\s\S]*?PAPERS -->[\s\S]*?<section class="section"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const papersHead = parseSecHead(papersSection);
  const whySection = sectionAfterComment(html, /<!-- WHY VLS -->/).match(/<section class="section band"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const whyHead = parseSecHead(whySection);
  const whyItems: ScrapedLevelWhyItem[] = (whySection.match(/<div class="learn-grid"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? '')
    .split(/<div class="learn-item"[^>]*>/i)
    .slice(1)
    .map((chunk) => {
      const inner = chunk.replace(/\s*<\/div>\s*$/i, '');
      const paragraph = inner.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1]?.trim() ?? '';
      return { html: paragraph, text: stripTags(paragraph) };
    })
    .filter(item => item.text);

  const reviewsSection = sectionAfterComment(html, /<!-- STUDENT REVIEWS -->/).match(/<section class="section"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const reviewsHead = parseSecHead(reviewsSection);
  const scoreCard = reviewsSection.match(/<div class="score-card"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? '';
  const ratingBars: ScrapedLevelRatingBar[] = allMatches(scoreCard, /<div class="bar-row"[^>]*>[\s\S]*?<span class="lbl"[^>]*>([\s\S]*?)<\/span>[\s\S]*?style="width:([\d.]+)%"/gi)
    .map(match => ({ label: stripTags(match[1]), percent: Number(match[2]) || 0 }));
  const reviewCards: ScrapedLevelReviewCard[] = allMatches(reviewsSection, /<div class="review"[^>]*>([\s\S]*?)<div class="r-author"[\s\S]*?<\/div>\s*<\/div>/gi).map((match) => ({
    stars: firstMatch(match[0], /<div class="stars"[^>]*>([\s\S]*?)<\/div>/i),
    quote: firstMatch(match[0], /<p[^>]*>([\s\S]*?)<\/p>/i),
    initials: firstMatch(match[0], /<span class="ra-av"[^>]*>([\s\S]*?)<\/span>/i),
    name: firstMatch(match[0], /<div class="ra-name"[^>]*>([\s\S]*?)<\/div>/i),
    role: firstMatch(match[0], /<div class="ra-role"[^>]*>([\s\S]*?)<\/div>/i),
  })).filter(card => card.quote);

  const faqSection = sectionAfterComment(html, /<!-- FAQ -->/).match(/<section class="section band"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const faqHead = parseSecHead(faqSection);
  const faqItems: ScrapedFaqItem[] = allMatches(faqSection, /<details class="qa"([^>]*)>([\s\S]*?)<\/details>/gi).map((match) => {
    const answerHtml = match[2].match(/<div class="qa-body"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.trim() ?? '';
    return {
      question: stripTags(match[2].match(/<summary>([\s\S]*?)<span class="qa-icon"/i)?.[1] ?? ''),
      answerHtml,
      answerText: stripTags(answerHtml),
    };
  }).filter(item => item.question);

  const ctaSection = sectionAfterComment(html, /<!-- CTA -->/).match(/<section class="cta-band"[\s\S]*?<\/section>/i)?.[0] ?? '';
  const ctaPanel = ctaSection.match(/<div class="cta-panel"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/section>/i)?.[1] ?? '';
  const ctaHeading = splitHeading(ctaPanel);
  const primaryCta = ctaPanel.match(/<a class="btn btn-primary"[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);
  const secondaryCta = ctaPanel.match(/<a class="btn btn-outline-blue"[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/i);

  const priceCard = sideHtml.match(/<div class="price-card"[^>]*>([\s\S]*?)<\/div>\s*(?:<div class="bestvalue"|$)/i)?.[1] ?? sideHtml;
  const sessionPricing = parseSessionOptions(sideHtml);
  const includes = parseIncludes(sideHtml);
  const bestValue = sideHtml.match(/<div class="bestvalue"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const defaultSession = sessionPricing?.options.find(option => option.isDefault) ?? sessionPricing?.options[0];

  return {
    sourceUrl,
    slug,
    title: title || firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i).replace(/\s*[—–-]\s*Vertex Learning Solutions.*$/i, '').trim(),
    metaDescription: firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    breadcrumbItems: parseBreadcrumbs(html),
    eyebrow: firstMatch(heroMain, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i),
    heading: firstMatch(heroMain, /<h1[^>]*>([\s\S]*?)<\/h1>/i),
    description: firstMatch(heroMain, /<p class="hero-lead"[^>]*>([\s\S]*?)<\/p>/i),
    metaItems: parseMetaItems(heroMain),
    languageLabel: stripTags(heroMain.match(/<span class="lang-pill"[^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/i, '') ?? ''),
    tutorName: firstMatch(byline, /<div class="bt"[^>]*>([\s\S]*?)<\/div>/i),
    tutorRole: firstMatch(byline, /<div class="bs"[^>]*>([\s\S]*?)<\/div>/i),
    tutorInitials: firstMatch(byline, /<div class="avatar"[^>]*>([\s\S]*?)<\/div>/i),
    stageMode,
    stageImageUrl: stageImageUrl || null,
    stageImageAlt: heroImageBlock.match(/<img[^>]+alt=["']([^"']*)["']/i)?.[1]?.trim() ?? null,
    stageCaptionTitle: firstMatch(captionBlock, /<div class="t"[^>]*>([\s\S]*?)<\/div>/i) || null,
    stageCaptionSubtitle: firstMatch(captionBlock, /<div class="s"[^>]*>([\s\S]*?)<\/div>/i) || null,
    priceNow: firstMatch(priceCard, /<span class="price-now"[^>]*>([\s\S]*?)<\/span>/i),
    priceFromLabel: firstMatch(priceCard, /<span class="price-from"[^>]*>([\s\S]*?)<\/span>/i),
    priceAccess: stripTags(priceCard.match(/<div class="price-access"[^>]*>([\s\S]*?)<\/div>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? ''),
    priceNote: stripTags(priceCard.match(/<p class="price-note"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? ''),
    sessionSelectorLabel: sessionPricing?.label ?? '',
    ctaTextPrefix: sessionPricing?.ctaPrefix ?? 'Enrol now',
    sessionOptions: sessionPricing?.options ?? [],
    primaryCtaText: sessionPricing
      ? stripTags(sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*>([\s\S]*?)<\/a>/i)?.[1] ?? `${sessionPricing.ctaPrefix} · ${defaultSession?.ctaSuffix ?? ''}`)
      : 'Enrol now',
    primaryCtaUrl: sideHtml.match(/<a class="btn btn-primary[^"]*session-cta[^"]*"[^>]*href=["']([^"']+)["']/i)?.[1]?.trim() ?? 'https://vls-online.com/contactform',
    includesLabel: includes.label,
    includesItems: includes.items,
    bestValueTag: firstMatch(bestValue, /<div class="bv-tag"[^>]*>([\s\S]*?)<\/div>/i),
    bestValueText: firstMatch(bestValue, /<p[^>]*>([\s\S]*?)<\/p>/i),
    bestValueLinkText: stripTags(bestValue.match(/<a[^>]*>([\s\S]*?)<\/a>/i)?.[1]?.replace(/<svg[\s\S]*?<\/svg>/gi, '') ?? ''),
    bestValueLinkUrl: bestValue.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1]?.trim() ?? '',
    introHtml: introInner.trim(),
    introText: stripTags(introInner),
    pathwayEyebrow: pathwayHead.eyebrow,
    pathwayHeadingPrefix: pathwayHead.prefix,
    pathwayHeadingAccent: pathwayHead.accent,
    pathwaySteps,
    papersEyebrow: papersHead.eyebrow,
    papersHeadingPrefix: papersHead.prefix,
    papersHeadingAccent: papersHead.accent,
    papersSubmeta: parseSubmeta(papersSection),
    paperGroups: parsePaperGroups(papersSection),
    whyEyebrow: whyHead.eyebrow,
    whyHeadingPrefix: whyHead.prefix,
    whyHeadingAccent: whyHead.accent,
    whyItems,
    reviewsEyebrow: reviewsHead.eyebrow,
    reviewsHeadingPrefix: reviewsHead.prefix,
    reviewsHeadingAccent: reviewsHead.accent,
    reviewsScore: firstMatch(scoreCard, /<div class="big"[^>]*>([\s\S]*?)<\/div>/i),
    reviewsStars: firstMatch(scoreCard, /<div class="score-stars[^"]*"[^>]*>([\s\S]*?)<\/div>/i),
    reviewsLabel: firstMatch(scoreCard, /<div class="based"[^>]*>([\s\S]*?)<\/div>/i),
    ratingBars,
    reviewCards,
    faqEyebrow: faqHead.eyebrow,
    faqHeadingPrefix: faqHead.prefix,
    faqHeadingAccent: faqHead.accent,
    faqItems,
    ctaEyebrow: firstMatch(ctaPanel, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i),
    ctaHeadingPrefix: ctaHeading.prefix,
    ctaHeadingAccent: ctaHeading.accent,
    ctaBody: firstMatch(ctaPanel, /<p[^>]*>([\s\S]*?)<\/p>/i),
    ctaPrimaryText: primaryCta ? stripTags(primaryCta[2]) : '',
    ctaPrimaryUrl: primaryCta?.[1]?.trim() ?? '',
    ctaSecondaryText: secondaryCta ? stripTags(secondaryCta[2]).replace(/\s+/g, ' ') : '',
    ctaSecondaryUrl: secondaryCta?.[1]?.trim() ?? '',
  };
}

export function collectLevelPageScrapeWarnings(scraped: ScrapedLevelPage): string[] {
  const warnings: string[] = [...(scraped.extractionWarnings ?? [])];
  if (!scraped.heading) warnings.push('Hero heading was not detected.');
  if (!scraped.introHtml) warnings.push('SEO intro section was not detected.');
  if (!scraped.pathwaySteps.length) warnings.push('Pathway section was not detected.');
  if (!scraped.paperGroups.some(group => group.modules.length)) warnings.push('Papers section was not detected.');
  if (!scraped.whyItems.length) warnings.push('Why VLS section was not detected.');
  if (!scraped.reviewCards.length) warnings.push('Student reviews section was not detected.');
  if (!scraped.faqItems.length) warnings.push('FAQ section was not detected.');
  if (scraped.stageMode === 'image' && !scraped.stageImageUrl) warnings.push('Hero image URL was not found.');
  if (!scraped.metaDescription) warnings.push('Meta description was not found.');
  return warnings;
}
