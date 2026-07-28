/**
 * Sync Storyblok component-library presets for every HTML template reference.
 *
 * Usage:
 *   npx tsx scripts/sync-component-library.ts
 *
 * Requires STORYBLOK_PERSONAL_TOKEN (reads vls-online-v2/vls-web/.env.local if unset).
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import type { MigrationTemplate } from '../shared/migrationTypes';
import { syncTemplateComponentLibrary } from '../src/services/storyblokComponentLibrary';

const TEMPLATES: MigrationTemplate[] = [
  'home',
  'course',
  'legal',
  'about_us',
  'landing',
  'team_vls',
  'schedules',
  'course_articles',
  'live_sessions',
  'book_meeting',
  'contact_us',
  'study_notes',
  'course_listing',
  'course_dual_price',
  'qualification_level_page',
  'revision_course',
];

function loadEnv(): void {
  const candidates = [
    path.join(process.cwd(), '.env.local'),
    path.join(process.cwd(), '..', '.env.local'),
    path.resolve(process.cwd(), '../../vls-online-v2/vls-web/.env.local'),
  ];
  for (const file of candidates) {
    if (fs.existsSync(file)) dotenv.config({ path: file, override: false });
  }
}

async function main() {
  loadEnv();

  const token = process.env.STORYBLOK_PERSONAL_TOKEN?.trim()
    ?? process.env.STORYBLOK_TOKEN?.trim();
  const spaceId = process.env.STORYBLOK_SPACE_ID?.trim() ?? '293626385802926';
  const region = process.env.STORYBLOK_REGION === 'us' ? 'us' : 'eu';

  if (!token) {
    console.error('STORYBLOK_PERSONAL_TOKEN is required.');
    process.exit(1);
  }

  const config = { spaceId, accessToken: token, region };
  let totalPresets = 0;
  let totalCreated = 0;
  let totalUpdated = 0;

  for (const template of TEMPLATES) {
    const result = await syncTemplateComponentLibrary(config, template);
    totalPresets += result.presets.length;
    totalCreated += result.created;
    totalUpdated += result.updated;
    console.log(`[${template}] ${result.presets.length} presets (${result.created} created, ${result.updated} updated)`);
  }

  console.log(`\nDone: ${totalPresets} presets across ${TEMPLATES.length} templates (${totalCreated} created, ${totalUpdated} updated).`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
