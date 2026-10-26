import assert from 'assert';
import { createHmac } from 'crypto';
import { scrapedBlogPostFromAutoseo } from './blogPageScraper';
import {
  chooseAutoseoSlug,
  parseAutoseoWebhook,
  storyContentPointsAtAutoseo,
  verifyAutoseoBearer,
  verifyAutoseoSignature,
  vlsBlogUrl,
} from './autoseoWebhook';

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ok ${name}`);
  } catch (err) {
    console.error(`  fail ${name}`);
    throw err;
  }
}

const secret = 'aseo_wh_test_secret';

function sign(body: string): string {
  return createHmac('sha256', secret).update(Buffer.from(body)).digest('hex');
}

const articleHtml = [
  '<h2>Key Takeaways</h2>',
  '<ul><li>Start with the ACCA exam blueprint.</li></ul>',
  '<p>AutoSEO helps you publish faster than a team of writers.</p>',
  '<h2>Want to create content like this?</h2>',
  '<p><a href="https://getautoseo.com/start">Get Started Free</a></p>',
  '<p>Read the <a href="https://getautoseo.com/shared/abc123">source article</a> or visit <a href="https://vls-online.com/courses">VLS courses</a>.</p>',
  '<p>Pricing lives at https://getautoseo.com/pricing for their own product.</p>',
  '<p><img src="https://cdn.getautoseo.com/storage/inline-chart.png" alt="ACCA study chart"></p>',
  `<p>${'Students revise the ACCA syllabus with practice questions. '.repeat(8)}</p>`,
].join('');

run('accepts a bearer token and the raw-body signature', () => {
  const body = Buffer.from('{"event":"test"}');
  assert.equal(verifyAutoseoBearer(`Bearer ${secret}`, secret), true);
  assert.equal(verifyAutoseoBearer('Bearer wrong', secret), false);
  assert.equal(verifyAutoseoSignature(body, sign(body.toString('utf8')), secret), true);
  assert.equal(verifyAutoseoSignature(body, `sha256=${sign(body.toString('utf8'))}`, secret), true);
  assert.equal(verifyAutoseoSignature(body, sign('{"event":"other"}'), secret), false);
  assert.equal(verifyAutoseoSignature(Buffer.from('{"event":"test"} '), sign('{"event":"test"}'), secret), false);
});

run('answers a test event without an article', () => {
  assert.deepEqual(parseAutoseoWebhook({ event: 'test' }), { ok: true, kind: 'test' });
  assert.equal(vlsBlogUrl(), 'https://vls-online.com/blog');
});

run('skips non-English deliveries', () => {
  const parsed = parseAutoseoWebhook({
    event: 'article.published',
    id: 7,
    languageCode: 'de',
    title: 'Steuern',
    slug: 'steuern',
    content_html: `<p>${'Wort '.repeat(40)}</p>`,
  });
  assert.deepEqual(parsed, { ok: true, kind: 'skip', autoseoId: 7 });
});

run('keeps the first slug when a later delivery would collide', () => {
  assert.equal(chooseAutoseoSlug({
    requestedSlug: 'how-to-grow',
    autoseoId: 42,
    slugTaken: false,
  }), 'how-to-grow');
  assert.equal(chooseAutoseoSlug({
    requestedSlug: 'renamed-slug',
    autoseoId: 42,
    savedSlug: 'how-to-grow',
    slugTaken: false,
  }), 'how-to-grow');
  assert.equal(chooseAutoseoSlug({
    requestedSlug: 'how-to-grow',
    autoseoId: 42,
    slugTaken: true,
  }), 'how-to-grow-42');
});

run('maps the article onto a VLS draft with local image sources and no AutoSEO links', () => {
  const parsed = parseAutoseoWebhook({
    event: 'article.published',
    id: 42,
    languageCode: 'en',
    title: 'How to Grow Your Business with SEO',
    slug: 'how-to-grow-your-business-with-seo',
    published_url: 'https://getautoseo.com/shared/abc123',
    metaDescription: 'Learn practical SEO strategies to attract more customers.',
    content_html: articleHtml,
    heroImageUrl: 'https://cdn.example.com/hero-image.jpg',
    heroImageAlt: 'Alt text for the hero image',
    infographicImageUrl: 'https://cdn.getautoseo.com/storage/infographic.png',
    keywords: ['ACCA', 'seo strategies'],
    faqSchema: [{ question: 'What is SEO?', answer: 'SEO stands for search engine optimisation.' }],
    publishedAt: '2026-03-04T10:30:00.000Z',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.kind !== 'article') throw new Error('expected article');

  const post = scrapedBlogPostFromAutoseo({
    ...parsed.article,
    slug: parsed.article.requestedSlug,
  });

  assert.equal(post.slug, 'how-to-grow-your-business-with-seo');
  assert.equal(post.sourceUrl, 'https://vls-online.com/blog/how-to-grow-your-business-with-seo');
  assert.equal(post.featuredImageUrl, 'https://cdn.example.com/hero-image.jpg');
  assert.equal(post.topic, 'ACCA');
  assert.equal(post.faqItems[0]?.question, 'What is SEO?');
  assert.equal(post.keyTakeaways[0], 'Start with the ACCA exam blueprint.');
  assert.match(post.bodyHtml, /href="\/blog\/how-to-grow-your-business-with-seo"/);
  assert.match(post.bodyHtml, /href="\/courses"/);
  assert.match(post.bodyHtml, /src="https:\/\/cdn\.getautoseo\.com\/storage\/inline-chart\.png"/);
  assert.match(post.bodyHtml, /src="https:\/\/cdn\.getautoseo\.com\/storage\/infographic\.png"/);
  assert.equal((post.bodyHtml.match(/infographic\.png/g) || []).length, 1);
  assert.doesNotMatch(post.bodyHtml, /Get Started Free|Powered by AutoSEO|AutoSEO helps you/i);
  assert.doesNotMatch(post.bodyHtml, /shared\/abc123/);
  assert.equal(/getautoseo\.com/i.test(post.bodyHtml.replace(/<img\b[^>]*>/gi, '')), false);
  assert.equal(JSON.stringify(post).includes('getautoseo.com/shared'), false);
  assert.equal(post.images.some(image => image.sourceUrl === post.featuredImageUrl), true);
  assert.equal(vlsBlogUrl(post.slug), post.sourceUrl);
});

run('builds HTML from markdown when the HTML body is empty', () => {
  const parsed = parseAutoseoWebhook({
    event: 'article.updated',
    id: 9,
    title: 'Markdown article',
    slug: 'markdown-article',
    content_html: '',
    content_markdown: [
      '## Study plan',
      '',
      'See [the course](https://getautoseo.com/shared/md) and ![chart](https://cdn.example.com/chart.png).',
      '',
      'Students revise the ACCA syllabus with practice questions. '.repeat(6),
    ].join('\n'),
    heroImageUrl: 'https://cdn.example.com/hero.jpg',
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok || parsed.kind !== 'article') throw new Error('expected article');
  assert.match(parsed.article.html, /<h2>Study plan<\/h2>/);
  assert.match(parsed.article.html, /<img src="https:\/\/cdn\.example\.com\/chart\.png"/);
  const post = scrapedBlogPostFromAutoseo({
    ...parsed.article,
    slug: parsed.article.requestedSlug,
  });
  assert.match(post.bodyHtml, /href="\/blog\/markdown-article"/);
  assert.equal(/getautoseo\.com/i.test(post.bodyHtml), false);
});

run('rejects a story that still points at AutoSEO', () => {
  assert.equal(storyContentPointsAtAutoseo({
    body: { href: 'https://cdn.getautoseo.com/storage/hero.jpg' },
  }), true);
  assert.equal(storyContentPointsAtAutoseo({
    body: { href: '/blog/how-to-grow' },
    featured_image: { filename: 'https://a.storyblok.com/f/space/hero.jpg' },
  }), false);
});

console.log('autoseo webhook tests passed');
