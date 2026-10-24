import assert from 'assert';
import { resolveSitemapGroup, storyblokSlugToPath } from './sitemapPaths';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('sitemapPaths tests');

run('maps the home story and the pages folder start page to /', () => {
  assert.strictEqual(storyblokSlugToPath('home'), '/');
  assert.strictEqual(storyblokSlugToPath('pages'), '/');
  assert.strictEqual(storyblokSlugToPath('pages/home'), '/');
  assert.strictEqual(storyblokSlugToPath('/home/'), '/');
});

run('keeps course, blog, and root marketing paths', () => {
  assert.strictEqual(storyblokSlugToPath('courses'), '/courses');
  assert.strictEqual(storyblokSlugToPath('courses/fa1'), '/courses/fa1');
  assert.strictEqual(storyblokSlugToPath('blog/acca-guide'), '/blog/acca-guide');
  assert.strictEqual(storyblokSlugToPath('about-us'), '/about-us');
  assert.strictEqual(storyblokSlugToPath('pages/accadates'), '/accadates');
  assert.strictEqual(
    storyblokSlugToPath('about-acca-articles/2027-qualification-changes'),
    '/about-acca-articles/2027-qualification-changes',
  );
});

run('puts root stories and pages/ stories in the pages sitemap', () => {
  assert.strictEqual(resolveSitemapGroup('home'), 'pages');
  assert.strictEqual(resolveSitemapGroup('about-us'), 'pages');
  assert.strictEqual(resolveSitemapGroup('accadates'), 'pages');
  assert.strictEqual(resolveSitemapGroup('pages/contact-us'), 'pages');
  assert.strictEqual(resolveSitemapGroup('about-acca-articles/2027-qualification-changes'), 'pages');
});

run('keeps courses, the courses hub, and blog in their own sitemaps', () => {
  assert.strictEqual(resolveSitemapGroup('courses'), 'courses');
  assert.strictEqual(resolveSitemapGroup('courses/fa1'), 'courses');
  assert.strictEqual(resolveSitemapGroup('blog'), 'blog');
  assert.strictEqual(resolveSitemapGroup('blog/acca-guide'), 'blog');
  assert.strictEqual(resolveSitemapGroup('pages/blog/acca-guide'), 'blog');
});

run('leaves global chrome out of every sitemap', () => {
  assert.strictEqual(resolveSitemapGroup('global'), null);
  assert.strictEqual(resolveSitemapGroup('global/header'), null);
  assert.strictEqual(resolveSitemapGroup(''), null);
});
