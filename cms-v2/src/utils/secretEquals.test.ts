import assert from 'node:assert/strict';
import { secretEquals } from './secretEquals';

assert.equal(secretEquals('Bearer secret', 'Bearer secret'), true);
assert.equal(secretEquals('Bearer secret', 'Bearer secreT'), false);
assert.equal(secretEquals('Bearer secret', 'Bearer secret-extra'), false);
assert.equal(secretEquals('', 'secret'), false);

console.log('secretEquals tests passed');
