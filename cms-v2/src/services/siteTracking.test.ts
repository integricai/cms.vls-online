import assert from 'assert';
import { classifyTrackingVisit, parseTrackingVisit, trackingAllowed, TRACKING_CONSENT_REGIONS, type TrackingVisitInput } from './siteTracking';

const REQUIRED = ['GB', 'DE', 'FR'];

function visit(overrides: Partial<TrackingVisitInput> = {}): TrackingVisitInput {
  return {
    consent: 'granted',
    landingPath: '/acca',
    source: null,
    medium: null,
    campaign: null,
    content: null,
    term: null,
    googleCampaignId: null,
    hasGoogleClick: false,
    hasMetaClick: false,
    referrerHost: null,
    device: 'desktop',
    ...overrides,
  };
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

console.log('siteTracking tests');

run('google click becomes Google Ads and keeps the campaign id', () => {
  const row = classifyTrackingVisit(visit({ hasGoogleClick: true, googleCampaignId: '123456789' }));
  assert.strictEqual(row.channel, 'Google Ads');
  assert.strictEqual(row.campaign, '123456789');
});

run('meta click becomes Meta', () => {
  assert.strictEqual(classifyTrackingVisit(visit({ hasMetaClick: true })).channel, 'Meta');
});

run('email campaign stays a campaign', () => {
  const row = classifyTrackingVisit(visit({
    source: 'newsletter',
    medium: 'email',
    campaign: 'March offer',
  }));
  assert.strictEqual(row.channel, 'Other campaign');
  assert.strictEqual(row.campaign, 'March offer');
  assert.strictEqual(row.medium, 'email');
});

run('search referrer is organic and direct stays direct', () => {
  assert.strictEqual(classifyTrackingVisit(visit({ referrerHost: 'www.google.co.uk' })).channel, 'Organic search');
  assert.strictEqual(classifyTrackingVisit(visit({ referrerHost: 'www.vls-online.com' })).channel, 'Direct');
  assert.strictEqual(classifyTrackingVisit(visit({ referrerHost: 'partner.example' })).channel, 'Referral');
});

run('arabic path sets the language', () => {
  assert.strictEqual(classifyTrackingVisit(visit({ landingPath: '/ar/cima' })).locale, 'ar');
  assert.strictEqual(classifyTrackingVisit(visit({ landingPath: '/cima' })).locale, 'en');
});

run('parser drops click ids and unsafe text', () => {
  const parsed = parseTrackingVisit({
    consent: 'unknown',
    landingPath: '/acca?gclid=secret',
    source: '<script>',
    googleCampaignId: 'not-a-campaign',
    hasGoogleClick: true,
    referrerHost: 'News.Example.com.',
    device: 'phone',
  });
  assert.strictEqual(parsed.landingPath, '/acca');
  assert.strictEqual(parsed.source, null);
  assert.strictEqual(parsed.googleCampaignId, null);
  assert.strictEqual(parsed.hasGoogleClick, true);
  assert.strictEqual(parsed.referrerHost, 'news.example.com');
  assert.strictEqual(parsed.device, 'desktop');
});

run('uk and eea wait for accept', () => {
  assert.strictEqual(TRACKING_CONSENT_REGIONS.length, 31);
  assert.strictEqual(TRACKING_CONSENT_REGIONS.includes('GB'), true);
  assert.strictEqual((TRACKING_CONSENT_REGIONS as readonly string[]).includes('US'), false);
  assert.strictEqual(trackingAllowed('unknown', 'GB', REQUIRED), false);
  assert.strictEqual(trackingAllowed('unknown', 'DE', REQUIRED), false);
  assert.strictEqual(trackingAllowed('unknown', null, REQUIRED), false);
  assert.strictEqual(trackingAllowed('unknown', 'IN', REQUIRED), true);
  assert.strictEqual(trackingAllowed('granted', 'GB', REQUIRED), true);
  assert.strictEqual(trackingAllowed('denied', 'IN', REQUIRED), false);
});

console.log('siteTracking.test.ts ok');
