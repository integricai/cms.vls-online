import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { parseFaq, parseFaqFromAccordion, parseFaqFromMarkup } from './faqParser';

function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, '../../../sample-html', name), 'utf8');
}

function run(name: string, fn: () => void): void {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('faqParser tests');

run('extracts all FAQ items from the aboutcima Bootstrap accordion markup', () => {
  const html = fixture('aboutcima.html');
  const result = parseFaq(html);
  assert.strictEqual(result.faq?.items.length, 9);
  assert.strictEqual(result.warnings.length, 0);
  assert.strictEqual(
    result.faq?.items[0].question,
    'How is CIMA® qualification different from other accounting certifications?',
  );
  assert.ok(result.faq?.items[0].answerText.includes('investment & management accounting'));
});

run('parseFaqFromAccordion ignores non-FAQ accordions without an FAQ signal', () => {
  const html = `
    <div class="panel-group" id="pricing">
      <div class="panel"><h4 class="panel-title">Plan A</h4><div class="panel-body"><p>Details</p></div></div>
    </div>
  `;
  assert.strictEqual(parseFaqFromAccordion(html), null);
});

run('extracts FAQ items from the vlsfaq widget markup (course pages)', () => {
  const html = fixture('fa2.html');
  const result = parseFaq(html);
  assert.strictEqual(result.faq?.items.length, 8);
  assert.strictEqual(result.warnings.length, 0);
});

run('parseFaqFromMarkup returns null when no vlsfaq wrapper is present', () => {
  const html = fixture('aboutcima.html');
  assert.strictEqual(parseFaqFromMarkup(html), null);
});
