import { fillBlankPublicTrackingNames } from '../src/models/siteUrl';

fillBlankPublicTrackingNames()
  .then(result => {
    console.log(`Filled ${result.updated} page names. Left ${result.skipped} internal pages blank.`);
  })
  .catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
