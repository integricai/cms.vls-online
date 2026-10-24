import assert from 'node:assert/strict';
import type { Course } from '../../shared/types';
import {
  buildCourseWorkbook,
  planCourseWorkbookUpdates,
  readCourseWorkbook,
  type WorkbookCourse,
} from './courseWorkbook';

const courses: WorkbookCourse[] = [
  { zenlerCourseId: '12918', name: 'ACCA BT', coursePageUrl: '/courses/bt' },
  { zenlerCourseId: '234776', name: 'ACCA Notes', coursePageUrl: null },
];

const unchanged = planCourseWorkbookUpdates(courses, [
  { rowNumber: 2, zenlerCourseId: '12918', name: 'ACCA BT', courseUrl: '/courses/bt' },
  { rowNumber: 3, zenlerCourseId: '234776', name: '', courseUrl: '' },
]);
assert.equal(unchanged.patches.length, 0);
assert.equal(unchanged.skipped, 2);
assert.equal(unchanged.namesUpdated, 0);
assert.equal(unchanged.urlsUpdated, 0);

const filled = planCourseWorkbookUpdates(courses, [
  { rowNumber: 2, zenlerCourseId: '12918', name: 'ACCA Business and Technology', courseUrl: 'https://www.vls-online.com/courses/acca-business-and-technology-f1/' },
  { rowNumber: 3, zenlerCourseId: '234776', name: 'ACCA Notes', courseUrl: '/courses/acca-notes-combo-pack' },
  { rowNumber: 4, zenlerCourseId: '999', name: 'Missing', courseUrl: '/courses/missing' },
  { rowNumber: 5, zenlerCourseId: '12918', name: 'Duplicate', courseUrl: '/courses/other' },
  { rowNumber: 6, zenlerCourseId: '', name: 'No id', courseUrl: '/courses/no-id' },
]);
assert.deepEqual(filled.patches, [
  {
    rowNumber: 2,
    zenlerCourseId: '12918',
    name: 'ACCA Business and Technology',
    coursePageUrl: '/courses/acca-business-and-technology-f1/',
  },
  {
    rowNumber: 3,
    zenlerCourseId: '234776',
    coursePageUrl: '/courses/acca-notes-combo-pack',
  },
]);
assert.equal(filled.namesUpdated, 1);
assert.equal(filled.urlsUpdated, 2);
assert.equal(filled.errors.length, 3);
assert.equal(filled.errors[0]?.message, 'Course not found for this Zenler course id');
assert.match(filled.errors[1]?.message ?? '', /more than once/);
assert.match(filled.errors[2]?.message ?? '', /required/);

function course(partial: Pick<Course, 'zenlerCourseId' | 'name' | 'coursePageUrl'>): Course {
  return {
    id: 1,
    slug: null,
    category: null,
    level: null,
    status: null,
    zenlerUrl: null,
    isActive: true,
    enableInBanner: false,
    enableInNavigation: true,
    sortOrder: 1,
    qualification: null,
    courseLevel: null,
    courseLevels: [],
    courseOption: null,
    lastSyncedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    ...partial,
  };
}

async function roundTrip() {
  const buffer = await buildCourseWorkbook([
    course({ zenlerCourseId: '0129', name: 'Leading zero', coursePageUrl: null }),
    course({ zenlerCourseId: '42', name: 'FA1', coursePageUrl: '/courses/fa1' }),
  ]);
  const rows = await readCourseWorkbook(buffer);
  assert.deepEqual(rows, [
    { rowNumber: 2, zenlerCourseId: '0129', name: 'Leading zero', courseUrl: '' },
    { rowNumber: 3, zenlerCourseId: '42', name: 'FA1', courseUrl: '/courses/fa1' },
  ]);
}

roundTrip().then(() => {
  console.log('courseWorkbook.test.ts ok');
}).catch(error => {
  console.error(error);
  process.exit(1);
});
