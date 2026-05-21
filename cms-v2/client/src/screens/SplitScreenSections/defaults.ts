import type { GenericSectionState, PageLeftHeroState, SplitContentSection } from '../../types/cms';
import { normalize } from '../../utils/text';

export function makeLeftHero(): PageLeftHeroState {
  return {
    bg: '#0d1f3c',
    padTop: 48,
    padBot: 56,
    padLeft: 60,
    padRight: 40,
    breadcrumb: 'Home > ACCA > Foundation Diploma',
    breadcrumbTc: '#94a3b8',
    eyebrowTc: '#4a90d9',
    eyebrowDotColor: '#4a90d9',
    eyebrowLabels: ['ACCA', 'Foundations in Accountancy'],
    heading: normalize('', 'plhHeading'),
    headingAccent: '',
    headingAccentColor: '#4a90d9',
    descSize: 15,
    descTc: '#cbd5e1',
    descs: [],
    pillBg: '#132343',
    pillBorder: '#1e3a5f',
    pillTc: '#ffffff',
    arrowColor: '#4a90d9',
    pathwayItems: [
      { icon: '', text: 'Foundation Diploma (FIA)' },
      { icon: '', text: '3 Exemptions granted' },
      { icon: '', text: 'ACCA Professional Qualification' },
    ],
    primaryCta: 'View Courses',
    primaryCtaUrl: '',
    primaryCtaScroll: '',
    primaryBg: '#204280',
    primaryTc: '#ffffff',
    secondaryCta: 'Book a free meeting',
    secondaryCtaUrl: '',
    secondaryCtaScroll: '',
    secondaryBorder: '#4a5568',
    secondaryTc: '#ffffff',
    statsVc: '#ffffff',
    statsLc: '#94a3b8',
    statsDiv: '#1e3a5f',
    statsItems: [
      { value: '75,000+', label1: 'STUDENTS', label2: 'SINCE 2007' },
      { value: '7 Papers', label1: 'TO COMPLETE THE', label2: 'DIPLOMA' },
      { value: '3', label1: 'ACCA EXEMPTIONS', label2: 'EARNED' },
    ],
    trustTc: '#94a3b8',
    trustSep: '#4a90d9',
    trustItems: [
      { icon: '', text: 'ACCA Approved Content' },
      { icon: '', text: 'Students in 88 countries' },
      { icon: '', text: 'office@vls-online.com' },
    ],
  };
}

export function makeLeftGeneric(counter = 1): SplitContentSection {
  return {
    id: `lgs-${Date.now().toString(36)}`,
    name: `Left Generic Section ${counter}`,
    bg: '#ffffff',
    imageBoxWidth: 100,
    imageBoxHeight: 180,
    eyebrow: normalize('Overview', 'lgsEyebrow'),
    heading: normalize('', 'lgsHeading'),
    desc: normalize('', 'lgsDesc'),
    cards: [],
  };
}

export function makeRightPane(counter = 1): SplitContentSection {
  return {
    id: `rps-${Date.now().toString(36)}`,
    name: `Right Pane Section ${counter}`,
    bg: '#0f1e3c',
    imageBoxWidth: 100,
    imageBoxHeight: 180,
    eyebrow: normalize('How long does ACCA take?', 'rpsEyebrow'),
    heading: normalize('', 'rpsHeading'),
    desc: normalize('', 'rpsDesc'),
    cards: [
      {
        type: 'card',
        cardBg: '#1a2d4a',
        cardBorder: '#1e3a5f',
        icon: '',
        iconBg: '#1e3a5f',
        iconColor: '#f59e0b',
        title: normalize('Completion time varies by student', 'rpsCardTitle'),
        desc: normalize('Depends on prior qualifications, exemptions, study pace, and work commitments.', 'rpsCardDesc'),
        statValue: '2-4',
        statLabel: 'Years to complete for most students',
        statBg: '#1e3a5f',
        statValueColor: '#ffffff',
        statLabelColor: '#94a3b8',
      },
    ],
  };
}

export function makeGenericSection(): GenericSectionState {
  return {
    bg: '#ffffff',
    padTop: 64,
    padBot: 64,
    padLeft: 48,
    padRight: 48,
    maxWidth: 760,
    eyebrow: normalize('Why mock exams matter', 'lgsEyebrow'),
    heading: normalize('The most effective way to prepare for your ACCA final exam', 'lgsHeading'),
    body: normalize('', 'lgsDesc'),
    calloutShow: true,
    calloutIcon: '💡',
    calloutBg: '#eaf5ff',
    calloutBorder: '#b9dcff',
    calloutText: normalize('Pro tip from our tutors: Attempt your mock exam at least 2 weeks before the real exam — this gives you enough time to address the weaknesses it reveals.', 'lgsCardDesc'),
  };
}
