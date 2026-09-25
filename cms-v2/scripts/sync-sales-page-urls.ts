import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { syncCourseSalesPageUrlsFromStoryblok } from '../src/services/courseSalesPageUrlSync';

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(__dirname, '../.env.local'));
loadEnvFile(resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local'));

syncCourseSalesPageUrlsFromStoryblok()
  .then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(1);
  })
  .catch(err => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
