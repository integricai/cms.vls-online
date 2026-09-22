import assert from 'node:assert/strict';
import {
  courseRedirectUrls,
  courseSlugFromPath,
  normalizePublicCoursePath,
  planCourseUrlChanges,
  replaceCourseHref,
  rewriteCourseLinksInContent,
} from './courseUrlRewrite';

assert.equal(normalizePublicCoursePath('https://www.vls-online.com/courses/fa1?ref=1'), '/courses/fa1');
assert.equal(normalizePublicCoursePath('/courses/fa1/'), '/courses/fa1');
assert.equal(normalizePublicCoursePath('courses/fa1-2027'), '/courses/fa1-2027');
assert.equal(normalizePublicCoursePath('/courses/fa1/buy'), null);
assert.equal(courseSlugFromPath('/courses/fa1-2027'), 'fa1-2027');

const replacements = [{ fromPath: '/courses/fa1', toPath: '/courses/fa1-2027' }];

assert.equal(
  replaceCourseHref('https://www.vls-online.com/courses/fa1?ref=grid#packs', replacements),
  '/courses/fa1-2027?ref=grid#packs',
);
assert.equal(replaceCourseHref('/courses/fa1/', replacements), '/courses/fa1-2027');
assert.equal(replaceCourseHref('courses/fa1', replacements), '/courses/fa1-2027');
assert.equal(replaceCourseHref('/courses/fa1-notes', replacements), null);
assert.equal(replaceCourseHref('/courses/fa10', replacements), null);
assert.equal(replaceCourseHref('https://example.com/courses/fa1', replacements), null);

const rewritten = rewriteCourseLinksInContent({
  component: 'page',
  body: [
    {
      component: 'courses_hub_course',
      cta_link: {
        linktype: 'url',
        url: 'https://vls-online.com/courses/fa1',
        cached_url: '/courses/fa1',
      },
    },
    {
      component: 'richtext',
      content: {
        type: 'doc',
        content: [{
          type: 'text',
          text: 'See /courses/fa1',
          marks: [{ type: 'link', attrs: { href: '/courses/fa1/', linktype: 'url' } }],
        }],
      },
    },
  ],
}, replacements);

assert.equal(rewritten.rewritten, 2);
const hub = rewritten.content.body as Array<{ cta_link: { url: string; cached_url: string } }>;
assert.equal(hub[0].cta_link.url, '/courses/fa1-2027');
assert.equal(hub[0].cta_link.cached_url, '/courses/fa1-2027');
const attrs = (rewritten.content.body as Array<{ content: { content: Array<{ marks: Array<{ attrs: { href: string } }> }> } }>)[1]
  .content.content[0].marks[0].attrs;
assert.equal(attrs.href, '/courses/fa1-2027');

const plan = planCourseUrlChanges(
  [
    { id: 1, name: 'FA1', zenlerCourseId: '10', coursePageUrl: '/courses/fa1-2027' },
    { id: 2, name: 'MA1', zenlerCourseId: '11', coursePageUrl: '/courses/ma1' },
    { id: 3, name: 'BT', zenlerCourseId: '12', coursePageUrl: 'not a path' },
    { id: 4, name: 'PM', zenlerCourseId: '13', coursePageUrl: '/courses/pm' },
  ],
  [
    { id: 100, fullSlug: 'courses/fa1', zenlerCourseId: '10', component: 'course_page' },
    { id: 101, fullSlug: 'courses/ma1', zenlerCourseId: '11', component: 'course_page' },
    { id: 102, fullSlug: 'courses/pm-a', zenlerCourseId: '13', component: 'course_page' },
    { id: 103, fullSlug: 'courses/pm-b', zenlerCourseId: '13', component: 'course_page' },
  ],
);

assert.equal(plan.unchanged, 1);
assert.equal(plan.changes.length, 1);
assert.deepEqual(plan.changes[0], {
  courseId: 1,
  courseName: 'FA1',
  zenlerCourseId: '10',
  fromPath: '/courses/fa1',
  toPath: '/courses/fa1-2027',
  storyId: 100,
});
assert.equal(plan.errors.length, 2);

assert.deepEqual(
  courseRedirectUrls('/courses/fa1', '/courses/fa1-2027', ['https://www.vls-online.com', 'https://vls-online.com/']),
  [
    {
      sourceUrl: 'https://www.vls-online.com/courses/fa1',
      targetUrl: 'https://www.vls-online.com/courses/fa1-2027',
    },
    {
      sourceUrl: 'https://vls-online.com/courses/fa1',
      targetUrl: 'https://vls-online.com/courses/fa1-2027',
    },
  ],
);

console.log('courseUrlRewrite tests passed');
