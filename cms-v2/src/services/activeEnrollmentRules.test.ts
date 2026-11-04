import assert from 'node:assert/strict';
import { enrolledZenlerCourseIds, enrollmentStillOpen } from './activeEnrollmentRules';

assert.deepEqual(
  enrolledZenlerCourseIds({
    accessZenlerCourseIds: ['111', ' 222 ', '111', 'abc'],
    zenlerCourseId: '999',
  }),
  ['111', '222'],
);

assert.deepEqual(
  enrolledZenlerCourseIds({
    accessZenlerCourseIds: [],
    zenlerCourseId: '71086',
    saleZenlerCourseId: '1',
  }),
  ['71086'],
);

assert.deepEqual(
  enrolledZenlerCourseIds({
    accessZenlerCourseIds: null,
    zenlerCourseId: '',
    saleZenlerCourseId: '42',
  }),
  ['42'],
);

assert.equal(enrollmentStillOpen('enrolled'), true);
assert.equal(enrollmentStillOpen('enrolled_new'), true);
assert.equal(enrollmentStillOpen('unenroll_failed'), true);
assert.equal(enrollmentStillOpen('unenrolled'), false);
assert.equal(enrollmentStillOpen('expired'), false);
assert.equal(enrollmentStillOpen(null), false);

console.log('activeEnrollmentRules tests passed');
