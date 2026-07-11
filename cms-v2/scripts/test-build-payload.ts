import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

import { scrapeGenericPage } from '../src/services/pageScraper';
import { getMigrationTemplateBlueprint, applyTemplateStyles, sanitizeBlokForStoryblok } from '../src/services/migrationTemplateRegistry';

function blokUid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function buildContent() {
  const template = 'team_vls' as const;
  const scraped = await scrapeGenericPage('https://vls-online.com/teamvls');
  const blueprint = getMigrationTemplateBlueprint(template);
  const body: Record<string, unknown>[] = [];

  let sectionIndex = 0;
  for (const section of blueprint.sections) {
    const scrapedSection = scraped.sections[sectionIndex];
    sectionIndex += 1;

    let blok: Record<string, unknown> | null = null;
    if (section.component === 'page_hero') {
      blok = {
        _uid: blokUid(),
        component: 'page_hero',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || scraped.title || section.label,
        lead: scrapedSection?.bodyText || scraped.metaDescription || '',
        primary_cta_text: 'Learn more',
      };
    } else if (section.component === 'team_profiles') {
      blok = {
        _uid: blokUid(),
        component: 'team_profiles',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        profiles: [],
      };
    } else if (section.component === 'icon_card_grid') {
      blok = {
        _uid: blokUid(),
        component: 'icon_card_grid',
        eyebrow: section.label,
        heading_prefix: scrapedSection?.heading || section.label,
        description: scrapedSection?.bodyText || '',
        columns: 3,
        cards: [],
      };
    } else if (section.component === 'quote_block') {
      blok = {
        _uid: blokUid(),
        component: 'quote_block',
        eyebrow: section.label,
        quote: scrapedSection?.bodyText || scrapedSection?.heading || scraped.title,
        author_name: 'Vertex Learning Solutions',
        author_initials: 'V',
      };
    } else if (section.component === 'promotion_section') {
      blok = {
        _uid: blokUid(),
        component: 'promotion_section',
        name: `${template}/${section.key}`,
        title: scrapedSection?.heading || scraped.title || section.label || 'Get started',
        subtitle: scrapedSection?.bodyText || scraped.metaDescription || '',
        cta_text: 'Learn more',
      };
    }

    if (blok) {
      body.push(sanitizeBlokForStoryblok(applyTemplateStyles(blueprint, section.key, blok)));
    }
  }

  const content = {
    component: 'page',
    seo: [{
      _uid: blokUid(),
      component: 'seo',
      title: scraped.title,
      description: scraped.metaDescription,
      canonical_url: scraped.sourceUrl,
    }],
    body,
  };

  const json = JSON.stringify(content);
  console.log('payload bytes:', json.length);
  console.log('components:', body.map(b => b.component).join(', '));
  console.log(JSON.stringify(content, null, 2).slice(0, 2000));
}

buildContent().catch(err => {
  console.error('FAILED', err);
  process.exit(1);
});
