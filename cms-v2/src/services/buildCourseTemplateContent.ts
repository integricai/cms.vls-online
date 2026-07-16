import type { ScrapedCoursePage } from '../../shared/migrationTypes';
import type { ParsedCourseTemplate } from './courseTemplateParser';
import { loadCourseTemplateFile } from './courseTemplateParser';
import { sanitizeBlokForStoryblok } from './migrationTemplateRegistry';

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

function pickRicherArray<T>(live: T[] | undefined, template: T[]): T[] {
  const liveItems = live ?? [];
  return liveItems.length >= template.length ? liveItems : (template.length ? template : liveItems);
}

export function mergeCourseWithTemplate(
  scraped: ScrapedCoursePage,
  template: ParsedCourseTemplate = loadCourseTemplateFile(),
): ParsedCourseTemplate {
  const hero = scraped.hero;
  const right = scraped.heroRight;
  const testimonials = scraped.testimonials;
  const faq = scraped.faq;
  const promotion = scraped.promotion;

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
    priceNow: template.priceNow,
    priceWas: template.priceWas,
    priceSave: template.priceSave,
    priceAccess: template.priceAccess,
    priceNote: template.priceNote,
    primaryCtaText: pickText(right?.ctaText?.replace(/\s*→\s*$/, ''), template.primaryCtaText),
    secondaryCtaText: template.secondaryCtaText,
    includesLabel: pickText(right?.label, template.includesLabel),
    includesItems: pickRicherArray(
      right?.items.map(item => item.title).filter(Boolean),
      template.includesItems,
    ),
    learnItems: pickRicherArray(
      hero?.learnItems.map(item => ({ title: item.title })).filter(item => item.title),
      template.learnItems,
    ),
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
    faqItems: pickRicherArray(
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

export function buildCourseStoryblokFromTemplate(
  data: ParsedCourseTemplate,
  options: {
    zenlerCourseId: string;
    sourceUrl: string;
    slug?: string;
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
      video_title: data.videoTitle,
      video_subtitle: data.videoSubtitle,
      video_duration: data.videoDuration,
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
    right: [{
      _uid: uid(),
      component: 'course_hero_right',
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
      items: data.includesItems.map(title => ({
        _uid: uid(),
        component: 'course_hero_right_item',
        title,
      })),
    }],
  });

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
    layout: 'course_reviews',
    eyebrow: data.reviewsEyebrow,
    title_prefix: data.reviewsHeadingPrefix,
    title_accent: data.reviewsHeadingAccent,
    score: data.reviewsScore,
    reviews_label: data.reviewsLabel,
    rating_bars: data.ratingBars.map(bar => ({
      _uid: uid(),
      component: 'rating_bar',
      label: bar.label,
      percent: String(bar.percent ?? 0),
    })),
    cards: data.reviewCards.map(card => ({
      _uid: uid(),
      component: 'testimonial_card',
      quote: card.quote,
      initials: card.initials,
      name: card.name,
      title: card.role,
      rating: '5',
    })),
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
): Record<string, unknown> {
  const merged = mergeCourseWithTemplate(scraped);
  const sourceUrl = scraped.sourceUrl || `https://vls-online.com/courses/${scraped.slug}`;
  return buildCourseStoryblokFromTemplate(merged, {
    zenlerCourseId,
    sourceUrl,
    slug: scraped.slug,
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
