import assert from 'assert';
import { isPaymentSuccessPath, pageScore, scoreSessionPages } from './pathScore';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

console.log('pathScore tests');

run('payment success ignores the locale prefix', () => {
  assert.strictEqual(isPaymentSuccessPath('/payment-success'), true);
  assert.strictEqual(isPaymentSuccessPath('/en/payment-success'), true);
  assert.strictEqual(isPaymentSuccessPath('/ar/payment-success/'), true);
  assert.strictEqual(isPaymentSuccessPath('/checkout'), false);
  assert.strictEqual(isPaymentSuccessPath('/blog/payment-success-story'), false);
});

run('score is the share of sessions that did not end here', () => {
  assert.strictEqual(pageScore(0, 0), 0);
  assert.strictEqual(pageScore(4, 1), 75);
  assert.strictEqual(pageScore(2, 2), 0);
});

run('each session keeps its own exit, and payment success is not a drop-off', () => {
  const scores = scoreSessionPages([
    ['/home', '/course', '/checkout'],
    ['/home', '/course', '/checkout', '/en/payment-success'],
    ['/home'],
  ]);
  const byPath = new Map(scores.map(row => [row.path, row]));
  assert.deepStrictEqual(byPath.get('/home'), { path: '/home', sessions: 3, dropoffs: 1, conversions: 1, score: 67 });
  assert.deepStrictEqual(byPath.get('/course'), { path: '/course', sessions: 2, dropoffs: 0, conversions: 1, score: 100 });
  assert.deepStrictEqual(byPath.get('/checkout'), { path: '/checkout', sessions: 2, dropoffs: 1, conversions: 1, score: 50 });
  assert.strictEqual(byPath.has('/en/payment-success'), false);
});

run('a repeated page counts once, and the last view is the exit', () => {
  const scores = scoreSessionPages([['/acca', '/blog', '/acca']]);
  const byPath = new Map(scores.map(row => [row.path, row]));
  assert.deepStrictEqual(byPath.get('/acca'), { path: '/acca', sessions: 1, dropoffs: 1, conversions: 0, score: 0 });
  assert.deepStrictEqual(byPath.get('/blog'), { path: '/blog', sessions: 1, dropoffs: 0, conversions: 0, score: 100 });
});

console.log('pathScore.test.ts ok');
