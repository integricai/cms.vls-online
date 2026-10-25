import assert from 'node:assert/strict';
import { retakeEnrolUrl } from './retakeDiscountEmail';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`fail ${name}`);
    throw err;
  }
}

run('builds the public course page from the stored path', () => {
  assert.equal(
    retakeEnrolUrl('/courses/acca-afm-advanced-financial-management-revision'),
    'https://vls-online.com/courses/acca-afm-advanced-financial-management-revision',
  );
});

run('keeps the course path when the stored url is absolute', () => {
  assert.equal(
    retakeEnrolUrl('https://staging.vls-online.com/courses/acca-afm-advanced-financial-management-revision/'),
    'https://vls-online.com/courses/acca-afm-advanced-financial-management-revision',
  );
});

run('adds the discount code so only that visit opens the discount checkout', () => {
  assert.equal(
    retakeEnrolUrl('/courses/cima-e3-strategic-management-notes', 'RT-B9R53NML'),
    'https://vls-online.com/courses/cima-e3-strategic-management-notes?discount=RT-B9R53NML',
  );
});

run('omits a button target when the course has no page', () => {
  assert.equal(retakeEnrolUrl(null), null);
  assert.equal(retakeEnrolUrl(''), null);
  assert.equal(retakeEnrolUrl('/about'), null);
});
