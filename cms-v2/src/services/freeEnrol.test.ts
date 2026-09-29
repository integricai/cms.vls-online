import assert from 'node:assert/strict';
import {
  isFreeQuizCourseId,
  normalizeFreeEnrolEmail,
  normalizeFreeEnrolName,
} from './freeEnrol';

assert.equal(isFreeQuizCourseId('24794'), true);
assert.equal(isFreeQuizCourseId('186586'), true);
assert.equal(isFreeQuizCourseId('191070'), true);
assert.equal(isFreeQuizCourseId(' 24794 '), true);
assert.equal(isFreeQuizCourseId('71086'), false);
assert.equal(isFreeQuizCourseId(''), false);

assert.equal(normalizeFreeEnrolEmail('  Ada@VLS-Online.COM '), 'ada@vls-online.com');
assert.equal(normalizeFreeEnrolName('  Ada   Lovelace '), 'Ada Lovelace');

console.log('freeEnrol tests passed');
