import assert from 'assert';
import {
  enrolmentCampaignLabel,
  enrolmentChannel,
  summarizeEnrolments,
  trackingSourceName,
  type EnrolmentOrder,
} from '../../shared/siteTracking';

function order(overrides: Partial<EnrolmentOrder> = {}): EnrolmentOrder {
  return {
    campaign: null,
    source: null,
    medium: null,
    currency: 'USD',
    amount: 100,
    metaClick: false,
    googleClick: false,
    fromGoogleId: false,
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

run('tagged Meta ad', () => {
  assert.equal(enrolmentChannel(order({ campaign: '120249614819690382', source: 'fb', medium: 'paid', metaClick: true })), 'meta_tagged');
});

run('fbclid with no campaign tag', () => {
  assert.equal(enrolmentChannel(order({ metaClick: true })), 'meta_untagged');
  assert.equal(enrolmentChannel(order({ metaClick: true, source: 'ig' })), 'meta_untagged');
});

run('Google click wins over a leftover Meta cookie', () => {
  assert.equal(enrolmentChannel(order({ campaign: '23908111600', source: 'google', metaClick: true, googleClick: true })), 'google');
});

run('Meta campaign id wins over a leftover Google click', () => {
  assert.equal(enrolmentChannel(order({ campaign: '120251317578890382', googleClick: true })), 'meta_tagged');
});

run('other tagged link and nothing stored', () => {
  assert.equal(enrolmentChannel(order({ source: 'chatgpt.com' })), 'other');
  assert.equal(enrolmentChannel(order()), 'none');
});

run('summary splits "no campaign" by channel and keeps channel order', () => {
  const { channels, enrolments } = summarizeEnrolments([
    order(),
    order(),
    order({ metaClick: true, amount: 50 }),
    order({ campaign: '120249614819690382', metaClick: true, amount: 65 }),
    order({ campaign: '120249614819690382', metaClick: true, amount: 65 }),
    order({ campaign: '21782747896', googleClick: true }),
    order({ source: 'chatgpt.com', amount: 30 }),
  ]);
  assert.deepEqual(channels.map(row => [row.channel, row.orders, row.amount]), [
    ['meta_tagged', 2, 130],
    ['meta_untagged', 1, 50],
    ['google', 1, 100],
    ['other', 1, 30],
    ['none', 2, 200],
  ]);
  assert.deepEqual(enrolments.map(enrolmentCampaignLabel), [
    'Meta campaign 120249614819690382',
    'No campaign tag on the link',
    'Google campaign 21782747896',
    'chatgpt.com, no campaign tag',
    'Nothing stored',
  ]);
});

run('currencies stay separate', () => {
  const { channels } = summarizeEnrolments([order({ currency: 'gbp' }), order({ currency: 'USD' })]);
  assert.deepEqual(channels.map(row => row.currency).sort(), ['GBP', 'USD']);
});

run('plain source names', () => {
  assert.equal(trackingSourceName('an'), 'Meta Audience Network (ads in other apps)');
  assert.equal(trackingSourceName('fb-WebsiteKeyInfo'), 'Facebook');
  assert.equal(trackingSourceName('google'), null);
});

console.log('enrolmentChannels.test.ts ok');
