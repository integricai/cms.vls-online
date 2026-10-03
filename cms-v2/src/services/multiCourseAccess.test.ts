import assert from 'assert';
import { extractMultiCoursePaperZenlerIds } from './multiCourseStoryblokAllowlist';
import { parseAccessZenlerCourseIds } from './multiCourseAccess';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('multiCourseAccess tests');

run('parseAccessZenlerCourseIds from array', () => {
  assert.deepStrictEqual(
    parseAccessZenlerCourseIds({ accessZenlerCourseIds: ['111', '222', '111'] }),
    ['111', '222'],
  );
});

run('extract paper zenler ids from story content', () => {
  const ids = extractMultiCoursePaperZenlerIds({
    component: 'multi_course_page',
    paper_options: [
      { zenler_course_id: '10' },
      { zenler_course_id: '20' },
      { zenler_course_id: '10' },
      { zenler_course_id: '' },
    ],
  });
  assert.deepStrictEqual(ids, ['10', '20']);
});
