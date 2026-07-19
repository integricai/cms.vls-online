export type StoryblokRegion = 'eu' | 'us';

export type MigrationTemplate =
  | 'home'
  | 'course'
  | 'legal'
  | 'form'
  | 'about_us'
  | 'landing'
  | 'team_vls'
  | 'schedules'
  | 'course_articles'
  | 'live_sessions'
  | 'book_meeting'
  | 'contact_us'
  | 'study_notes'
  | 'course_listing';

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
  scrapedAt: string | null;
  scrapeWarnings: string[];
  structureGeneratedAt: string | null;
  draftStoryId: number | null;
  customComponentName: string | null;
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

export interface ScrapedTemplateSection {
  key: string;
  html: string;
  eyebrow: string;
  headingPrefix: string;
  headingAccent: string;
  lead: string;
  body: string;
  bodyHtml: string;
  stats: Array<{ value: string; label: string }>;
  cards: Array<{ title: string; description: string; figureValue?: string; figureLabel?: string; isTip?: boolean }>;
  sublead: string;
  /** Topic-grouped item lists (e.g. an article library grouped by syllabus area) — distinct from
   * `cards`, which is a flat, ungrouped list. */
  groups: Array<{ label: string; items: Array<{ code: string; title: string; description: string; url: string }> }>;
  timeline: Array<{ year: string; title: string; text: string }>;
  contactCards: Array<{ title: string; detail: string; linkText: string; linkUrl: string }>;
  heroItems: Array<{ text: string }>;
  sideCard: {
    tag: string;
    title?: string;
    quote: string;
    authorName: string;
    authorRole: string;
    authorInitials?: string;
    footerLabel?: string;
    footerValue?: string;
    rows?: Array<{ number: string; title: string; subtitle: string }>;
  } | null;
  badges: Array<{ title: string; subtitle: string }>;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaText: string;
  profiles: Array<{
    name: string;
    role: string;
    initials: string;
    bio: string;
    tags: string;
    logosNote: string;
    stats: Array<{ value: string; label: string }>;
  }>;
  steps: Array<{ number: string; title: string; description: string }>;
  sessions: Array<{
    tag: string;
    mode: string;
    title: string;
    tutors: string;
    scheduleLine: string;
    timeLine: string;
    extrasLine: string;
    mockChip: string;
    courseLink: string;
    track: string;
  }>;
  liveSessionRows: Array<{
    paperCode: string;
    paperName: string;
    tutors: string;
    track: string;
    formatLabel: string;
    startDate: string;
    liveDay: string;
    liveTime: string;
    endDate: string;
    mockLabel: string;
    courseLink: string;
  }>;
  levels: Array<{
    number: string;
    title: string;
    requirement: string;
    tone: string;
    papers: Array<{ code: string; name: string }>;
  }>;
  labeledItems: Array<{ title: string; subtitle: string }>;
  legalTabs: Array<{ label: string; link: string; active: boolean }>;
  legalMetaItems: Array<{ title: string; subtitle: string }>;
  legalTocItems: Array<{ label: string; anchorId: string; number: string }>;
  legalCalloutHeading: string;
  legalTocTitle: string;
  legalTocDownloadLabel: string;
  legalTocDownloadLink: string;
  legalSectionNumber: string;
  legalSectionHeading: string;
  checklistHeading: string;
  checklistItems: Array<{ title: string }>;
  tableRows: Array<{ colA: string; colB: string }>;
  bullets: string[];
  introHtml: string;
  contactCta: {
    eyebrow: string;
    heading: string;
    body: string;
    email: string;
    primaryText: string;
    secondaryText: string;
    secondaryLink: string;
  } | null;
  schedulerTag: string;
  schedulerTitle: string;
  schedulerSubtitle: string;
  schedulerPlaceholderHeading: string;
  schedulerPlaceholderText: string;
  schedulerCtaText: string;
  schedulerCtaLink: string;
  cardTag: string;
  cardLiveLabel: string;
  cardTitle: string;
  cardMeta: string;
  cardRows: Array<{ title: string; subtitle: string }>;
  noteHeading: string;
  noteText: string;
  freePill: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  contactInfoHeading: string;
  contactInfoItems: Array<{ title: string; subtitle: string; link: string }>;
  supportHoursHeading: string;
  supportHoursRows: Array<{ day: string; hours: string }>;
  supportHoursNote: string;
  socialsHeading: string;
  socials: Array<{ label: string; link: string }>;
  anchorId: string;
  faqItems: ScrapedFaqItem[];
  priceNow: string;
  priceAccess: string;
  priceTag: string;
  includesItems: string[];
  videoUrl: string;
  videoTitle: string;
  videoSubtitle: string;
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
  heroVideoUrl: string | null;
  faq: {
    title: string;
    icon: string;
    items: ScrapedFaqItem[];
  } | null;
  testimonials: ScrapedTestimonials | null;
  promotion: ScrapedPromotionSection | null;
  hasCourseFinderBanner: boolean;
  schemaDescription: string;
  extractionWarnings?: string[];
}

