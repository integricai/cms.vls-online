import type { ScrapedCoursePage } from '../../shared/migrationTypes';

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

const DEFAULT_PAPERS = [
  { code: 'SBL', name: 'Strategic Business Leader', lvl: 'ess' as const },
  { code: 'SBR', name: 'Strategic Business Reporting', lvl: 'ess' as const },
  { code: 'AFM', name: 'Advanced Financial Management', lvl: 'opt' as const },
  { code: 'APM', name: 'Advanced Performance Management', lvl: 'opt' as const },
  { code: 'ATX', name: 'Advanced Taxation (UK)', lvl: 'opt' as const },
  { code: 'AAA', name: 'Advanced Audit & Assurance', lvl: 'opt' as const },
];

const DEFAULT_FEATURES = [
  'Full HD video tuition for each paper',
  'Exam-standard question practice videos',
  'Complete study notes & summaries',
  'Chapter-by-chapter quizzes',
  'Day-by-day study plan',
  'Active WhatsApp tutor support',
  'Final mock exam for each paper',
  'Free weekly live sessions',
];

function featureBlok(text: string) {
  return { _uid: uid(), component: 'multi_course_feature', text };
}

function paperBlok(paper: { code: string; name: string; lvl: 'ess' | 'opt' }, zenlerCourseId: string) {
  return {
    _uid: uid(),
    component: 'multi_course_paper',
    paper_code: paper.code,
    paper_name: paper.name,
    level_group: paper.lvl,
    zenler_course_id: zenlerCourseId,
  };
}

export function buildMultiCourseStoryblokContent(
  scraped: ScrapedCoursePage,
  zenlerCourseId: string,
): Record<string, unknown> {
  const hero = scraped.hero;
  const title = scraped.title?.trim() || 'ACCA Strategic Professional Combo Pack';
  const heading = hero?.heading?.trim() || 'ACCA Strategic Professional';
  const lead = hero?.description?.trim()
    || 'Choose any two Strategic Professional papers and study them together in one discounted pack — full video tuition, question practice, notes, quizzes and tutor support for both.';

  return {
    component: 'multi_course_page',
    title,
    zenler_course_id: zenlerCourseId,
    seo: [],
    scripts: [],
    tag: hero?.eyebrow?.trim() || 'ACCA · Strategic Professional · Combo pack',
    heading,
    heading_accent: 'Combo Pack.',
    lead,
    meta_items: [
      { _uid: uid(), component: 'multi_course_meta', text: 'Pick any 2 of 6 papers' },
      { _uid: uid(), component: 'multi_course_meta', text: 'Annual access' },
      { _uid: uid(), component: 'multi_course_meta', text: 'Tutor support' },
    ],
    selection_count: 2,
    picker_title: 'Choose your 2 papers',
    picker_subtitle: 'Select exactly two Strategic Professional papers to include in your combo.',
    picker_hint: 'You can mix Essentials and Options — any two papers qualify for the combo price.',
    paper_options: DEFAULT_PAPERS.map((p) => paperBlok(p, '')),
    buy_card_tag: 'Combo pack · 2 papers',
    buy_card_title: 'Build your combo',
    buy_footer_items: [
      featureBlok('Annual access to both courses'),
      featureBlok('30-day satisfaction guarantee'),
      featureBlok('Secure checkout'),
    ],
    features_heading: "What's included for both papers",
    features: DEFAULT_FEATURES.map(featureBlok),
  };
}

export function buildMultiCourseStructureBody(): Record<string, unknown>[] {
  return [];
}
