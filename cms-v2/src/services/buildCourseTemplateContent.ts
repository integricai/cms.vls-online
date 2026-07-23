import type { MigrationTemplate } from '../../shared/migrationTypes';
import type { ScrapedCoursePage } from '../../shared/migrationTypes';
import type { ParsedCourseTemplate } from './courseTemplateParser';
import { DEFAULT_TRUSTPILOT_CAROUSEL_EMBED } from '../../shared/trustpilotDefaults';
import { loadCourseTemplateFile } from './courseTemplateParser';
import { sanitizeBlokForStoryblok } from './migrationTemplateRegistry';
import {
  buildCourseTabsBlok,
  buildTabBlocksFromPanel,
  buildTabBlocksFromTemplate,
} from './courseTabBuilder';

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function pickText(...values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

export function mapScrapedCourseIntroduction(
  desc: ScrapedCoursePage['courseDescription'],
): { title: string; paragraph1: string; paragraph2: string } | null {
  if (!desc) return null;

  const heading = pickText(desc.introBold, desc.title, 'Exam Paper Overview');
  const rawParts = [desc.introP1, desc.introP2, desc.bodyText]
    .map((part) => part?.trim())
    .filter(Boolean) as string[];

  const contentParts = rawParts.filter((part) => (
    part !== heading
    && part.toLowerCase() !== heading.toLowerCase()
  ));
  const effectiveParts = contentParts.length ? contentParts : rawParts;

  const paragraph1 = effectiveParts[0] ?? '';
  const paragraph2 = effectiveParts.slice(1).join('\n\n');

  if (!paragraph1 && !paragraph2) return null;

  return {
    title: heading,
    paragraph1,
    paragraph2,
  };
}

function pickRicherArray<T>(live: T[] | undefined, template: T[]): T[] {
  const liveItems = live ?? [];
  return liveItems.length >= template.length ? liveItems : (template.length ? template : liveItems);
}

/** Prefer scraped items when any exist; otherwise fall back to the reference template. */
function pickLiveArrayOrTemplate<T>(live: T[] | undefined, template: T[]): T[] {
  const liveItems = live ?? [];
  if (liveItems.length > 0) return liveItems;
  return template;
}

export function mergeCourseWithTemplate(
  scraped: ScrapedCoursePage,
  template: ParsedCourseTemplate = loadCourseTemplateFile('course'),
): ParsedCourseTemplate {
  const hero = scraped.hero;
  const right = scraped.heroRight;
  const testimonials = scraped.testimonials;
  const faq = scraped.faq;
  const promotion = scraped.promotion;
  const scrapedIntro = mapScrapedCourseIntroduction(scraped.courseDescription);
  const hasScrapedDescription = Boolean(scraped.courseDescription);

  return {
    ...template,
    title: pickText(scraped.title, template.title),
    metaDescription: pickText(scraped.metaDescription, template.metaDescription),
    courseCode: pickText(scraped.courseCode, template.courseCode),
    eyebrow: pickText(hero?.eyebrow, template.eyebrow),
    heading: pickText(hero?.heading, template.heading),
    description: pickText(hero?.description, template.description),
    metaItems: template.metaItems,
    languageLabel: template.languageLabel,
    tutorName: template.tutorName,
    tutorRole: template.tutorRole,
    tutorInitials: template.tutorInitials,
    videoTitle: template.videoTitle,
    videoSubtitle: template.videoSubtitle,
    videoDuration: template.videoDuration,
    videoUrl: pickText(scraped.heroVideoUrl ?? undefined, template.videoUrl),
    stageMode: scraped.stageMode
      ?? (scraped.stageImageUrl ? 'image' : scraped.heroVideoUrl ? 'video' : template.stageMode),
    stageImageUrl: pickText(scraped.stageImageUrl ?? undefined, template.stageImageUrl),
    stageImageAlt: pickText(scraped.stageImageAlt ?? undefined, template.stageImageAlt),
    stageCaptionTitle: pickText(scraped.stageCaptionTitle ?? undefined, template.stageCaptionTitle),
    stageCaptionSubtitle: pickText(scraped.stageCaptionSubtitle ?? undefined, template.stageCaptionSubtitle),
    introductionTitle: hasScrapedDescription
      ? pickText(scrapedIntro?.title, template.introductionTitle)
      : template.introductionTitle,
    introductionParagraph1: hasScrapedDescription
      ? pickText(scrapedIntro?.paragraph1)
      : template.introductionParagraph1,
    introductionParagraph2: hasScrapedDescription
      ? pickText(scrapedIntro?.paragraph2)
      : template.introductionParagraph2,
    priceNow: template.priceNow,
    priceWas: template.pricingLayout === 'session_selector' ? '' : template.priceWas,
    priceSave: template.pricingLayout === 'session_selector' ? '' : template.priceSave,
    priceAccess: template.priceAccess,
    priceNote: template.pricingLayout === 'session_selector' ? '' : template.priceNote,
    pricingLayout: template.pricingLayout,
    sessionSelectorLabel: template.sessionSelectorLabel,
    ctaTextPrefix: template.ctaTextPrefix,
    sessionOptions: template.sessionOptions,
    primaryCtaText: template.pricingLayout === 'session_selector'
      ? template.primaryCtaText
      : pickText(right?.ctaText?.replace(/\s*→\s*$/, ''), template.primaryCtaText),
    secondaryCtaText: template.secondaryCtaText,
    includesLabel: pickText(right?.label, template.includesLabel),
    includesItems: pickRicherArray(
      right?.items.map(item => item.title).filter(Boolean),
      template.includesItems,
    ),
    learnItems: pickLiveArrayOrTemplate(
      hero?.learnItems.map(item => ({ title: item.title })).filter(item => item.title),
      template.learnItems,
    ),
    learnEyebrow: (hero?.learnItems.length ?? 0) > 0
      ? pickText(hero?.learnLabel, template.learnEyebrow)
      : template.learnEyebrow,
    learnHeadingPrefix: (hero?.learnItems.length ?? 0) > 0
      ? ''
      : template.learnHeadingPrefix,
    learnHeadingAccent: (hero?.learnItems.length ?? 0) > 0
      ? ''
      : template.learnHeadingAccent,
    reviewsEyebrow: pickText(testimonials?.eyebrow, template.reviewsEyebrow),
    reviewsHeadingPrefix: pickText(testimonials?.titlePrefix, template.reviewsHeadingPrefix),
    reviewsHeadingAccent: pickText(testimonials?.titleAccent, template.reviewsHeadingAccent),
    reviewCards: pickRicherArray(
      testimonials?.cards.map(card => ({
        quote: card.quote,
        initials: card.author.slice(0, 1).toUpperCase(),
        name: card.author,
        role: card.role,
      })).filter(card => card.quote),
      template.reviewCards,
    ),
    faqItems: pickLiveArrayOrTemplate(
      faq?.items.map(item => ({
        question: item.question,
        answer: item.answerText,
      })).filter(item => item.question && item.answer),
      template.faqItems,
    ),
    ctaHeadingPrefix: pickText(promotion?.title, template.ctaHeadingPrefix),
    ctaBody: pickText(promotion?.subtitle, template.ctaBody),
    ctaPrimaryText: pickText(promotion?.ctaText, template.ctaPrimaryText),
  };
}

export function buildHeroRightBlokFromTemplate(data: ParsedCourseTemplate): Record<string, unknown> {
  const defaultSession = data.sessionOptions.find(option => option.isDefault) ?? data.sessionOptions[0];
  const includesItems = data.includesItems.map(title => ({
    _uid: uid(),
    component: 'course_hero_right_item',
    title,
  }));

  if (data.pricingLayout === 'session_selector') {
    const ctaPrefix = pickText(data.ctaTextPrefix, 'Enrol now');
    const ctaSuffix = defaultSession?.ctaSuffix ?? '';
    return sanitizeBlokForStoryblok({
      _uid: uid(),
      component: 'course_hero_right',
      pricing_layout: 'session_selector',
      session_selector_label: data.sessionSelectorLabel || 'Choose your exam session',
      cta_text_prefix: ctaPrefix,
      price_now: pickText(data.priceNow, defaultSession?.price),
      price_access: data.priceAccess,
      cta_text: ctaSuffix ? `${ctaPrefix} · ${ctaSuffix}` : ctaPrefix,
      section_label: data.includesLabel,
      show_best_value: false,
      show_reviews_summary: true,
      reviews_stars: '★★★★★',
      reviews_label: pickText(data.reviewsLabel, 'Based on 308 reviews'),
      session_options: data.sessionOptions.map(option => ({
        _uid: uid(),
        component: 'course_session_option',
        title: option.title,
        subtitle: option.subtitle,
        price: option.price,
        badge: option.badge,
        cta_suffix: option.ctaSuffix,
        is_default: option.isDefault,
      })),
      items: includesItems,
    });
  }

  return sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_hero_right',
    pricing_layout: 'standard',
    section_label: data.includesLabel,
    price_now: data.priceNow,
    price_was: data.priceWas,
    price_save: data.priceSave,
    price_access: data.priceAccess,
    price_note: data.priceNote,
    cta_text: data.primaryCtaText,
    secondary_cta_text: data.secondaryCtaText,
    secondary_cta_link: storyblokLink('/bookmeeting'),
    show_best_value: Boolean(data.bestValueText),
    best_value_tag: data.bestValueTag,
    best_value_text: data.bestValueText,
    best_value_link_text: data.bestValueLinkText,
    best_value_link: storyblokLink('/courses/fullaccess'),
    show_reviews_summary: true,
    reviews_stars: '★★★★★',
    reviews_label: pickText(data.reviewsLabel, 'Based on 308 reviews'),
    items: includesItems,
  });
}

