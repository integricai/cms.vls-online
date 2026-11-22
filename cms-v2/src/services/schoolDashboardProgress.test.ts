import assert from 'node:assert/strict';
import {
  firstNameFrom,
  initialsFor,
  orderDashboardCourses,
  parseCourseProgressItems,
} from './schoolDashboardProgress';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('school dashboard progress');

run('reads a keyed progress report and ignores a missing course id', () => {
  const rows = parseCourseProgressItems({
    items: {
      '313.abc': {
        courseId: '1036',
        name: 'Sara Ahmed',
        email: 'Sara@Example.com',
        course_name: 'ACCA SBR',
        completion_percentage: 62.4,
        last_attended: '2026-11-01 10:00:00',
      },
      skipped: { name: 'No course' },
    },
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].email, 'sara@example.com');
  assert.equal(rows[0].percent, 62);
  assert.equal(rows[0].courseName, 'ACCA SBR');
  assert.equal(rows[0].lastAttended, '2026-11-01 10:00:00');
});

run('treats a dash last-attended as no visit and clamps the percentage', () => {
  const rows = parseCourseProgressItems({
    items: [{ course_id: '9', email: 'a@b.co', completionPercentage: 140, lastActivity: '-' }],
  });
  assert.equal(rows[0].percent, 100);
  assert.equal(rows[0].lastAttended, null);
});

run('uses the account first name, then the first word of the report name', () => {
  assert.equal(firstNameFrom('Sara Ahmed', 'Sara'), 'Sara');
  assert.equal(firstNameFrom('Sara Ahmed', ''), 'Sara');
  assert.equal(initialsFor('Sara'), 'SA');
  assert.equal(initialsFor('Sara Ahmed'), 'SA');
});

run('puts the course studied most recently first', () => {
  const ordered = orderDashboardCourses([
    { id: '1', name: 'Older', percent: 10, lastAttended: '2026-01-01' },
    { id: '2', name: 'Newer', percent: 40, lastAttended: '2026-11-01 09:00:00' },
    { id: '3', name: 'Unopened', percent: null, lastAttended: null },
  ]);
  assert.deepEqual(ordered.map(course => course.id), ['2', '1', '3']);
});
