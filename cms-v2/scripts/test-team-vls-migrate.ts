import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { migratePage } from '../src/services/courseMigrationService';

async function main() {
  const token = process.env.STORYBLOK_TOKEN || process.env.STORYBLOK_ACCESS_TOKEN || '';
  const spaceId = process.env.STORYBLOK_SPACE_ID || '293626385802926';

  console.log('Token present:', Boolean(token));
  console.log('Space ID:', spaceId);

  try {
    const dry = await migratePage({
      pageUrl: 'https://vls-online.com/teamvls',
      template: 'team_vls',
      destinationSlug: 'teamvls-test-migration',
      storyblokSpaceId: spaceId,
      storyblokAccessToken: token,
      storyblokRegion: 'eu',
      publish: false,
      dryRun: true,
    });
    console.log('DRY RUN OK', {
      fullSlug: dry.fullSlug,
      sections: (dry.scraped as { sections?: unknown[] }).sections?.length,
      warnings: dry.warnings,
    });

    if (!token) {
      console.log('No Storyblok token — skipping live migrate');
      return;
    }

    const live = await migratePage({
      pageUrl: 'https://vls-online.com/teamvls',
      template: 'team_vls',
      destinationSlug: 'teamvls-test-migration',
      storyblokSpaceId: spaceId,
      storyblokAccessToken: token,
      storyblokRegion: 'eu',
      publish: false,
      dryRun: false,
    });
    console.log('LIVE MIGRATE OK', live.storyblok?.fullSlug);
  } catch (err) {
    console.error('FAILED');
    if (err instanceof Error) {
      console.error('message:', err.message);
      console.error('stack:', err.stack);
      if ('status' in err) console.error('status:', (err as { status: number }).status);
      if ('details' in err) console.error('details:', JSON.stringify((err as { details: unknown }).details, null, 2));
    } else {
      console.error(err);
    }
    process.exitCode = 1;
  }
}

main();
