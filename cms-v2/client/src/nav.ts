export type NavItem       = { to: string; label: string };
export type NavSubGroup   = { sub: string; children: NavItem[] };
export type NavGroupChild = NavItem | NavSubGroup;
export type NavGroup      = { group: string; children: NavGroupChild[] };

export const NAV: NavGroup[] = [
  {
    group: 'Global',
    children: [
      { to: '/header',            label: 'Header' },
      { to: '/blog-header',       label: 'Blog Header' },
      { to: '/footer',            label: 'Footer' },
      { to: '/banner',            label: 'Banner' },
      { to: '/promotion-section', label: 'Promotion Section' },
      { to: '/contact-footer',    label: 'Contact Footer' },
    ],
  },
  {
    group: 'Home Page',
    children: [
      { to: '/home-hero', label: 'Hero — Left Pane' },
      { to: '/about-us',  label: 'About Us' },
    ],
  },
  {
    group: 'Course Page',
    children: [
      { to: '/course-hero',       label: 'Left Hero Section' },
      { to: '/course-hero-right', label: 'Right Hero Section' },
      { to: '/course-desc',       label: 'Course Description' },
      { to: '/course-tabs',       label: 'Course Tabs' },
      { to: '/course-finder',     label: 'Course Finder' },
      { to: '/course-finder-banner', label: 'Course Finder Banner' },
      { to: '/hero-section-v2',   label: 'Hero Section V2' },
      { to: '/payment-cards',     label: 'Payment Cards' },
      { to: '/course-price',      label: 'Course Price Card' },
    ],
  },
  {
    group: 'Page Templates',
    children: [
      { to: '/events',     label: 'Events' },
      { to: '/articles',   label: 'Articles' },
      { to: '/blog',       label: 'Blog Import' },
      { to: '/bpp-books',  label: 'BPP Books' },
      { to: '/book-a-meeting', label: 'Book a Meeting' },
      { to: '/legal-page', label: 'Legal Page' },
      { to: '/team',       label: 'Team' },
    ],
  },
  {
    group: 'Site wide Sections',
    children: [
      { to: '/faq', label: 'FAQ' },
    ],
  },
  {
    group: 'Forms',
    children: [
      { to: '/forms/contact',         label: 'Contact Form' },
      { to: '/forms/contact-page',    label: 'Contact Page Form' },
      { to: '/forms/report-issue',    label: 'Report an Issue' },
      { to: '/forms/report-issue-ty', label: 'Report an Issue - TY' },
    ],
  },
  {
    group: 'Page Builder',
    children: [
      {
        sub: 'Full Screen Sections',
        children: [
          { to: '/full-screen/dcs',            label: 'Two Column v1' },
          { to: '/full-screen/dcs2',           label: 'Two Column v2' },
          { to: '/full-screen/dcs3',           label: 'Two Column v3' },
          { to: '/full-screen/reach',          label: 'Global Reach' },
          { to: '/full-screen/hero-banner',    label: 'Hero Banner' },
          { to: '/full-screen/hero-banner-v2', label: 'Hero Banner v2' },
          { to: '/full-screen/hero-banner-v3', label: 'Hero Banner v3' },
          { to: '/full-screen/book-meeting',   label: 'Book a Meeting' },
        ],
      },
      {
        sub: 'Single Column',
        children: [
          { to: '/page-desc-with-menu',        label: 'Banner with Menu' },
          { to: '/full-screen/payment-plans',  label: 'Payment Plans' },
          { to: '/full-screen/testimonials',   label: 'Testimonials' },
          { to: '/full-screen/content-block',  label: 'Content CTA Block' },
          { to: '/full-screen/banner-v2',      label: 'Banner v2' },
          { to: '/gradient-banner-section',    label: 'Banner Section' },
        ],
      },
      {
        sub: 'Split Screen Sections',
        children: [
          { to: '/split-screen/left-hero',    label: 'Left Hero Section' },
          { to: '/split-screen/left-generic', label: 'Left Generic Section' },
          { to: '/split-screen/right-pane',   label: 'Right Pane Section' },
          { to: '/split-screen/generic-section', label: 'Generic Section' },
        ],
      },
    ],
  },
  {
    group: 'Cards',
    children: [
      { to: '/program-cards',    label: 'Program Cards' },
      { to: '/program-cards-v2', label: 'Program Cards v2' },
      { to: '/feature-cards',    label: 'Feature Cards' },
      { to: '/feature-cards-v2', label: 'Feature Card v2' },
      { to: '/feature-cards-v3', label: 'Feature Card v3' },
      { to: '/feature-cards-v4', label: 'Feature Cards v4' },
      { to: '/step-cards',       label: 'Step Cards' },
      { to: '/vertical-cards',   label: 'Vertical Cards' },
    ],
  },
];

// ── Config types (stored in cms_content under key 'vls-sidebar-config') ──

export interface SidebarConfigItem {
  type: 'item';
  id: string;      // matches NavItem.to
  hidden: boolean;
}

export interface SidebarConfigSubGroup {
  type: 'subgroup';
  id: string;      // matches NavSubGroup.sub
  hidden: boolean;
  children: SidebarConfigItem[];
}

export interface SidebarConfigGroup {
  type: 'group';
  id: string;      // matches NavGroup.group
  hidden: boolean;
  children: (SidebarConfigItem | SidebarConfigSubGroup)[];
}

export type SidebarConfig = SidebarConfigGroup[];

// Build a map of item id (route path) → display label from static NAV
export function buildItemLookup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of NAV) {
    for (const child of group.children) {
      if ('sub' in child) {
        for (const item of child.children) map.set(item.to, item.label);
      } else {
        map.set(child.to, child.label);
      }
    }
  }
  return map;
}

// Derive a default config from the static NAV (all items visible, original order)
export function buildDefaultConfig(): SidebarConfig {
  return NAV.map(group => ({
    type: 'group' as const,
    id: group.group,
    hidden: false,
    children: group.children.map(child => {
      if ('sub' in child) {
        return {
          type: 'subgroup' as const,
          id: child.sub,
          hidden: false,
          children: child.children.map(item => ({
            type: 'item' as const,
            id: item.to,
            hidden: false,
          })),
        };
      }
      return { type: 'item' as const, id: child.to, hidden: false };
    }),
  }));
}
