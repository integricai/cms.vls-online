import assert from 'node:assert/strict';
import {
  getTemplateFileSections,
  mergeTemplateSectionSources,
  parseTemplateSectionsFromHtml,
  sectionHasLiveMatch,
} from './pageSectionExtractor';
import { buildBlokFromTemplateSection } from './pageContentBuilder';
import { getMigrationTemplateBlueprint } from './migrationTemplateRegistry';
import type { ScrapedGenericPage } from '../../shared/migrationTypes';

// Part A: merge must not throw when live arrays are undefined
const templateSections = getTemplateFileSections('legal');
const heroTemplate = templateSections.find(section => section.key.includes('legal-hero') || section.html.includes('legal-hero'))
  ?? templateSections[0];
const heroLive = { ...heroTemplate, legalMetaItems: undefined, legalTabs: undefined };
assert.doesNotThrow(() => mergeTemplateSectionSources(heroLive as typeof heroTemplate, heroTemplate));

const blueprint = getMigrationTemplateBlueprint('legal');
const heroBlueprint = blueprint.sections.find(section => section.component === 'legal_hero')!;
const scraped: ScrapedGenericPage = {
  sourceUrl: 'https://vls-online.com/cookie-policy',
  slug: 'cookie-policy',
  title: 'Cookie Policy',
  metaDescription: 'Cookie policy',
  breadcrumbItems: [],
  sections: [],
  templateSections: [heroLive as typeof heroTemplate],
  faq: null,
  extractionWarnings: [],
  rawHtml: '',
};
assert.doesNotThrow(() => buildBlokFromTemplateSection(heroBlueprint, heroLive as typeof heroTemplate, scraped));

// Part C: legal template sections parse with real keys, not only ARTICLE
const cookieStyleHtml = `
<section class="legal-hero"><div class="wrap"><h1>Cookie Policy</h1><div class="meta-row"><span class="meta-item">Last updated</span></div></div></section>
<div class="wrap layout">
  <aside class="toc"><div class="toc-title">On this page</div></aside>
  <article class="article">
    <p class="intro">We use cookies on this site.</p>
    <section id="what-are-cookies" class="sec"><div class="sec-h"><span class="num">01</span><h2>What are cookies</h2></div><p>Cookies are small files.</p></section>
    <section id="cookies-we-use" class="sec"><div class="sec-h"><span class="num">02</span><h2>Cookies we use</h2></div><p>We use analytics cookies.</p></section>
  </article>
</div>`;
const parsed = parseTemplateSectionsFromHtml(cookieStyleHtml);
const keys = parsed.map(section => section.key);
assert.ok(keys.includes('legal-hero') || keys.some(key => key.includes('legal-hero')));
assert.ok(keys.includes('legal-article'));
assert.ok(keys.includes('what-are-cookies'));
assert.ok(keys.includes('cookies-we-use'));

// Part B: sectionHasLiveMatch respects live keys only
const liveScraped: ScrapedGenericPage = {
  ...scraped,
  templateSections: parsed,
};
assert.equal(sectionHasLiveMatch('what-are-cookies', 'legal_section', liveScraped), true);
assert.equal(sectionHasLiveMatch('who-we-are', 'legal_section', liveScraped), false);

console.log('legalMigration.test.ts: all assertions passed');
