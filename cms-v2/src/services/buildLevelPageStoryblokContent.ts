import type { ScrapedLevelPage } from '../../shared/levelPageTypes';
import { DEFAULT_TRUSTPILOT_GRID_EMBED } from '../../shared/trustpilotDefaults';
import { sanitizeBlokForStoryblok } from './migrationTemplateRegistry';

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function buildSeoBlok(scraped: ScrapedLevelPage): Record<string, unknown>[] {
  return [{
    _uid: uid(),
    component: 'seo',
    title: scraped.title,
    description: scraped.metaDescription,
  }];
}

function buildHeroBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  const main: Record<string, unknown> = {
    _uid: uid(),
    component: 'level_hero_main',
    eyebrow: scraped.eyebrow,
    heading: scraped.heading,
    description: scraped.description,
    language_label: scraped.languageLabel,
    tutor_name: scraped.tutorName,
    tutor_role: scraped.tutorRole,
    tutor_initials: scraped.tutorInitials || 'V',
    stage_mode: scraped.stageMode === 'image' ? 'image' : 'none',
    stage_caption_title: scraped.stageCaptionTitle ?? '',
    stage_caption_subtitle: scraped.stageCaptionSubtitle ?? '',
    breadcrumbs: scraped.breadcrumbItems.map(item => ({
      _uid: uid(),
      component: 'level_breadcrumb_item',
      label: item.label,
      ...(storyblokLink(item.url) ? { link: storyblokLink(item.url) } : {}),
    })),
    meta_items: scraped.metaItems.map(item => ({
      _uid: uid(),
      component: 'level_meta_item',
      show_stars: item.showStars,
      stars_text: item.starsText,
      bold_text: item.boldText,
      text: item.text,
      icon: item.icon,
    })),
  };

  if (scraped.stageMode === 'image' && scraped.stageImageUrl) {
    main.migration_stage_image_url = scraped.stageImageUrl;
    main.migration_stage_image_alt = scraped.stageImageAlt ?? scraped.stageCaptionTitle ?? scraped.heading;
  }

  const sidebar: Record<string, unknown> = {
    _uid: uid(),
    component: 'level_pricing_sidebar',
    price_now: scraped.priceNow,
    price_from_label: scraped.priceFromLabel,
    price_access: scraped.priceAccess,
    price_note: scraped.priceNote,
    session_selector_label: scraped.sessionSelectorLabel,
    cta_text_prefix: scraped.ctaTextPrefix,
    primary_cta_text: scraped.primaryCtaText,
    ...(storyblokLink(scraped.primaryCtaUrl) ? { primary_cta_link: storyblokLink(scraped.primaryCtaUrl) } : {}),
    includes_label: scraped.includesLabel,
    includes_items: scraped.includesItems.map(text => ({
      _uid: uid(),
      component: 'level_include_item',
      text,
    })),
    best_value_tag: scraped.bestValueTag,
    best_value_text: scraped.bestValueText,
    best_value_link_text: scraped.bestValueLinkText,
    ...(storyblokLink(scraped.bestValueLinkUrl) ? { best_value_link: storyblokLink(scraped.bestValueLinkUrl) } : {}),
    session_options: scraped.sessionOptions.map(option => ({
      _uid: uid(),
      component: 'level_session_option',
      title: option.title,
      subtitle: option.subtitle,
      price: option.price,
      badge: option.badge,
      cta_suffix: option.ctaSuffix,
      is_default: option.isDefault,
    })),
  };

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_page_hero',
    main: [main],
    sidebar: [sidebar],
  });
}

function buildIntroBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_intro_section',
    body_html: scraped.introHtml,
  });
}

function buildPathwayBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_pathway_section',
    eyebrow: scraped.pathwayEyebrow,
    heading_prefix: scraped.pathwayHeadingPrefix,
    heading_accent: scraped.pathwayHeadingAccent,
    steps: scraped.pathwaySteps.map(step => ({
      _uid: uid(),
      component: 'level_pathway_step',
      number: step.number,
      title: step.title,
      body: step.body,
      tag: step.tag,
    })),
  });
}

function buildPapersBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_papers_section',
    eyebrow: scraped.papersEyebrow,
    heading_prefix: scraped.papersHeadingPrefix,
    heading_accent: scraped.papersHeadingAccent,
    submeta_items: scraped.papersSubmeta.map(item => ({
      _uid: uid(),
      component: 'level_submeta_item',
      value: item.value,
      label: item.label,
    })),
    groups: scraped.paperGroups.map(group => ({
      _uid: uid(),
      component: 'level_paper_group',
      label: group.label,
      modules: group.modules.map(module => ({
        _uid: uid(),
        component: 'level_paper_module',
        code: module.code,
        title: module.title,
        meta: module.meta,
        body_html: module.bodyHtml,
        cta_text: module.ctaText,
        ...(storyblokLink(module.ctaUrl) ? { cta_link: storyblokLink(module.ctaUrl) } : {}),
        is_open: module.isOpen,
      })),
    })),
  });
}

function buildWhyBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_why_section',
    eyebrow: scraped.whyEyebrow,
    heading_prefix: scraped.whyHeadingPrefix,
    heading_accent: scraped.whyHeadingAccent,
    items: scraped.whyItems.map(item => ({
      _uid: uid(),
      component: 'level_why_item',
      body_html: item.html,
    })),
  });
}

function buildReviewsBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_reviews_section',
    eyebrow: scraped.reviewsEyebrow,
    heading_prefix: scraped.reviewsHeadingPrefix,
    heading_accent: scraped.reviewsHeadingAccent,
    score: scraped.reviewsScore,
    score_stars: scraped.reviewsStars,
    score_label: scraped.reviewsLabel,
    rating_bars: scraped.ratingBars.map(bar => ({
      _uid: uid(),
      component: 'level_rating_bar',
      label: bar.label,
      percent: bar.percent,
    })),
    trustpilot_embed: DEFAULT_TRUSTPILOT_GRID_EMBED,
  });
}

function buildFaqBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_faq_section',
    eyebrow: scraped.faqEyebrow,
    heading_prefix: scraped.faqHeadingPrefix,
    heading_accent: scraped.faqHeadingAccent,
    items: scraped.faqItems.map(item => ({
      _uid: uid(),
      component: 'level_faq_item',
      question: item.question,
      answer_html: item.answerHtml,
    })),
  });
}

function buildCtaBlok(scraped: ScrapedLevelPage): Record<string, unknown> {
  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'level_cta_section',
    eyebrow: scraped.ctaEyebrow,
    heading_prefix: scraped.ctaHeadingPrefix,
    heading_accent: scraped.ctaHeadingAccent,
    body: scraped.ctaBody,
    primary_cta_text: scraped.ctaPrimaryText,
    ...(storyblokLink(scraped.ctaPrimaryUrl) ? { primary_cta_link: storyblokLink(scraped.ctaPrimaryUrl) } : {}),
    secondary_cta_text: scraped.ctaSecondaryText,
    ...(storyblokLink(scraped.ctaSecondaryUrl) ? { secondary_cta_link: storyblokLink(scraped.ctaSecondaryUrl) } : {}),
  });
}

export function buildLevelPageStoryblokContent(scraped: ScrapedLevelPage): Record<string, unknown> {
  return {
    component: 'page',
    seo: buildSeoBlok(scraped),
    body: [
      buildHeroBlok(scraped),
      buildIntroBlok(scraped),
      buildPathwayBlok(scraped),
      buildPapersBlok(scraped),
      buildWhyBlok(scraped),
      buildReviewsBlok(scraped),
      buildFaqBlok(scraped),
      buildCtaBlok(scraped),
    ],
  };
}

export function buildLevelPageStructureBody(): Record<string, unknown>[] {
  const placeholder = (component: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
    _uid: uid(),
    component,
    ...extra,
  });

  return [
    sanitizeBlokForStoryblok({
      _uid: uid(),
      component: 'level_page_hero',
      main: [placeholder('level_hero_main', { heading: 'Level page heading' })],
      sidebar: [placeholder('level_pricing_sidebar', { price_now: '$60' })],
    }),
    placeholder('level_intro_section'),
    placeholder('level_pathway_section', { steps: [placeholder('level_pathway_step')] }),
    placeholder('level_papers_section', { groups: [placeholder('level_paper_group', { modules: [placeholder('level_paper_module')] })] }),
    placeholder('level_why_section', { items: [placeholder('level_why_item')] }),
    placeholder('level_reviews_section', { trustpilot_embed: DEFAULT_TRUSTPILOT_GRID_EMBED }),
    placeholder('level_faq_section', { items: [placeholder('level_faq_item')] }),
    placeholder('level_cta_section'),
  ];
}
