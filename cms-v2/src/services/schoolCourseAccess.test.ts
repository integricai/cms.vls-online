import assert from 'node:assert/strict';
import { summarizeSchoolCourseAccess } from './schoolCourseAccess';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('school course access');

run('treats an unknown email lookup as not owned', () => {
  const access = summarizeSchoolCourseAccess({
    registered: null,
    courseIds: ['10'],
    enrolledIds: ['10'],
    failedIds: [],
    namesById: { '10': 'ACCA FR' },
  });
  assert.equal(access.lookup, 'unavailable');
  assert.equal(access.registered, false);
  assert.equal(access.ownsAll, false);
  assert.deepEqual(access.ownedCourses, []);
});

run('asks a new email to continue without ownership', () => {
  const access = summarizeSchoolCourseAccess({
    registered: false,
    courseIds: ['10'],
    enrolledIds: [],
    failedIds: [],
    namesById: {},
  });
  assert.equal(access.registered, false);
  assert.equal(access.ownsAll, false);
  assert.deepEqual(access.ownedCourses, []);
});

run('lets an existing student pay for a course they do not have', () => {
  const access = summarizeSchoolCourseAccess({
    registered: true,
    courseIds: ['10', '20'],
    enrolledIds: [],
    failedIds: [],
    namesById: {},
  });
  assert.equal(access.ownsAll, false);
  assert.deepEqual(access.ownedCourses, []);
});

run('names the courses they already have when the pack is only partly owned', () => {
  const access = summarizeSchoolCourseAccess({
    registered: true,
    courseIds: ['10', '20'],
    enrolledIds: ['10'],
    failedIds: [],
    namesById: { '10': 'ACCA FR' },
  });
  assert.equal(access.ownsAll, false);
  assert.deepEqual(access.ownedCourses, [{ zenlerCourseId: '10', name: 'ACCA FR' }]);
});

run('blocks payment only when every course in the selection is already enrolled', () => {
  const access = summarizeSchoolCourseAccess({
    registered: true,
    courseIds: ['10', '20'],
    enrolledIds: ['20', '10', '99'],
    failedIds: [],
    namesById: { '10': 'ACCA FR', '20': 'ACCA AA' },
  });
  assert.equal(access.ownsAll, true);
  assert.deepEqual(access.ownedCourses.map((course) => course.name), ['ACCA FR', 'ACCA AA']);
});

run('does not block payment when an enrollment read fails', () => {
  const access = summarizeSchoolCourseAccess({
    registered: true,
    courseIds: ['10'],
    enrolledIds: ['10'],
    failedIds: ['10'],
    namesById: { '10': 'ACCA FR' },
  });
  assert.equal(access.ownsAll, false);
  assert.deepEqual(access.ownedCourses, []);
});

console.log('school course access tests passed');
