import assert from 'node:assert/strict';
import {
  applyPing,
  classifyStatusCode,
  isSitemapIndex,
  parseSitemapLocs,
  pingSlot,
  CHECK_INTERVAL_MS,
  RETRY_DELAY_MS,
  type HealthRowState,
} from './urlHealthRules';

assert.equal(classifyStatusCode(200), 'ok');
assert.equal(classifyStatusCode(301), 'ok');
assert.equal(classifyStatusCode(404), 'broken');
assert.equal(classifyStatusCode(410), 'broken');
assert.equal(classifyStatusCode(500), 'broken');
assert.equal(classifyStatusCode(503), 'broken');
assert.equal(classifyStatusCode(0), 'broken');
assert.equal(classifyStatusCode(403), 'warning');
assert.equal(classifyStatusCode(429), 'warning');

const t0 = new Date('2026-11-21T10:00:00Z');
const t1 = new Date(t0.getTime() + RETRY_DELAY_MS);
const t2 = new Date(t1.getTime() + RETRY_DELAY_MS);

const fresh: HealthRowState = { status: 'ok', ping2At: null, firstBrokenAt: null, alertedAt: null };

// Healthy check: slot 1, next check in an hour.
const ok = applyPing(fresh, 200, t0);
assert.equal(ok.status, 'ok');
assert.equal(ok.slot, 1);
assert.equal(ok.nextCheckAt.getTime(), t0.getTime() + CHECK_INTERVAL_MS);

// 404 three times: retry, retry, then broken with the first failure time kept.
const p1 = applyPing(fresh, 404, t0);
assert.equal(p1.status, 'retrying');
assert.equal(p1.slot, 1);
assert.equal(p1.firstBrokenAt?.getTime(), t0.getTime());
assert.equal(p1.nextCheckAt.getTime(), t1.getTime());

const afterP1: HealthRowState = { status: 'retrying', ping2At: null, firstBrokenAt: p1.firstBrokenAt, alertedAt: null };
assert.equal(pingSlot(afterP1), 2);
const p2 = applyPing(afterP1, 404, t1);
assert.equal(p2.status, 'retrying');
assert.equal(p2.slot, 2);
assert.equal(p2.firstBrokenAt?.getTime(), t0.getTime());

const afterP2: HealthRowState = { status: 'retrying', ping2At: t1, firstBrokenAt: p2.firstBrokenAt, alertedAt: null };
assert.equal(pingSlot(afterP2), 3);
const p3 = applyPing(afterP2, 500, t2);
assert.equal(p3.status, 'broken');
assert.equal(p3.slot, 3);
assert.equal(p3.firstBrokenAt?.getTime(), t0.getTime());
assert.equal(p3.alertedAt, null);
assert.equal(p3.nextCheckAt.getTime(), t2.getTime() + CHECK_INTERVAL_MS);

// A blip that recovers on the second ping clears the breakage.
const blip = applyPing(afterP1, 200, t1);
assert.equal(blip.status, 'ok');
assert.equal(blip.slot, 2);
assert.equal(blip.firstBrokenAt, null);

// Already broken and alerted: the next hourly check keeps the first failure
// time and the alert stamp, so no second email.
const alerted = new Date(t2.getTime() + 1000);
const stillBroken: HealthRowState = { status: 'broken', ping2At: t1, firstBrokenAt: t0, alertedAt: alerted };
assert.equal(pingSlot(stillBroken), 1);
const again = applyPing(stillBroken, 404, new Date(t2.getTime() + CHECK_INTERVAL_MS));
assert.equal(again.status, 'retrying');
assert.equal(again.firstBrokenAt?.getTime(), t0.getTime());
assert.equal(again.alertedAt?.getTime(), alerted.getTime());

// Recovery clears the alert so the next breakage emails again.
const recovered = applyPing(stillBroken, 200, new Date(t2.getTime() + CHECK_INTERVAL_MS));
assert.equal(recovered.status, 'ok');
assert.equal(recovered.alertedAt, null);

// Warnings do not start a retry.
const forbidden = applyPing(fresh, 403, t0);
assert.equal(forbidden.status, 'warning');
assert.equal(forbidden.nextCheckAt.getTime(), t0.getTime() + CHECK_INTERVAL_MS);

const index = `<?xml version="1.0"?><sitemapindex><sitemap><loc>https://vls-online.com/sitemap-pages.xml</loc></sitemap>
<sitemap><loc> https://vls-online.com/sitemap-blog.xml </loc></sitemap></sitemapindex>`;
assert.equal(isSitemapIndex(index), true);
assert.deepEqual(parseSitemapLocs(index), [
  'https://vls-online.com/sitemap-pages.xml',
  'https://vls-online.com/sitemap-blog.xml',
]);
const urlset = '<urlset><url><loc>https://vls-online.com/a?x=1&amp;y=2</loc></url></urlset>';
assert.equal(isSitemapIndex(urlset), false);
assert.deepEqual(parseSitemapLocs(urlset), ['https://vls-online.com/a?x=1&y=2']);

console.log('urlHealthRules tests passed');
