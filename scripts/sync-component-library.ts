/**
 * Run from cms.vls-online root:
 *   npx tsx scripts/sync-component-library.ts
 *
 * Delegates to cms-v2/scripts/sync-component-library.ts
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cmsV2 = path.join(root, 'cms-v2');
const script = path.join(cmsV2, 'scripts', 'sync-component-library.ts');

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', script], {
  cwd: cmsV2,
  stdio: 'inherit',
  shell: true,
});

process.exit(result.status ?? 1);
