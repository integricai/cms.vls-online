import assert from 'node:assert/strict';
import { linkedCourseStories } from './courseStoryDelete';

const stories = [
  { id: 1, fullSlug: 'courses', isFolder: true, component: '', zenlerCourseId: '' },
  { id: 2, fullSlug: 'courses/fa1', component: 'course_page', zenlerCourseId: '10' },
  { id: 3, fullSlug: 'courses/fa1-old', component: 'course_page', zenlerCourseId: '10' },
  { id: 4, fullSlug: 'courses/ma1', component: 'course_page', zenlerCourseId: '11' },
  { id: 5, fullSlug: 'courses/notes', component: 'page', zenlerCourseId: '10' },
];

const matches = linkedCourseStories(stories, '10');
assert.deepEqual(matches.map(story => story.id), [2, 3]);
assert.deepEqual(linkedCourseStories(stories, 'missing'), []);
assert.deepEqual(linkedCourseStories(stories, '  '), []);

console.log('courseStoryDelete tests passed');
