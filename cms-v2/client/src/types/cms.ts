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

// ── Events ───────────────────────────────────────────────────────────────────

export type EventDescriptionBlock =
  | { type: 'heading-para'; heading: TextValue; para: TextValue }
  | { type: 'paragraph'; para: TextValue }
  | { type: 'list'; items: TextValue[] };

export interface VlsEvent {
  id: string;
  name: TextValue;
  startsAt: string;
  endsAt: string;
  timezone: string;
  description: EventDescriptionBlock[];
  venue: TextValue;
  hosts: TextValue;
  ctaText: TextValue;
  ctaUrl: string;
  createdAt: string;
}

export interface EventsContent { events: VlsEvent[]; }

// ── FAQ ──────────────────────────────────────────────────────────────────────

export type FaqAnswerType = 'paragraph' | 'heading-para' | 'bullets' | 'heading-bullets';

export interface FaqItem {
  id: string;
  type: FaqAnswerType;
  question: TextValue;
  heading: TextValue;
  para: TextValue;
  items: TextValue[];
}

export interface FaqSection {
  id: string;
  name: string;
  icon: string;
  title: TextValue;
  titleGap: number;
  items: FaqItem[];
}

export interface FaqContent { sections: FaqSection[]; }

// ── Articles ─────────────────────────────────────────────────────────────────

export interface ArticleItem {
  code: string;
  title: string;
  desc: string;
  url: string;
}

export interface ArticleGroup {
  title: string;
  short: string;
  color: string;
  articles: ArticleItem[];
}

export interface ArticleSection {
  id: string;
  name: string;
  paperCode: string;
  paperTitle: string;
  theme: string;
  hubUrl: string;
  headingStyle: TextValue;
  bodyStyle: TextValue;
  rowTitleStyle: TextValue;
  notice: TextValue;
  groups: ArticleGroup[];
}

export interface ArticleGroupsContent { sections: ArticleSection[]; }

// ── Blog ─────────────────────────────────────────────────────────────────────

export type BlogStatus = 'draft' | 'published';

