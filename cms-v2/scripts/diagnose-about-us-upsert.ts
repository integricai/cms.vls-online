import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../vls-online-v2/vls-web/.env.local') });

import { scrapeGenericPage } from '../src/services/pageScraper';
import { getMigrationTemplateBlueprint, applyTemplateStyles, sanitizeBlokForStoryblok, buildPresetBlokFromSection } from '../src/services/migrationTemplateRegistry';
import { mergePresetWithData } from '../src/services/storyblokComponentLibrary';

const spaceId = '293626385802926';
const token = process.env.STORYBLOK_PERSONAL_TOKEN ?? '';
const region = process.env.STORYBLOK_REGION === 'us' ? 'api-us' : 'mapi';
const base = `https://${region}.storyblok.com/v1/spaces/${spaceId}`;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function blokUid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

async function sbFetch(url: string, init?: RequestInit) {
  await sleep(200);
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const payload = await res.json().catch(() => null);
  return { res, payload };
}

async function buildTeamVlsContent(pageUrl: string) {
  const template = 'team_vls' as const;
  const scraped = await scrapeGenericPage(pageUrl);
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

    if (!blok) continue;
    const preset = buildPresetBlokFromSection(blueprint, section);
    const styled = applyTemplateStyles(blueprint, section.key, blok);
    body.push(sanitizeBlokForStoryblok(mergePresetWithData(preset, styled, section.styles)));
  }

  return {
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
}

async function main() {
  const slug = 'about-us';
  const content = await buildTeamVlsContent('https://vls-online.com/about-us');

  console.log('Body components:', (content.body as unknown[]).map(b => (b as { component?: string }).component).join(', '));
  console.log('Payload bytes:', JSON.stringify(content).length);

  const { res: lookupRes, payload: lookupPayload } = await sbFetch(`${base}/stories?with_slug=${encodeURIComponent(slug)}`);
  console.log('Existing story lookup:', lookupRes.status, lookupPayload?.stories?.[0]?.id ?? 'none', lookupPayload?.stories?.[0]?.is_folder ?? false);

  const existingId = lookupPayload?.stories?.[0]?.id;
  const { res, payload } = await sbFetch(`${base}/stories${existingId ? `/${existingId}` : ''}`, {
    method: existingId ? 'PUT' : 'POST',
    body: JSON.stringify({
      story: {
        name: 'About Us | Vertex Learning Solutions',
        slug,
        content,
      },
      publish: 0,
    }),
  });

  console.log('Upsert status:', res.status);
  console.log(JSON.stringify(payload, null, 2).slice(0, 4000));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
