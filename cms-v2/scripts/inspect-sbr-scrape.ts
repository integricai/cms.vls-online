import { scrapeCoursePage } from '../src/services/coursePageScraper';
import { parseTabPanelBlocks } from '../src/services/coursePageScraper';
import { buildMergedCourseStoryblokContent } from '../src/services/buildCourseTemplateContent';

async function main() {
  const scraped = await scrapeCoursePage('https://vls-online.com/courses/sbr');
  const content = buildMergedCourseStoryblokContent(scraped, '12935') as { body?: Array<Record<string, unknown>> };
  const intro = content.body?.find((b) => b.component === 'course_introduction');
  const tabs = content.body?.find((b) => b.component === 'course_tabs') as { tabs?: Array<Record<string, unknown>> } | undefined;

  console.log('=== MERGED INTRODUCTION ===');
  console.log('title:', intro?.title);
  console.log('p1 len:', String(intro?.paragraph_1 ?? '').length);
  console.log('p2 len:', String(intro?.paragraph_2 ?? '').length);

  console.log('\n=== MERGED TABS ===');
  for (const tab of tabs?.tabs ?? []) {
    const blocks = tab.blocks as Array<Record<string, unknown>>;
    console.log(`${tab.label}: ${blocks?.length ?? 0} blocks`);
    for (const block of blocks ?? []) {
      const cards = block.cards as unknown[] | undefined;
      const steps = block.steps as unknown[] | undefined;
      if (cards?.length) console.log(`  - ${block.block_type}: ${cards.length} cards`);
      if (steps?.length) console.log(`  - ${block.block_type}: ${steps.length} steps`);
    }
  }

  console.log('\n=== TAB BLOCK PARSE (raw) ===');
  for (const tab of scraped.tabs) {
    const blocks = parseTabPanelBlocks(tab.contentHtml);
    console.log(`${tab.label}: ${blocks.length} blocks`, blocks.map((b) => b.blockType));
  }
}

main().catch(console.error);
