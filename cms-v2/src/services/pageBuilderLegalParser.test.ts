import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { isPageBuilderLegalHtml, parsePageBuilderLegalSections } from './pageBuilderLegalParser';

const cookieHtmlPath = path.resolve(__dirname, '../../tmp-cookie-policy.html');
if (fs.existsSync(cookieHtmlPath)) {
  const html = fs.readFileSync(cookieHtmlPath, 'utf8');
  assert.equal(isPageBuilderLegalHtml(html), true);
  const sections = parsePageBuilderLegalSections(html);
  assert.ok(sections.length >= 8, `expected hero+article+sections, got ${sections.length}`);
  assert.ok(sections.some(section => section.key === 'legal-hero'));
  assert.ok(sections.some(section => section.key === 'legal-article'));
  const article = sections.find(section => section.key === 'legal-article');
  assert.ok((article?.legalTocItems?.length ?? 0) >= 7);
  assert.ok(sections.some(section => section.key === 'overview'));
  assert.ok(sections.some(section => section.key.includes('cookie')));
  console.log('pageBuilderLegalParser.test.ts: cookie-policy fixture passed');
} else {
  const sample = `
    <div class="abc123-header"><p style="text-transform:uppercase">LEGAL</p><h1>Cookie Policy</h1></div>
    <div class="abc123-layout">
      <div class="abc123-nav"><ul class="abc123-navlist">
        <a class="abc123-navlink" href="#abc123-s1"><span class="abc123-navnum">1</span>Overview</a>
      </ul></div>
      <div class="abc123-content">
        <div id="abc123-s1" class="abc123-section"><h2>Overview</h2><p>Cookie intro paragraph here for testing extraction.</p></div>
      </div>
    </div>`;
  const parsed = parsePageBuilderLegalSections(sample);
  assert.equal(parsed.length, 3);
  console.log('pageBuilderLegalParser.test.ts: sample passed');
}
