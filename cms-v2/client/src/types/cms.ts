export interface TextData {
  text: string;
  size: number;
  color: string;
  weight: string;
  letterSpacing: number;
}

export type TextValue = TextData | string;

export interface HeroSection {
  id: string;
  name: string;
  bg: string;
  maxW: string;
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  h1Size: number;
  eyebrow: TextValue;
  h1: TextValue;
  h1hl: TextValue;
  h2: TextValue;
  desc: TextValue;
  b1t: TextValue;
  b1u: string;
  b1s: string;
  b2t: TextValue;
  b2u: string;
  b2s: string;
  tags: TextValue[];
  stats: Array<{ v: TextValue; l: TextValue }>;
}

export interface HeroContent {
  sections: HeroSection[];
}

// ── About Us ──────────────────────────────────────────────────────────────────

export interface AboutUsCard {
  icon: string;
  title: TextValue;
  desc: TextValue;
}

export interface AboutUsSection {
  id: string;
  name: string;
  padLeft: number;
  padRight: number;
  eyebrow: TextValue;
  title: TextValue;
  paragraphs: TextValue[];
  ctaText: TextValue;
  ctaUrl: string;
  cards: AboutUsCard[];
}

export interface AboutUsContent {
  sections: AboutUsSection[];
}

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
}

// ── Promotion Section ─────────────────────────────────────────────────────────

export interface PromoSection {
  id: string;
  name: string;
  bg: string;
  btnBg: string;
  padLeft: number;
  padRight: number;
  title: TextValue;
  subtitle: TextValue;
  ctaText: TextValue;
  ctaUrl: string;
}

export interface PromoContent { sections: PromoSection[]; }

// ── Banner ────────────────────────────────────────────────────────────────────

export interface Banner {
  id: string;
  name: string;
  visible: boolean;
  title: TextValue;
  sub: TextValue;
  ctaText: TextValue;
  ctaUrl: string;
  days: number;
  hours: number;
  mins: number;
  secs: number;
  bg: string;
  fg: string;
  btnBg: string;
  btnFg: string;
  padLeft: number;
  padRight: number;
}

export interface BannerContent { banners: Banner[]; }

// ── Footer ────────────────────────────────────────────────────────────────────

export interface FooterLink { id: string; label: TextValue; url: string; }
export interface FooterSection { title: TextValue; links: FooterLink[]; }
export interface FooterContact { title: TextValue; address: TextValue; email: TextValue; whatsapp: TextValue; }
export interface FooterSocial { id: string; platform: string; url: string; }
export interface FooterCopyright { text: TextValue; links: FooterLink[]; }
export interface FooterData {
  sections: FooterSection[];
  contact: FooterContact;
  socials: FooterSocial[];
  copyright: FooterCopyright;
}

// ── Header ────────────────────────────────────────────────────────────────────

export interface HeaderCta {
  id: string;
  label: TextValue;
  url: string;
  bgColor: string;
  textColor: string;
  newTab: boolean;
}

export interface HeaderMenuItem {
  id: string;
  label: TextValue;
  url: string;
  newTab: boolean;
  children: HeaderMenuItem[];
}

export interface HeaderConfig {
  logoUrl: string;
  logoAlt: string;
  logoLink: string;
  logoHeight: number;
  siteTitle: TextValue;
  subTitle: TextValue;
  topbarBg: string;
  topbarText: string;
  brandBg: string;
  menuBg: string;
  menuText: string;
  menuHover: string;
  dropBg: string;
  dropText: string;
  containerWidth: number;
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  dropSpacing: number;
  ctas: HeaderCta[];
  menuItems: HeaderMenuItem[];
  useZenMenu: boolean;
}

// ── Contact Footer ────────────────────────────────────────────────────────────

export interface CfItem { icon: string; iconBg: string; title: TextValue; value: TextValue; href: string; }

export interface CfState {
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  bg: string;
  border: string;
  leftWidth: number;
  label: TextValue;
  company: TextValue;
  address: TextValue;
  items: CfItem[];
}

export interface CfComponent { id: string; name: string; data: CfState; }
export interface CfContent { components: CfComponent[]; }

// ── Course Hero Left ──────────────────────────────────────────────────────────

export interface CourseHeroPill { icon: string; value: string; label: string; }
export interface CourseHeroLearnItem { title: string; subtitle: string; fullWidth: boolean; }

