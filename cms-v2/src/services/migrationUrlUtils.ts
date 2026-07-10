import type { MigrationTemplate } from '../../shared/migrationTypes';
import { MIGRATION_TEMPLATES } from '../../shared/migrationTemplateLabels';
import {
  slugifySegment,
  storyFullSlug,
  suggestDestinationSlug,
} from '../../shared/migrationDestination';

export { slugifySegment, storyFullSlug, suggestDestinationSlug };

export const ALLOWED_HOSTS = new Set(['vls-online.com', 'www.vls-online.com', 'vls.newzenler.com']);
export const PUBLIC_SITE_ORIGIN = 'https://vls-online.com';
export const ZENLER_SITE_ORIGIN = 'https://vls.newzenler.com';

/** Fetch from Zenler internal origin instead of the public Cloudflare front. */
export function toZenlerFetchUrl(url: URL): URL {
  const fetchUrl = new URL(url.toString());
  const host = fetchUrl.hostname.toLowerCase();
  if (host === 'vls-online.com' || host === 'www.vls-online.com') {
    fetchUrl.hostname = 'vls.newzenler.com';
  }
  return fetchUrl;
}

/** Canonical public URL shown in SEO / breadcrumbs. */
export function toPublicOriginUrl(url: URL): string {
  return `${PUBLIC_SITE_ORIGIN}${url.pathname.replace(/\/$/, '') || ''}${url.search}`;
}

export function inferTemplateFromPath(pathname: string): MigrationTemplate {
  const path = pathname.replace(/\/+$/, '').toLowerCase() || '/';

  if (path === '/' || path === '/home') return 'home';
  if (path.startsWith('/courses/')) return 'course';
  if (/\/(legal|privacy|terms|cookie|gdpr|disclaimer|refund|returns|policy)/.test(path)) return 'legal';
  if (/\/(contact|forms|report|enquiry|book-a-meeting|bookmeeting)/.test(path)) return 'form';
  if (/\/(about-us|about)$/.test(path)) return 'about_us';
  if (/\/(team|our-team|tutors|teamvls)/.test(path)) return 'team_vls';
  if (/\/(schedule|schedules|timetable|exam-dates|exam-schedule)/.test(path)) return 'schedules';
  if (/\/(accacourses|cimacourses|cma|cia|courses)$/.test(path)) return 'landing';
  return 'landing';
}

export function isMigrationTemplate(value: unknown): value is MigrationTemplate {
  return typeof value === 'string' && MIGRATION_TEMPLATES.includes(value as MigrationTemplate);
}
