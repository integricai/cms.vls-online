export type StoryblokRegion = 'eu' | 'us';

export interface CourseMigrationRequest {
  pageUrl: string;
  storyblokSpaceId: string;
  storyblokAccessToken: string;
  storyblokRegion: StoryblokRegion;
  publish?: boolean;
  dryRun?: boolean;
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
  schemaDescription: string;
}

export interface CourseMigrationResult {
  scraped: ScrapedCoursePage;
  warnings: string[];
  storyblok?: {
    storyId: number;
    fullSlug: string;
    previewUrl: string;
    created: boolean;
  };
}
