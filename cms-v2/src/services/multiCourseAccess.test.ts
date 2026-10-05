import assert from 'assert';
import {
  comboPricingZenlerIdFromStoryContent,
  comboZenlerIdsFromEnv,
  extractMultiCoursePaperZenlerIds,
} from './multiCourseStoryblokAllowlist';
import {
  assertBundleCheckoutHasSelection,
  assertComboSelectionSize,
  isComboPricingCourse,
  MultiCourseAccessError,
  parseAccessZenlerCourseIds,
} from './multiCourseAccess';

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

run('combo checkout without a selection is rejected', () => {
  assert.throws(
    () => assertBundleCheckoutHasSelection({
      comboStorySlug: 'courses/acca-combo',
      accessZenlerCourseIds: [],
    }),
    (err: unknown) => err instanceof MultiCourseAccessError
      && err.status === 400
      && /select the courses/i.test(err.message),
  );
});

run('single-course checkout does not require a selection', () => {
  assert.doesNotThrow(() => assertBundleCheckoutHasSelection({
    comboStorySlug: '',
    accessZenlerCourseIds: [],
    zenlerCourseId: '999',
    configuredComboZenlerCourseIds: ['165390'],
  }));
});

run('combo course without a slug or selection is rejected', () => {
  assert.throws(
    () => assertBundleCheckoutHasSelection({
      comboStorySlug: '',
      accessZenlerCourseIds: [],
      zenlerCourseId: '165390',
      configuredComboZenlerCourseIds: ['165390'],
    }),
    (err: unknown) => err instanceof MultiCourseAccessError && err.status === 400,
  );
});

run('configured combo zenler ids come from the env list and combo page content', () => {
  assert.deepStrictEqual(comboZenlerIdsFromEnv('165390, 165390 42'), ['165390', '42']);
  assert.strictEqual(
    comboPricingZenlerIdFromStoryContent({
      component: 'multi_course_page',
      zenler_course_id: { value: '165390', name: 'Combo' },
    }),
    '165390',
  );
  assert.strictEqual(
    comboPricingZenlerIdFromStoryContent({
      component: 'course_page',
      zenler_course_id: '165390',
    }),
    '',
  );
  assert.strictEqual(isComboPricingCourse({
    zenlerCourseId: '165390',
    configuredComboZenlerCourseIds: ['165390'],
  }), true);
});

run('combo checkout with a selection is allowed through', () => {
  assert.doesNotThrow(() => assertBundleCheckoutHasSelection({
    comboStorySlug: 'courses/acca-combo',
    accessZenlerCourseIds: ['111', '222'],
  }));
});

run('combo selection allows 2 through every listed course', () => {
  assert.doesNotThrow(() => assertComboSelectionSize(2, 6));
  assert.doesNotThrow(() => assertComboSelectionSize(6, 6));
  assert.throws(
    () => assertComboSelectionSize(1, 6),
    (err: unknown) => err instanceof MultiCourseAccessError && /at least 2/i.test(err.message),
  );
  assert.throws(
    () => assertComboSelectionSize(7, 6),
    (err: unknown) => err instanceof MultiCourseAccessError && /up to 6/i.test(err.message),
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
