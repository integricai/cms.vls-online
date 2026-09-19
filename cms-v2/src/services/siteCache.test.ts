import assert from 'node:assert/strict';
import { listSiteCacheTargets, resolvePagePath } from './siteCache';

assert.equal(resolvePagePath('/about-acca'), '/about-acca');
assert.equal(resolvePagePath('https://staging.vls-online.com/about-cima?x=1'), '/about-cima');
assert.equal(resolvePagePath('about-cma'), '/about-cma');

const targets = listSiteCacheTargets();
assert.deepEqual(targets.map(item => item.id), ['staging', 'production']);
assert.equal(targets[0].siteUrl, 'https://staging.vls-online.com');
assert.equal(targets[1].siteUrl, 'https://prod.vls-online.com');

console.log('siteCache tests passed');
