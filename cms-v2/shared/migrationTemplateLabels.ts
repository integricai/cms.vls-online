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
};

export const MIGRATION_TEMPLATES = Object.keys(MIGRATION_TEMPLATE_LABELS) as MigrationTemplate[];
