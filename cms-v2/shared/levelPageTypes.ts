import type { ScrapedBreadcrumbItem, ScrapedFaqItem } from './migrationTypes';

export type LevelStageMode = 'video' | 'image' | 'none';

export interface ScrapedLevelMetaItem {
  showStars: boolean;
  starsText: string;
  boldText: string;
  text: string;
  icon: 'none' | 'chart' | 'calendar' | 'modules' | 'clock';
}

export interface ScrapedLevelSessionOption {
  title: string;
  subtitle: string;
  price: string;
  badge: string;
  ctaSuffix: string;
  isDefault: boolean;
}

export interface ScrapedLevelPathwayStep {
  number: string;
  title: string;
  body: string;
  tag: string;
}

export interface ScrapedLevelPaperModule {
  code: string;
  title: string;
  meta: string;
  bodyHtml: string;
  bodyText: string;
  ctaText: string;
  ctaUrl: string;
  isOpen: boolean;
}

export interface ScrapedLevelPaperGroup {
  label: string;
  modules: ScrapedLevelPaperModule[];
}

export interface ScrapedLevelWhyItem {
  html: string;
  text: string;
}

export interface ScrapedLevelRatingBar {
  label: string;
  percent: number;
}

export interface ScrapedLevelReviewCard {
  stars: string;
  quote: string;
  initials: string;
  name: string;
  role: string;
}

export interface ScrapedLevelPage {
  sourceUrl: string;
  slug: string;
  title: string;
  metaDescription: string;
  breadcrumbItems: ScrapedBreadcrumbItem[];
  eyebrow: string;
  heading: string;
  description: string;
  metaItems: ScrapedLevelMetaItem[];
  languageLabel: string;
  tutorName: string;
  tutorRole: string;
  tutorInitials: string;
  stageMode: LevelStageMode;
  stageImageUrl: string | null;
  stageImageAlt: string | null;
  stageCaptionTitle: string | null;
  stageCaptionSubtitle: string | null;
  priceNow: string;
  priceFromLabel: string;
  priceAccess: string;
  priceNote: string;
  sessionSelectorLabel: string;
  ctaTextPrefix: string;
  sessionOptions: ScrapedLevelSessionOption[];
  primaryCtaText: string;
  primaryCtaUrl: string;
  includesLabel: string;
  includesItems: string[];
  bestValueTag: string;
  bestValueText: string;
  bestValueLinkText: string;
  bestValueLinkUrl: string;
  introHtml: string;
  introText: string;
  pathwayEyebrow: string;
  pathwayHeadingPrefix: string;
  pathwayHeadingAccent: string;
  pathwaySteps: ScrapedLevelPathwayStep[];
  papersEyebrow: string;
  papersHeadingPrefix: string;
  papersHeadingAccent: string;
  papersSubmeta: Array<{ value: string; label: string }>;
  paperGroups: ScrapedLevelPaperGroup[];
  whyEyebrow: string;
  whyHeadingPrefix: string;
  whyHeadingAccent: string;
  whyItems: ScrapedLevelWhyItem[];
  reviewsEyebrow: string;
  reviewsHeadingPrefix: string;
  reviewsHeadingAccent: string;
  reviewsScore: string;
  reviewsStars: string;
  reviewsLabel: string;
  ratingBars: ScrapedLevelRatingBar[];
  reviewCards: ScrapedLevelReviewCard[];
  faqEyebrow: string;
  faqHeadingPrefix: string;
  faqHeadingAccent: string;
  faqItems: ScrapedFaqItem[];
  ctaEyebrow: string;
  ctaHeadingPrefix: string;
  ctaHeadingAccent: string;
  ctaBody: string;
  ctaPrimaryText: string;
  ctaPrimaryUrl: string;
  ctaSecondaryText: string;
  ctaSecondaryUrl: string;
  extractionWarnings?: string[];
}