export interface ScrapedGenericPage {
  sourceUrl: string;
  slug: string;
  title: string;
  metaDescription: string;
  breadcrumbItems: ScrapedBreadcrumbItem[];
  sections: ScrapedContentSection[];
  templateSections: ScrapedTemplateSection[];
  faq: ScrapedCoursePage['faq'];
  extractionWarnings?: string[];
  /** Full fetched page HTML, kept so a fully-blocked page can later be re-analyzed for Generate Component. */
  rawHtml?: string;
  /** Per blueprint-section-key: whether that section's content came from the regex parser or the AI fallback. */
  sectionMatchSource?: Record<string, 'live' | 'ai'>;
  /** Per blueprint-section-key: AI match confidence (0-1), only present for 'ai' sourced sections. */
  sectionMatchConfidence?: Record<string, number>;
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

export interface StoryblokCredentials {
  storyblokSpaceId: string;
  storyblokAccessToken: string;
  storyblokRegion: StoryblokRegion;
}

export type ScrapePhaseRequest = StoryblokCredentials;

export interface ScrapePhaseResult {
  page: MigrationPageRecord;
  scraped: ScrapedCoursePage | ScrapedGenericPage;
  warnings: string[];
}

export type StructurePhaseRequest = StoryblokCredentials;

export interface StructurePhaseResult {
  page: MigrationPageRecord;
  templateReference: TemplateReferenceSummary;
  componentLibrary?: ComponentLibrarySummary;
  missingComponents: string[];
  /** Blueprint sections of the chosen template that have zero matching content on the live page. */
  unmatchedSections: string[];
  draftStory?: {
    storyId: number;
    fullSlug: string;
    previewUrl: string;
    created: boolean;
  };
  warnings: string[];
}

export interface ContentPhaseRequest extends StoryblokCredentials {
  publish?: boolean;
}

export interface ContentPhaseResult {
  page: MigrationPageRecord;
  warnings: string[];
  storyblok: {
    storyId: number;
    fullSlug: string;
    previewUrl: string;
    created: boolean;
  };
}

export interface ComponentDraftResult {
  componentName: string;
  /** Ordered children-first, then the parent component — nested `bloks` fields reference earlier entries by name. */
  storyblokSchema: { components: Array<Record<string, unknown>> };
  tsxCode: string;
  typeCode: string;
  warnings: string[];
}

export type GenerateComponentRequest = StoryblokCredentials;

export interface ConfirmComponentRequest extends StoryblokCredentials {
  componentName: string;
  storyblokSchema: { components: Array<Record<string, unknown>> };
}

export interface ConfirmComponentResult {
  page: MigrationPageRecord;
  componentName: string;
  created: boolean;
}