export function buildCourseStoryblokFromTemplate(
  data: ParsedCourseTemplate,
  options: {
    zenlerCourseId: string;
    sourceUrl: string;
    slug?: string;
    scrapedTabs?: ScrapedCoursePage['tabs'];
  },
): Record<string, unknown> {
  const sourceUrl = options.sourceUrl;
  const zenlerCourseId = options.zenlerCourseId;
  const courseRef = pickText(options.slug?.toUpperCase(), data.courseCode, zenlerCourseId);

  const heroLayout = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_hero_layout',
    left: [{
      _uid: uid(),
      component: 'course_hero',
      zenler_course_id: zenlerCourseId,
      eyebrow: data.eyebrow,
      heading: data.heading,
      description: data.description,
      language_label: data.languageLabel,
      tutor_name: data.tutorName,
      tutor_role: data.tutorRole,
      tutor_initials: data.tutorInitials,
      stage_mode: data.stageMode === 'none' ? '' : data.stageMode,
      stage_caption_title: data.stageMode === 'image' ? data.stageCaptionTitle : '',
      stage_caption_subtitle: data.stageMode === 'image' ? data.stageCaptionSubtitle : '',
      video_title: data.stageMode === 'video' ? data.videoTitle : '',
      video_subtitle: data.stageMode === 'video' ? data.videoSubtitle : '',
      video_duration: data.stageMode === 'video' ? data.videoDuration : '',
      video_url: data.stageMode === 'video' ? data.videoUrl : '',
      meta_items: data.metaItems.map(item => ({
        _uid: uid(),
        component: 'course_meta_item',
        show_stars: item.showStars,
        stars_text: item.starsText,
        bold_text: item.boldText,
        text: item.text,
        icon: item.icon,
      })),
      schema_breadcrumb_id: `${sourceUrl}#breadcrumb`,
      schema_faq_section_id: `${sourceUrl}#faq`,
    }],
    right: [buildHeroRightBlokFromTemplate(data)],
  });

  const introduction = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_introduction',
    title: data.introductionTitle,
    paragraph_1: data.introductionParagraph1,
    paragraph_2: data.introductionParagraph2,
    read_more_label: 'Read more',
    read_less_label: 'Read less',
  });

  const tabEntries = options.scrapedTabs?.length
    ? options.scrapedTabs.map(tab => ({
        icon: tab.icon || '📦',
        label: tab.label,
        blocks: buildTabBlocksFromPanel(tab),
      }))
    : data.courseTabs.map(tab => ({
        icon: tab.icon,
        label: tab.label,
        blocks: buildTabBlocksFromTemplate(tab.blocks),
      }));

  const tabs = sanitizeBlokForStoryblok(buildCourseTabsBlok(tabEntries));

  const learnSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_learn_section',
    eyebrow: data.learnEyebrow,
    heading_prefix: data.learnHeadingPrefix,
    heading_accent: data.learnHeadingAccent,
    items: data.learnItems.map(item => ({
      _uid: uid(),
      component: 'course_hero_learn_item',
      title: item.title,
    })),
  });

  const curriculum = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_curriculum',
    course_id: courseRef,
    zenler_course_id: zenlerCourseId,
    eyebrow: data.curriculumEyebrow,
    heading_prefix: data.curriculumHeadingPrefix,
    heading_accent: data.curriculumHeadingAccent,
    submeta_items: data.curriculumSubmeta.map(item => ({
      _uid: uid(),
      component: 'course_submeta_item',
      value: item.value,
      label: item.label,
    })),
    show_lesson_durations: true,
  });

  const tutorSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'course_tutor_section',
    eyebrow: data.tutorEyebrow,
    heading_prefix: data.tutorHeadingPrefix,
    heading_accent: data.tutorHeadingAccent,
    name: pickText(data.tutorCardName, data.tutorName, 'Course tutor'),
    role: pickText(data.tutorCardRole, data.tutorRole),
    initials: pickText(data.tutorCardInitials, data.tutorInitials, 'T'),
    bio: pickText(data.tutorBio),
    stats: data.tutorStats.map(stat => ({
      _uid: uid(),
      component: 'stat_item',
      value: stat.value,
      label: stat.label,
    })),
  });

  const testimonials = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'testimonials',
    layout: 'trustpilot',
    trustpilot_embed: DEFAULT_TRUSTPILOT_CAROUSEL_EMBED,
    eyebrow: data.reviewsEyebrow,
    title_prefix: data.reviewsHeadingPrefix,
    title_accent: data.reviewsHeadingAccent,
  });

  const faqSection = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'faq_section',
    zenler_course_id: zenlerCourseId,
    schema_id: `${sourceUrl}#faq`,
    eyebrow: data.faqEyebrow,
    heading_prefix: data.faqHeadingPrefix,
    heading_accent: data.faqHeadingAccent,
    title: pickText(`${data.faqHeadingPrefix} ${data.faqHeadingAccent}`.trim(), 'Frequently asked questions'),
    items: data.faqItems.map(item => ({
      _uid: uid(),
      component: 'faq_item',
      answer_type: 'paragraph',
      question: item.question,
      answer_paragraph: item.answer,
    })),
  });

  const promotion = sanitizeBlokForStoryblok({
    _uid: uid(),
    component: 'promotion_section',
    eyebrow: data.ctaEyebrow,
    title: data.ctaHeadingPrefix,
    title_accent: data.ctaHeadingAccent,
    subtitle: data.ctaBody,
    cta_text: data.ctaPrimaryText,
    cta_link: storyblokLink('#'),
    secondary_cta_text: data.ctaSecondaryText,
    secondary_cta_link: storyblokLink('/bookmeeting'),
  });

  const seo = (data.title || data.metaDescription)
    ? [{
        _uid: uid(),
        component: 'seo',
        title: data.title,
        description: data.metaDescription,
        canonical_url: sourceUrl,
      }]
    : [];

  return {
    component: 'course_page',
    title: data.title,
    zenler_course_id: zenlerCourseId,
    seo,
    body: [
      heroLayout,
      introduction,
      tabs,
      learnSection,
      curriculum,
      tutorSection,
      testimonials,
      faqSection,
      promotion,
    ],
  };
}

export function buildMergedCourseStoryblokContent(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
  template: MigrationTemplate = 'course',
): Record<string, unknown> {
  const merged = mergeCourseWithTemplate(scraped, loadCourseTemplateFile(template));
  const sourceUrl = scraped.sourceUrl || `https://vls-online.com/courses/${scraped.slug}`;
  return buildCourseStoryblokFromTemplate(merged, {
    zenlerCourseId,
    sourceUrl,
    slug: scraped.slug,
    scrapedTabs: scraped.tabs,
  });
}

export function buildTemplateOnlyCourseStoryblokContent(
  zenlerCourseId = '',
  courseCode = 'SBR',
  slug = 'sbr',
): Record<string, unknown> {
  const template = loadCourseTemplateFile();
  return buildCourseStoryblokFromTemplate(
    { ...template, courseCode },
    {
      zenlerCourseId,
      sourceUrl: `https://vls-online.com/courses/${slug}`,
      slug,
    },
  );
}
