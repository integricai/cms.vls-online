import type { MigrationTemplate } from './migrationTypes';

export const MIGRATION_TEMPLATE_LABELS: Record<MigrationTemplate, string> = {
  home: 'Home',
  course: 'Course',
  legal: 'Legal',
  form: 'Form',
  about_us: 'About Us',
  landing: 'Landing',
  team_vls: 'Team VLS',
  schedules: 'Schedules',
  course_articles: 'Course Articles',
  live_sessions: 'Live Sessions',
  book_meeting: 'Book a Meeting',
  contact_us: 'Contact Us',
};

export const MIGRATION_TEMPLATES = Object.keys(MIGRATION_TEMPLATE_LABELS) as MigrationTemplate[];