export interface CourseHeroState {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  breadcrumb: string;
  eyebrowTc: string; eyebrowDot: string;
  heading: TextValue;
  desc: TextValue;
  tags: string[];
  pillBg: string; pillBorder: string; pillVc: string; pillLc: string;
  pills: CourseHeroPill[];
  learnLabel: string;
  learnLabelTc: string; learnBg: string; learnBorder: string;
  learnCc: string; learnTitleTc: string; learnSubTc: string;
  learnItems: CourseHeroLearnItem[];
}
export interface CourseHeroComponent { id: string; name: string; data: CourseHeroState; }
export interface CourseHeroContent { components: CourseHeroComponent[]; }

// ── Course Hero Right ─────────────────────────────────────────────────────────

export interface CourseHeroRightItem { icon: string; title: TextValue; desc: TextValue; badge: string; }

export interface CourseHeroRightState {
  bg: string; border: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  radius: number; divider: string; iconBg: string;
  badgeBg: string; badgeTc: string;
  labelText: string;
  ctaUrl: string; ctaText: string; ctaBg: string; ctaTc: string; ctaRadius: number;
  items: CourseHeroRightItem[];
}
export interface CourseHeroRightComponent { id: string; name: string; data: CourseHeroRightState; }
export interface CourseHeroRightContent { components: CourseHeroRightComponent[]; }

// ── Course Description ────────────────────────────────────────────────────────

export type CourseDescBlockType = 'paragraph' | 'heading-paragraph' | 'heading-bullets' | 'bullets' | 'items' | 'note';

export interface CourseDescBlock {
  type: CourseDescBlockType;
  h?: TextValue;
  p?: TextValue;
  bullets?: TextValue[];
  items?: Array<{ h: TextValue; p: TextValue }>;
}

export interface CourseDescState {
  icon: string; title: string; titleTc: string; titleSize: number;
  introBold: TextValue; introP1: TextValue; introP2: TextValue;
  blocks: CourseDescBlock[];
}
export interface CourseDescComponent { id: string; name: string; data: CourseDescState; }
export interface CourseDescContent { components: CourseDescComponent[]; }

// ── Course Tabs ───────────────────────────────────────────────────────────────

export interface CourseTabCard {
  icon: string; subtitle?: string;
  title: TextValue; desc: TextValue;
  badge?: string; cta?: string; url?: string;
}

export interface CourseTabStep {
  icon?: string;
  title: TextValue; desc: TextValue;
  cta?: string; url?: string;
}

export interface CourseTabSupportRow { cols: 1 | 2; cards: CourseTabCard[]; }

export type CourseTabBlockType = 'panel-intro' | 'paragraph' | 'heading-para' | 'bullets' | 'assurance' | 'inc-cards' | 'steps' | 'support-cards' | 'more-cards' | 'banner';

export interface CourseTabBlockData {
  eyebrow?: string; heading?: string; desc?: string;
  title?: string; icon?: string; bg?: string; cta?: string; url?: string;
  para?: TextValue;
  headingRich?: TextValue;
  items?: TextValue[];
  cards?: CourseTabCard[];
  steps?: CourseTabStep[];
  rows?: CourseTabSupportRow[];
}

export interface CourseTabBlock { type: CourseTabBlockType; data: CourseTabBlockData; }
export interface CourseTab { id: string; icon: string; label: string; blocks: CourseTabBlock[]; }
export interface CourseTabsState { tabs: CourseTab[]; }
export interface CourseTabsComponent { id: string; name: string; data: CourseTabsState; }
export interface CourseTabsContent { components: CourseTabsComponent[]; }

// Hero Section V2
export interface HeroV2Cta { text: string; url: string; scroll: string; style: 'solid' | 'outlined'; bg: string; tc: string; bc: string; }
export interface HeroV2Stat { value: string; label: string; }
export interface HeroV2RCard { icon: string; iconBg: string; title: string; subtitle: string; count: string; url: string; }
export interface HeroV2State {
  bg: string;
  leftW: number;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  dotColor: string; hlColor: string; tagBg: string; tagTc: string; cardBg: string;
  eyebrow: TextValue; heading: TextValue; highlight: TextValue; body: TextValue;
  tags: string[];
  ctas: HeroV2Cta[];
  stats: HeroV2Stat[];
  rcards: HeroV2RCard[];
}
export interface HeroV2Component { id: string; name: string; data: HeroV2State; }
export interface HeroV2Content { components: HeroV2Component[]; }
