import assert from 'assert';
import { experimentUrlConflict, normalizeExperimentPath, parseExperimentInput } from '../../shared/experiments';

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

console.log('experiment tests passed');
