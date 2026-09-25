import assert from 'node:assert/strict';
import { planCourseSalesPageUrlSync } from './courseSalesPageUrlSync';

const courses = [
  { zenlerCourseId: '10', name: 'FA1', coursePageUrl: null, isActive: true },
  { zenlerCourseId: '11', name: 'MA1', coursePageUrl: 'https://www.vls-online.com/courses/ma1/', isActive: true },
  { zenlerCourseId: '12', name: 'FA2', coursePageUrl: '/courses/fa2-old', isActive: true },
  { zenlerCourseId: '13', name: 'PM', coursePageUrl: '/courses/pm', isActive: true },
  { zenlerCourseId: '14', name: 'AA', coursePageUrl: null, isActive: true },
  { zenlerCourseId: '15', name: 'Retired', coursePageUrl: null, isActive: false },
  { zenlerCourseId: '16', name: 'BT', coursePageUrl: 'https://vls.newzenler.com/courses/bt', isActive: true },
  { zenlerCourseId: '17', name: 'LW', coursePageUrl: '/courses/lw', isActive: true },
  {
    zenlerCourseId: '18',
    name: 'SBL',
    coursePageUrl: '/courses/strategic-business-leader-sbl',
    isActive: true,
  },
];

const plan = planCourseSalesPageUrlSync(courses, [
  { fullSlug: 'courses/', isFolder: true, component: '', zenlerCourseId: '' },
  { fullSlug: 'courses/', component: 'page', zenlerCourseId: '' },
  { fullSlug: 'courses/fa1', component: 'course_page', zenlerCourseId: '10' },
  { fullSlug: 'courses/ma1', component: 'course_page', zenlerCourseId: '11' },
  { fullSlug: 'courses/fa2', component: 'course_page', zenlerCourseId: '12' },
  { fullSlug: 'courses/pm-a', component: 'course_page', zenlerCourseId: '13', published: true },
  { fullSlug: 'courses/pm-b', component: 'course_page', zenlerCourseId: '13', published: true },
  {
    fullSlug: 'courses/strategic-business-leader-sbl',
    component: 'course_page',
    zenlerCourseId: '18',
    published: false,
  },
  {
    fullSlug: 'courses/acca-sbl-strategic-business-leader',
    component: 'course_page',
    zenlerCourseId: '18',
    published: true,
  },
  { fullSlug: 'courses/orphan', component: 'course_page', zenlerCourseId: '' },
  { fullSlug: 'courses/unknown', component: 'course_page', zenlerCourseId: '99' },
  { fullSlug: 'courses/bt', component: 'course_page', zenlerCourseId: '16' },
  { fullSlug: 'courses/lw', component: 'course_page', zenlerCourseId: '17' },
]);

assert.equal(plan.scanned, 11);
assert.deepEqual(plan.updates, [
  { zenlerCourseId: '10', pageUrl: '/courses/fa1' },
  { zenlerCourseId: '11', pageUrl: '/courses/ma1' },
  { zenlerCourseId: '12', pageUrl: '/courses/fa2' },
  { zenlerCourseId: '18', pageUrl: '/courses/acca-sbl-strategic-business-leader' },
  { zenlerCourseId: '16', pageUrl: '/courses/bt' },
]);
assert.equal(plan.unchanged, 1);
assert.equal(plan.unmatched, 4);
assert.deepEqual(plan.missing.map(issue => issue.name), ['AA']);
assert.equal(plan.conflicts.length, 1);
assert.equal(plan.conflicts[0].name, 'PM');
assert.match(plan.conflicts[0].detail, /\/courses\/pm-a/);
assert.match(plan.conflicts[0].detail, /\/courses\/pm-b/);

console.log('courseSalesPageUrlSync.test.ts passed');
