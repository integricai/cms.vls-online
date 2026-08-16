import assert from 'assert';
import {
  hashEmailForAds,
  hashPhoneForAds,
  normalizePhoneE164,
  parseCheckoutAttribution,
  resolveConversionUploadAction,
  sanitizeAttributionField,
} from './attribution';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('attribution tests');

run('sanitizes empty and unsafe values', () => {
  assert.strictEqual(sanitizeAttributionField(''), null);
  assert.strictEqual(sanitizeAttributionField('  '), null);
  assert.strictEqual(sanitizeAttributionField('<script>'), null);
  assert.strictEqual(sanitizeAttributionField('EAIaIQobChMI'), 'EAIaIQobChMI');
});

run('parses nested attribution and request extras', () => {
  const parsed = parseCheckoutAttribution({
    attribution: {
      gclid: ' gclid-1 ',
      utm_source: 'google',
      capturedAt: '2026-08-16T08:00:00.000Z',
    },
  }, { userAgent: 'Mozilla/5.0', clientIp: '203.0.113.10' });

  assert.strictEqual(parsed.gclid, 'gclid-1');
  assert.strictEqual(parsed.utmSource, 'google');
  assert.strictEqual(parsed.userAgent, 'Mozilla/5.0');
  assert.strictEqual(parsed.clientIp, '203.0.113.10');
  assert.ok(parsed.capturedAt instanceof Date);
});

run('hashes email the way Google Ads expects', () => {
  assert.strictEqual(hashEmailForAds(null), null);
  assert.strictEqual(hashEmailForAds('not-an-email'), null);
  assert.strictEqual(
    hashEmailForAds('  Test@Example.com '),
    '973dfe463ec85785f5f95af5ba3906eedb2d931c24e69824a89ea65dba4e813b',
  );
});

run('normalizes UK phones to E.164 before hashing', () => {
  assert.strictEqual(normalizePhoneE164('07911 123456', 'GB'), '+447911123456');
  assert.ok(hashPhoneForAds('07911 123456', 'GB'));
});

run('gclid upload is uploaded; missing gclid retries with email/phone as extended_upload', () => {
  assert.deepStrictEqual(resolveConversionUploadAction({
    gclid: 'abc', email: null, phone: null,
  }), { action: 'upload', status: 'uploaded' });
  assert.deepStrictEqual(resolveConversionUploadAction({
    gclid: null, email: 'student@vls-online.com', phone: null,
  }), { action: 'upload', status: 'extended_upload' });
  assert.deepStrictEqual(resolveConversionUploadAction({
    gclid: null, email: null, phone: '07911123456', countryCode: 'GB',
  }), { action: 'upload', status: 'extended_upload' });
  assert.strictEqual(resolveConversionUploadAction({
    gclid: null, email: null, phone: null,
  }).status, 'failed');
});
