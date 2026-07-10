export type StoryblokRegion = 'eu' | 'us';

export type MigrationTemplate =
  | 'home'
  | 'course'
  | 'legal'
  | 'form'
  | 'about_us'
  | 'landing'
  | 'team_vls'
  | 'schedules';

export interface MigrationPageRecord {
  id: number;
  originUrl: string;
  zenlerUrl: string;
  title: string | null;
  path: string;
  template: MigrationTemplate;
  suggestedDestination: string;
  destinationSlug: string;
  migratedAt: string | null;
  storyblokStoryId: number | null;
  scannedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface PageScanResult {
  scanned: number;
  inserted: number;
  updated: number;
  pages: MigrationPageRecord[];
}

export interface PageMigrationRequest {
  pageUrl: string;
  template: MigrationTemplate;
  destinationSlug: string;
  storyblokSpaceId: string;
  storyblokAccessToken: string;
  storyblokRegion: StoryblokRegion;
  publish?: boolean;
  dryRun?: boolean;
}

/** @deprecated Use PageMigrationRequest — kept for backward compatibility */
export interface CourseMigrationRequest {
  pageUrl: string;
  storyblokSpaceId: string;
  storyblokAccessToken: string;
  storyblokRegion: StoryblokRegion;
  publish?: boolean;
  dryRun?: boolean;
  template?: MigrationTemplate;
  destinationSlug?: string;
}

export interface ScrapedBreadcrumbItem {
  label: string;
  url: string;
}

export interface ScrapedFaqItem {
  question: string;
  answerHtml: string;
  answerText: string;
}

export interface ScrapedHeroRightItem {
  icon: string;
  title: string;
  description: string;
  badge: string;
}

export interface ScrapedLearnItem {
  title: string;
  subtitle: string;
}

export interface ScrapedHero {
  breadcrumb: string;
  breadcrumbItems: ScrapedBreadcrumbItem[];
  eyebrow: string;
  heading: string;
  description: string;
  tags: string[];
  learnLabel: string;
  learnItems: ScrapedLearnItem[];
}

export interface ScrapedTabPanel {
  label: string;
  icon: string;
  contentHtml: string;
  contentText: string;
}

export interface ScrapedCourseDescription {
  icon: string;
  title: string;
  introBold: string;
  introP1: string;
  introP2: string;
  bodyHtml: string;
  bodyText: string;
  source: 'cms' | 'zenler';
}

export interface ScrapedTestimonialCard {
  quote: string;
  author: string;
  role: string;
}

export interface ScrapedTestimonials {
  eyebrow: string;
  titlePrefix: string;
  titleAccent: string;
  subtitle: string;
  cards: ScrapedTestimonialCard[];
}

export interface ScrapedPromotionSection {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaUrl: string;
}

export interface ScrapedContentSection {
  heading: string;
  bodyHtml: string;
  bodyText: string;
}

export interface ScrapedCoursePage {
  sourceUrl: string;
  slug: string;
  title: string;
  metaDescription: string;
  zenlerCourseId: string;
  courseCode: string;
  hero: ScrapedHero | null;
  heroRight: {
    label: string;
    items: ScrapedHeroRightItem[];
    ctaText: string;
    ctaUrl: string;
  } | null;
  courseDescription: ScrapedCourseDescription | null;
  tabs: ScrapedTabPanel[];
  faq: {
    title: string;
    icon: string;
    items: ScrapedFaqItem[];
  } | null;
  testimonials: ScrapedTestimonials | null;
  promotion: ScrapedPromotionSection | null;
  hasCourseFinderBanner: boolean;
  schemaDescription: string;
}

export interface ScrapedGenericPage {
  sourceUrl: string;
  slug: string;
  title: string;
  metaDescription: string;
  breadcrumbItems: ScrapedBreadcrumbItem[];
  sections: ScrapedContentSection[];
  faq: ScrapedCoursePage['faq'];
}

export interface TemplateReferenceSummary {
  template: MigrationTemplate;
  fileName: string;
  sectionCount: number;
  sections: Array<{ key: string; label: string; component: string }>;
}

export interface ComponentLibrarySummary {
  folderSlug: string;
  presetsCreated: number;
  presetsUpdated: number;
  presets: Array<{ fullSlug: string; component: string; created: boolean }>;
}

export interface PageMigrationResult {
  template: MigrationTemplate;
  destinationSlug: string;
  fullSlug: string;
  scraped: ScrapedCoursePage | ScrapedGenericPage;
  warnings: string[];
  templateReference?: TemplateReferenceSummary;
  componentLibrary?: ComponentLibrarySummary;
  storyblok?: {
    storyId: number;
    fullSlug: string;
    previewUrl: string;
    created: boolean;
  };
}

/** @deprecated Use PageMigrationResult */
export type CourseMigrationResult = PageMigrationResult;