export interface BlogImage {
  sourceUrl: string;
  localPath: string;
  alt: string;
  contentType: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  topic: string;
  tags: string[];
  summary: string;
  bodyHtml: string;
  featuredImagePath: string;
  images: BlogImage[];
  originalSourceUrl: string;
  canonicalUrl: string;
  metaTitle: string;
  metaDescription: string;
  author: string;
  publishDate: string;
  createdDate: string;
  updatedDate: string;
  status: BlogStatus;
  url?: string;
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

// ── Gradient Banner Section ───────────────────────────────────────────────────

export interface GradientBannerSection {
  id: string;
  name: string;
  gradientLeft: string;
  gradientRight: string;
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  eyebrow: TextValue;
  title: TextValue;
  desc: TextValue;
  primaryText: TextValue;
  primaryUrl: string;
  primaryBg: string;
  secondaryText: TextValue;
  secondaryUrl: string;
  secondaryBg: string;
  secondaryBorder: string;
}

export interface GradientBannerContent { sections: GradientBannerSection[]; }

// ── Banner ────────────────────────────────────────────────────────────────────

export interface Banner {
  id: string;
  name: string;
  visible: boolean;
  hideOnExpiry: boolean;
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
  deadline?: number;
}

export interface BannerContent { banners: Banner[]; }

// ── Course Price ──────────────────────────────────────────────────────────────

export interface CoursePrice {
  id: string;
  name: string;
  visible: boolean;
  courseId?: number;
  eyebrow: string;
  title: string;
  regularPrice: number;
  discountPercent: number;
  currency: string;
  priceLabel: string;
  savingPrefix: string;
  includesLabel: string;
  includes: string[];
  ctaText: string;
  ctaUrl: string;
  refundText: string;
  bg: string;
  border: string;
  accent: string;
  discountBg: string;
  discountTc: string;
  saveBg: string;
  saveBorder: string;
  radius: number;
  fontFamily?: string;
  eyebrowSize?: number;
  eyebrowWeight?: number;
  titleSize?: number;
  titleWeight?: number;
  amountSize?: number;
  bodySize?: number;
  ctaSize?: number;
  ctaWeight?: number;
}

export interface CoursePriceContent { prices: CoursePrice[]; }

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

// ── Split Screen Sections ────────────────────────────────────────────────────

export interface SplitSectionCard {
  type: 'card' | 'card-image' | 'image';
  cardBg?: string;
  cardBorder?: string;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  imageUrl?: string;
  imageAlt?: string;
  borderRadius?: string;
  maxWidth?: string;
  halfWidth?: boolean;
  title?: TextValue;
  desc?: TextValue;
  ctaText?: TextValue;
  ctaUrl?: string;
  ctaBg?: string;
  ctaColor?: string;
  statValue?: string;
  statLabel?: string;
  statBg?: string;
  statValueColor?: string;
  statLabelColor?: string;
}

export interface SplitContentSection {
  id: string;
  name: string;
  bg: string;
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  imageBoxWidth: number;
  imageBoxHeight: number;
  eyebrow: TextValue;
  heading: TextValue;
  desc: TextValue;
  cards: SplitSectionCard[];
}

export interface LeftHeroPathwayItem { icon: string; text: string; }
export interface LeftHeroStatItem { value: string; label1: string; label2: string; }
export interface LeftHeroTrustItem { icon: string; text: string; }

export interface PageLeftHeroState {
  bg: string;
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  breadcrumb: string;
  breadcrumbTc: string;
  eyebrowTc: string;
  eyebrowDotColor: string;
  eyebrowLabels: string[];
  heading: TextValue;
  headingAccent: string;
  headingAccentColor: string;
  descSize: number;
  descTc: string;
  descs: string[];
  pillBg: string;
  pillBorder: string;
  pillTc: string;
  arrowColor: string;
  pathwayItems: LeftHeroPathwayItem[];
  primaryCta: string;
  primaryCtaUrl: string;
  primaryCtaScroll: string;
  primaryBg: string;
  primaryTc: string;
  secondaryCta: string;
  secondaryCtaUrl: string;
  secondaryCtaScroll: string;
  secondaryBorder: string;
  secondaryTc: string;
  statsVc: string;
  statsLc: string;
  statsDiv: string;
  statsItems: LeftHeroStatItem[];
  trustTc: string;
  trustSep: string;
  trustItems: LeftHeroTrustItem[];
}

export interface PageLeftHeroComponent { id: string; name: string; data: PageLeftHeroState; }
export interface SplitSectionsContent { sections: SplitContentSection[]; }
export interface PageLeftHeroContent { components: PageLeftHeroComponent[]; }

export interface GenericSectionState {
  bg: string;
  padTop: number;
  padBot: number;
  padLeft: number;
  padRight: number;
  maxWidth: number;
  eyebrow: TextValue;
  heading: TextValue;
  body: TextValue;
  calloutShow: boolean;
  calloutIcon: string;
  calloutBg: string;
  calloutBorder: string;
  calloutText: TextValue;
}
export interface GenericSectionComponent { id: string; name: string; data: GenericSectionState; }
export interface GenericSectionContent { components: GenericSectionComponent[]; }

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

// ── Feature Cards ─────────────────────────────────────────────────────────────
export interface FcCard { color: string; eyebrow: TextValue; title: TextValue; subtitle: TextValue; ctaText: TextValue; ctaUrl: string; }
export interface FcState { padLeft: number; padRight: number; eyebrow: TextValue; title: TextValue; desc: TextValue; cards: FcCard[]; }
export interface FcComponent { id: string; name: string; data: FcState; }
export interface FcContent { components: FcComponent[]; }

// ── Feature Card v2 ───────────────────────────────────────────────────────────
export interface Fc2Card { lineColor: string; title: TextValue; desc: TextValue; ctaText: TextValue; ctaUrl: string; }
export interface Fc2State { bg: string; sepColor: string; padTop: number; padBottom: number; padLeft: number; padRight: number; cols: number; cards: Fc2Card[]; }
export interface Fc2Component { id: string; name: string; data: Fc2State; }
export interface Fc2Content { components: Fc2Component[]; }

// ── Feature Card v3 ───────────────────────────────────────────────────────────
export interface Fc3Tag { code: string; name: string; }
export interface Fc3Card {
  type?: 'standard' | 'cta';
  headerBg: string;
  number: string;
  headerLabel?: string;
  title: string;
  subtitle: string;
  tags: Fc3Tag[];
  footerHtml?: string;
  ctaText?: string;
  ctaUrl?: string;
  ctaBg?: string;
  ctaColor?: string;
}
export interface Fc3State { bg: string; padTop: number; padBottom: number; padLeft: number; padRight: number; cols: number; gap: number; eyebrow: string; eyebrowColor: string; headingText: string; headingColor: string; descText: string; descColor: string; cardTitleStyle: TextValue; cardSubStyle: TextValue; cardItemStyle: TextValue; cards: Fc3Card[]; }
export interface Fc3Component { id: string; name: string; data: Fc3State; }
export interface Fc3Content { components: Fc3Component[]; }

// ── Feature Card v4 ───────────────────────────────────────────────────────────
export interface Fc4Card { badge: string; badgeBg: string; badgeTc: string; title: string; subtitle: string; ctaText: string; ctaUrl: string; }
export interface Fc4State { bg: string; padTop: number; padBottom: number; padLeft: number; padRight: number; maxWidth: number; cols: number; gap: number; eyebrow: string; eyebrowTc: string; heading: string; headingTc: string; cardBg: string; cardBorder: string; cardRadius: number; titleTc: string; subtitleTc: string; ctaTc: string; cards: Fc4Card[]; }
export interface Fc4Component { id: string; name: string; data: Fc4State; }
export interface Fc4Content { components: Fc4Component[]; }

// ── Program Cards V2 ──────────────────────────────────────────────────────────
export interface Pcv2Card { id: string; imageUrl: string; imageAlt: string; accent: string; ctaBg: string; tagBg: string; cardBg: string; eyebrow: TextValue; title: TextValue; desc: TextValue; chips: string; meta: TextValue; cta: TextValue; url: string; }
export interface Pcv2State { bg: string; maxWidth: number; gap: number; cards: Pcv2Card[]; }
export interface Pcv2Component { id: string; name: string; data: Pcv2State; }
export interface Pcv2Content { components: Pcv2Component[]; }

// ── Legal Page ────────────────────────────────────────────────────
export type PolicyBlockType = 'paragraph' | 'bullets' | 'table' | 'cards' | 'rights' | 'tags' | 'definitions' | 'alpha-list' | 'icon-cards' | 'link-cards' | 'cta-banner' | 'callout';
export interface PolicyBlock {
  type: PolicyBlockType;
  text?: string;
  items?: any[];
  cols?: number | string;
  headers?: string;
  rows?: string;
  icon?: string;
  bg?: string;
  color?: string;
  titleColor?: string;
  descColor?: string;
  btnBg?: string;
  btnColor?: string;
  title?: string;
  desc?: string;
  btnText?: string;
  btnUrl?: string;
  url?: string;
  linkText?: string;
  iconBg?: string;
}
export interface PolicySection { id: string; title: string; bg: string; blocks: PolicyBlock[]; }
export interface LegalPageState { hdrBg: string; eyebrow: string; title: string; navWidth: number | string; navBg: string; accent: string; meta: string[]; sections: PolicySection[]; }
export interface LegalPageComponent { id: string; name: string; data: LegalPageState; }
export interface LegalPageContent { components: LegalPageComponent[]; }

// ── Team ──────────────────────────────────────────────────────────
export interface TeamFeature { value: string; label: string; }
export interface TeamCard { id: string; eyebrow: TextValue; name: TextValue; designation: TextValue; imgUrl: string; features: TeamFeature[]; paras: string[]; tags: string[]; }
export interface TeamContent { cards: TeamCard[]; }

// ── Step Cards ────────────────────────────────────────────────────────────────
export interface StepCard { title: TextValue; desc: TextValue; }
export interface StepsState { bg: string; padLeft: number; padRight: number; cols: number; eyebrow: TextValue; title: TextValue; desc: TextValue; cards: StepCard[]; }
export interface StepsComponent { id: string; name: string; data: StepsState; }
export interface StepsContent { components: StepsComponent[]; }

// ── Program Cards ─────────────────────────────────────────────────────────────
export interface ProgramCard { id: string; title: TextValue; desc: TextValue; url: string; cta: TextValue; cardBg: string; badge: string; rating: string; hours: string; }
export interface ProgramTopic { id: string; title: TextValue; topicColor: string; badgeBg: string; badgeOpacity: number; badgeTextStyle?: TextValue; cards: ProgramCard[]; }
export interface ProgramsState { topics: ProgramTopic[]; }
export interface ProgramsComponent { id: string; name: string; data: ProgramsState; }
export interface ProgramsContent { components: ProgramsComponent[]; }

// ── Full Screen Sections ──────────────────────────────────────────────────────

// Two Column v1 (DCS) — left text + right icon cards
export interface DcsCard { icon: string; iconBg: string; title: TextValue; desc: TextValue; }
export interface DcsState {
  padTop: number; padBot: number; padLeft: number; padRight: number;
  leftWidth: number; leftBg: string; rightBg: string; cardBg: string;
  leftLabel: TextValue; leftTitle: TextValue; leftParas: TextValue[];
  rightLabel: TextValue; cards: DcsCard[];
}
export interface DcsComponent { id: string; name: string; data: DcsState; }

// Two Column v2 (DCS2) — left text+bullets + right stats+quote
export interface DcsStat { value: TextValue; label: TextValue; }
export interface Dcs2State {
  padTop: number; padBot: number; padLeft: number; padRight: number;
  leftWidth: number; leftBg: string; rightBg: string;
  leftLabel: TextValue; leftTitle: TextValue; leftParas: TextValue[];
  bulletColor: string; leftBullets: TextValue[];
  rightLabel: TextValue; statBg: string; statBorder: string; statsPerRow: number;
  stats: DcsStat[];
  quoteShow: boolean; quoteBg: string; quoteText: TextValue; quoteAttrib: TextValue;
}
export interface Dcs2Component { id: string; name: string; data: Dcs2State; }

// Two Column v3 (DCS3) — left text+features + right text+tags+CTA
export interface Dcs3Feature { title: TextValue; desc: TextValue; }
export interface Dcs3Tag { icon: string; text: TextValue; }
export interface Dcs3State {
  padTop: number; padBot: number; leftPadH: number; rightPadH: number;
  leftWidth: number; leftBg: string; rightBg: string;
  checkColor: string; featBg: string; featCols: number; tagBg: string;
  ctaUrl: string; ctaColor: string; ctaBorder: string; ctaFill: string;
  leftLabel: TextValue; leftTitle: TextValue; leftPara: TextValue;
  rightLabel: TextValue; rightTitle: TextValue; rightPara: TextValue;
  ctaText: TextValue; features: Dcs3Feature[]; tags: Dcs3Tag[];
}
export interface Dcs3Component { id: string; name: string; data: Dcs3State; }

// Global Reach — left text+stats + right image+regions
export interface ReachStat { value: TextValue; label: TextValue; }
export interface ReachRegion { flag: string; code: string; name: TextValue; sub: TextValue; }
export interface ReachState {
  padTop: number; padBot: number; padLeft: number; padRight: number;
  bg: string; leftWidth: number; statBg: string;
  imgHeight: number; imgBg: string; imgUrl: string; imgAlt: string; imgPlaceholder: string;
  regionBg: string; label: TextValue; title: TextValue; para: TextValue;
  stats: ReachStat[]; regions: ReachRegion[];
}
export interface ReachComponent { id: string; name: string; data: ReachState; }

// ── Page Hero Banner (PHB) ────────────────────────────────────────────────────
export interface PhbState {
  bg: string; radius: number;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  eyebrow: string; eyebrowTc: string;
  showDot: boolean; dotColor: string;
  heading: TextValue;
  bulletTc: string; sepColor: string;
  bullets: string[];
  showBadge: boolean; badgeBg: string; badgeRadius: number;
  badgeEyebrow: string; badgeEyebrowTc: string;
  badgeMain: TextValue;
  badgeSub: string; badgeSubTc: string;
}
export interface PhbComponent { id: string; name: string; data: PhbState; }

// ── Page Hero Banner V2 (PHV2) ────────────────────────────────────────────────
export interface Phv2TrustItem { icon: string; text: string; }
export interface Phv2Card { type: 'stat' | 'info' | 'tags'; full: boolean; value: string; label: string; }
export interface Phv2State {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  split: number; colGap: number;
  breadcrumb: string; breadcrumbTc: string;
  eyebrowTc: string; eyebrowDot: string; eyebrowLabels: string[];
  heading: TextValue; headingAccent: string; headingAccentColor: string; headingPost: string;
  desc: TextValue;
  trustTc: string; trustDot: string; trustItems: Phv2TrustItem[];
  cardBg: string; cardBorder: string; cardRadius: number; cardVc: string; cardLc: string;
  cards: Phv2Card[];
}
export interface Phv2Component { id: string; name: string; data: Phv2State; }

// Page Hero Banner V3 (PHV3) - mock exam sales hero
export interface Phv3Feature { icon: string; text: string; }
export interface Phv3Stat { value: string; label: string; }
export interface Phv3Include { icon: string; title: string; desc: string; }
export interface Phv3State {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  split: number; colGap: number; railMaxWidth: number; actionMaxWidth: number;
  breadcrumb: string; eyebrowLabels: string[];
  heading: TextValue; desc: TextValue;
  chipBg: string; chipBorder: string; chipTc: string;
  features: Phv3Feature[];
  formatLabel: string; formatBg: string; formatBorder: string;
  stats: Phv3Stat[];
  primaryText: string; primaryUrl: string; primaryScroll: string; primaryBg: string; primaryTc: string;
  secondaryText: string; secondaryUrl: string; secondaryScroll: string; secondaryBg: string; secondaryTc: string; secondaryBorder: string;
  cardLabel: string; cardTitle: string; cardTop: string; cardMarks: string; cardPrimaryText: string; cardPrimaryUrl: string; cardPrimaryScroll: string;
  cardBg: string; cardHeaderBg: string; cardBorder: string; cardButtonBg: string;
  sampleText: string; sampleUrl: string; sampleScroll: string; includesTitle: string; includes: Phv3Include[];
  refundText: string;
}
export interface Phv3Component { id: string; name: string; data: Phv3State; }

// Hero Section V2
export interface HeroV2Cta { text: string; url: string; scroll: string; style: 'solid' | 'outlined'; bg: string; tc: string; bc: string; }
export interface HeroV2Stat { value: string; label: string; }
export type HeroV2RCardType = 'stat' | 'info' | 'tags';
export interface HeroV2RCard { type: HeroV2RCardType; icon: string; iconBg: string; title: string; subtitle: string; count: string; url: string; tags?: string[]; }
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

// ── Page Description with Menu ─────────────────────────────────────────────────
export interface PageDescMenuItem { title: string; scrollTarget: string; }

export interface PageDescWithMenuState {
  menuTitle: string;
  menuBg: string;
  menuItemTc: string;
  menuActiveBg: string;
  menuActiveTc: string;
  menuItems: PageDescMenuItem[];
  bannerHeading?: string;
  bannerSubheading?: string;
  bannerCtaText?: string;
  bannerCtaUrl?: string;
  bannerCtaNewTab?: boolean;
  icon: string;
  title: string;
  titleTc: string;
  titleSize: number;
  introBold: TextValue;
  introP1: TextValue;
  introP2: TextValue;
  blocks: CourseDescBlock[];
}

export interface PageDescWithMenuComponent { id: string; name: string; data: PageDescWithMenuState; }
export interface PageDescWithMenuContent { components: PageDescWithMenuComponent[]; }

// ── Book a Meeting Section (BMS) ──────────────────────────────────────────────
export interface BmsCheckItem { text: TextValue; }
export interface BmsState {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  imgUrl: string; imgAlt: string; imgSplit: number; imgFit: string; imgPosition: string;
  eyebrow: string; eyebrowColor: string; eyebrowDot: boolean;
  headingPre: TextValue; headingAccent: string; headingAccentColor: string;
  desc: TextValue;
  checkColor: string; checks: BmsCheckItem[];
  ctaText: TextValue; ctaUrl: string; ctaBg: string; ctaTc: string;
  footerNote: string; footerNoteTc: string;
}
export interface BmsComponent { id: string; name: string; data: BmsState; }

// ── Content CTA Block (CB) — single-column, no image ─────────────────────────
export interface CbState {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  maxWidth: number;
  eyebrow: string; eyebrowColor: string; eyebrowDot: boolean;
  headingPre: TextValue; headingAccent: string; headingAccentColor: string;
  desc: TextValue;
  checkColor: string; checks: BmsCheckItem[];
  ctaText: TextValue; ctaUrl: string; ctaBg: string; ctaTc: string;
  footerNote: string; footerNoteTc: string;
}
export interface CbComponent { id: string; name: string; data: CbState; }

// ── Banner V2 (BV2) — single-column process strip ───────────────────────────
export interface Bv2Step { number: string; title: string; desc: TextValue; }
export interface Bv2State {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  maxWidth: number; gap: number;
  eyebrow: string; eyebrowColor: string;
  numberBg: string; numberTc: string;
  titleTc: string;
  desc: TextValue;
  steps: Bv2Step[];
}
export interface Bv2Component { id: string; name: string; data: Bv2State; }

// ── Payment Plans (PP) — component-owned live price cards ────────────────────
export interface PaymentPlanCard {
  label: string;
  title: string;
  regularPrice: number;
  discountPercent: number;
  currency: string;
  priceLabel: string;
  feature: string;
  badge: string;
  featured: boolean;
  accent: string;
  ctaText: string;
  ctaUrl: string;
  ctaStyle: 'solid' | 'outline';
  refundText: string;
  // Course mapping
  courseId?: number;
  // Per-card typography
  fontFamily?: string;
  labelSize?: number; labelWeight?: number;
  titleSize?: number; titleWeight?: number;
  priceLabelSize?: number; priceLabelWeight?: number;
  amountSize?: number;
  featureSize?: number; featureWeight?: number;
  ctaSize?: number; ctaWeight?: number;
  refundSize?: number; refundWeight?: number;
  badgeSize?: number; badgeWeight?: number;
}
export interface PaymentIncludedItem { text: string; }
export interface PaymentPlansState {
  bg: string;
  padTop: number; padBot: number; padLeft: number; padRight: number;
  maxWidth: number; sectionBg: string; border: string; radius: number;
  eyebrow: string; eyebrowColor: string;
  title: string; desc: string;
  cards: PaymentPlanCard[];
  includedBg: string; includedTitle: string; includedItems: PaymentIncludedItem[];
  helpText: string;
}
export interface PaymentPlansComponent { id: string; name: string; data: PaymentPlansState; }
