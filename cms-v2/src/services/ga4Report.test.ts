import assert from 'assert';
import crypto from 'crypto';
import {
  assembleGa4Traffic,
  contentPages,
  ga4PropertyId,
  paidOrderChannel,
  summarizePaidOrders,
  type Ga4RawReport,
  type PaidOrderFact,
} from '../../shared/ga4Report';
import { buildServiceAccountAssertion, normalizeGa4PrivateKey, readGa4Config } from './ga4Report';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

function report(metrics: string[], rows: Array<{ dimension?: string; dimensions?: string[]; values: string[] }>): Ga4RawReport {
  const width = Math.max(0, ...rows.map(row => row.dimensions?.length ?? (row.dimension ? 1 : 0)));
  return {
    dimensionHeaders: Array.from({ length: width }, () => ({ name: 'dimension' })),
    metricHeaders: metrics.map(name => ({ name })),
    rows: rows.map(row => ({
      dimensionValues: (row.dimensions ?? (row.dimension ? [row.dimension] : [])).map(value => ({ value })),
      metricValues: row.values.map(value => ({ value })),
    })),
  };
}

function order(partial: Partial<PaidOrderFact>): PaidOrderFact {
  return {
    courseTitle: 'ACCA FA',
    currency: 'GBP',
    amount: 100,
    gclid: null,
    gbraid: null,
    wbraid: null,
    fbclid: null,
    fbc: null,
    utmSource: null,
    utmMedium: null,
    utmCampaign: null,
    ...partial,
  };
}

console.log('ga4 report tests');

run('property id accepts the numeric id only', () => {
  assert.strictEqual(ga4PropertyId('123456789'), '123456789');
  assert.strictEqual(ga4PropertyId(' G-HCY71Q3BCE '), null);
  assert.strictEqual(ga4PropertyId('123'), null);
});

run('private key keeps a real newline from an escaped env value', () => {
  const key = normalizeGa4PrivateKey('"-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----"');
  assert.strictEqual(key, '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----');
});

run('config is absent until the property, email, and key are set', () => {
  assert.strictEqual(readGa4Config({}), null);
  assert.ok(readGa4Config({
    GA4_PROPERTY_ID: '123456789',
    GA4_CLIENT_EMAIL: 'ga4@example.iam.gserviceaccount.com',
    GA4_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----',
  }));
});

run('service account assertion is a signed jwt', () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const assertion = buildServiceAccountAssertion('ga4@example.iam.gserviceaccount.com', privateKey, 1_700_000_000);
  assert.strictEqual(assertion.split('.').length, 3);
});

run('traffic keeps sessions, channels, and content pages', () => {
  const traffic = assembleGa4Traffic([
    report(['sessions', 'engagedSessions', 'screenPageViews'], [{ values: ['40', '25', '90'] }]),
    report(['sessions'], [{ dimension: 'Organic Search', values: ['30'] }, { dimension: 'Paid Search', values: ['10'] }]),
    report(['sessions'], [{ dimension: '/acca', values: ['18'] }]),
    report(['screenPageViews'], [
      { dimension: '/', values: ['50'] },
      { dimension: '/checkout', values: ['9'] },
      { dimension: '/courses/acca-fa', values: ['12'] },
      { dimension: '/payment-success', values: ['4'] },
    ]),
    report(['screenPageViews'], [{ values: ['9'] }]),
    report(['sessions'], [
      { dimensions: ['20261101', 'Organic Search'], values: ['4'] },
      { dimensions: ['20261102', 'Paid Search'], values: ['2'] },
    ]),
  ], '2026-11-01', '2026-11-03');
  assert.strictEqual(traffic.sessions, 40);
  assert.strictEqual(traffic.engagedSessions, 25);
  assert.strictEqual(traffic.checkoutViews, 9);
  assert.strictEqual(traffic.channels[0]?.label, 'Organic Search');
  assert.deepStrictEqual(traffic.pages, [{ label: '/courses/acca-fa', value: 12 }]);
  assert.strictEqual(traffic.channelDays.length, 3);
  assert.strictEqual(traffic.channelDays[0]?.channels['Organic Search'], 4);
  assert.strictEqual(traffic.channelDays[1]?.channels['Paid Search'], 2);
  assert.deepStrictEqual(traffic.channelDays[2]?.channels, {});
  assert.deepStrictEqual(traffic.channels.map(row => row.label), ['Organic Search', 'Paid Search']);
});

run('content pages drop checkout and the home page', () => {
  assert.deepStrictEqual(contentPages([
    { label: '/', value: 10 },
    { label: '/en/checkout', value: 3 },
    { label: '/cima', value: 2 },
  ]), [{ label: '/cima', value: 2 }]);
});

run('paid orders keep revenue by currency and do not mix channels', () => {
  const sales = summarizePaidOrders([
    order({ amount: 200, gclid: 'abc' }),
    order({ courseTitle: 'CIMA BA', amount: 50, currency: 'USD', utmSource: 'facebook' }),
    order({ courseTitle: '', amount: 80, utmSource: 'newsletter', utmMedium: 'email' }),
  ]);
  assert.strictEqual(sales.orders, 3);
  assert.deepStrictEqual(sales.totals, [
    { currency: 'GBP', orders: 2, amount: 280 },
    { currency: 'USD', orders: 1, amount: 50 },
  ]);
  assert.strictEqual(paidOrderChannel(order({ gclid: 'abc' })), 'Google Ads');
  assert.strictEqual(sales.channels[0]?.channel, 'Google Ads');
  assert.strictEqual(sales.products.find(row => row.name === 'Custom payment')?.amount, 80);
});

console.log('ga4 report tests passed');
