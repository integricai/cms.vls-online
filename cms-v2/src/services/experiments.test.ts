import assert from 'assert';
import {
  buildExperimentResults,
  experimentUrlConflict,
  normalizeExperimentPath,
  parseExperimentAssignments,
  parseExperimentInput,
} from '../../shared/experiments';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

const valid = {
  name: 'ACCA hero',
  entryPath: '/acca',
  variants: [
    { label: 'A', path: '/acca', weight: 50 },
    { label: 'B', path: '/acca-v2', weight: 50 },
  ],
};

console.log('experiment tests');

run('keeps a site path and strips a full URL', () => {
  assert.strictEqual(normalizeExperimentPath(' /acca/ '), '/acca');
  assert.strictEqual(normalizeExperimentPath('https://www.vls-online.com/en/acca'), '/en/acca');
  assert.strictEqual(normalizeExperimentPath('https://vls-online.com/'), '/');
  assert.strictEqual(normalizeExperimentPath('https://example.com/acca'), null);
  assert.strictEqual(normalizeExperimentPath('/acca?x=1'), null);
  assert.strictEqual(normalizeExperimentPath('/api/experiments'), null);
});

run('accepts a two-page test that totals 100', () => {
  const parsed = parseExperimentInput(valid);
  assert.strictEqual(parsed.ok, true);
  if (!parsed.ok) return;
  assert.strictEqual(parsed.value.entryPath, '/acca');
  assert.deepStrictEqual(parsed.value.variants.map(variant => variant.weight), [50, 50]);
});

run('rejects weights that do not total 100', () => {
  const parsed = parseExperimentInput({
    ...valid,
    variants: [
      { label: 'A', path: '/acca', weight: 70 },
      { label: 'B', path: '/acca-v2', weight: 20 },
    ],
  });
  assert.strictEqual(parsed.ok, false);
});

run('rejects a test whose pages miss the entry URL', () => {
  const parsed = parseExperimentInput({
    ...valid,
    variants: [
      { label: 'A', path: '/acca-old', weight: 50 },
      { label: 'B', path: '/acca-v2', weight: 50 },
    ],
  });
  assert.strictEqual(parsed.ok, false);
});

run('rejects overlapping running entry URLs', () => {
  const message = experimentUrlConflict(
    { entryPath: '/acca', paths: ['/acca', '/acca-v2'] },
    [{ entryPath: '/acca-v2', paths: ['/acca-v2', '/acca-v3'] }],
  );
  assert.strictEqual(message, 'Another running test already uses that URL.');
  assert.strictEqual(
    experimentUrlConflict(
      { entryPath: '/cima', paths: ['/cima', '/cima-v2'] },
      [{ entryPath: '/acca', paths: ['/acca', '/acca-v2'] }],
    ),
    null,
  );
});

run('keeps a valid checkout assignment and drops a bad one', () => {
  assert.deepStrictEqual(parseExperimentAssignments([
    { experimentId: 4, variant: 'B' },
    { experimentId: '9', variant: 'A' },
    { experimentId: 4, variant: 'A' },
    { experimentId: 0, variant: 'A' },
    { experimentId: 3, variant: '<script>' },
  ]), [
    { experimentId: 4, variant: 'B' },
    { experimentId: 9, variant: 'A' },
  ]);
});

run('marks the page with the higher conversion as ahead', () => {
  const rows = buildExperimentResults([
    { label: 'A', path: '/acca', weight: 50, visitors: 100, orders: 2, revenue: 200, currency: 'USD' },
    { label: 'B', path: '/acca-v2', weight: 50, visitors: 40, orders: 4, revenue: 80, currency: 'USD' },
  ]);
  assert.strictEqual(rows[0]?.ahead, false);
  assert.strictEqual(rows[0]?.conversion, 0.02);
  assert.strictEqual(rows[1]?.ahead, true);
  assert.strictEqual(rows[1]?.conversion, 0.1);
  assert.strictEqual(rows[1]?.revenuePerVisitor, 2);
});

run('does not pick a winner when the conversions match', () => {
  const rows = buildExperimentResults([
    { label: 'A', path: '/acca', weight: 80, visitors: 80, orders: 4, revenue: 40, currency: 'USD' },
    { label: 'B', path: '/acca-v2', weight: 20, visitors: 20, orders: 1, revenue: 10, currency: 'USD' },
  ]);
  assert.strictEqual(rows.every(row => !row.ahead), true);
});

run('leaves conversion empty until a page has visitors', () => {
  const rows = buildExperimentResults([
    { label: 'A', path: '/acca', weight: 50, visitors: 0, orders: 0, revenue: null, currency: null },
  ]);
  assert.strictEqual(rows[0]?.conversion, null);
  assert.strictEqual(rows[0]?.ahead, false);
  assert.strictEqual(rows[0]?.revenue, 0);
});

console.log('experiment tests passed');
