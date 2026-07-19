import { parseTemplateSectionsFromHtml, resolveTemplateSections } from '../src/services/pageSectionExtractor';
import { augmentStudyNotesZenlerSections } from '../src/services/zenlerStudyNotesParser';
import { getMigrationTemplateBlueprint } from '../src/services/migrationTemplateRegistry';

async function diagnose(label: string, url: string) {
  const res = await fetch(url);
  const html = await res.text();
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  let liveSections = parseTemplateSectionsFromHtml(body);
  liveSections = augmentStudyNotesZenlerSections(html, liveSections, url);
  const resolved = resolveTemplateSections('study_notes', liveSections);
  const blueprint = getMigrationTemplateBlueprint('study_notes');

  console.log(`\n=== ${label} ===`);
  console.log('Live keys:', liveSections.map(s => s.key).join(', ') || '(none)');
  for (const sec of blueprint.sections) {
    const merged = resolved.get(sec.key);
    if (!merged) continue;
    console.log(`  ${sec.key}: ${(merged.headingPrefix || '').slice(0, 70)}`);
    if (sec.key.includes('table') || sec.key.includes('notes')) {
      console.log(`    groups: ${merged.groups?.length ?? 0}, items: ${merged.groups?.[0]?.items?.length ?? 0}, label: ${merged.groups?.[0]?.label ?? ''}`);
    }
    if (sec.key === 'hero') {
      console.log(`    eyebrow: ${merged.eyebrow?.slice(0, 50)}`);
      console.log(`    price: ${merged.priceNow} | video: ${merged.videoUrl?.slice(0, 40) || '(none)'}`);
    }
  }
}

void (async () => {
  await diagnose('cimanotes', 'https://vls-online.com/cimanotes');
  await diagnose('cimae2notes', 'https://vls-online.com/courses/cimae2notes');
  await diagnose('accanotes', 'https://vls-online.com/accanotes');
})();
