import type { ScrapedGenericPage, ScrapedTemplateSection } from '../../shared/migrationTypes';
import type { TemplateSectionBlueprint } from '../../shared/migrationTemplateTypes';
import { sanitizeBlokForStoryblok } from './migrationTemplateRegistry';

function uid(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function storyblokLink(url: string | undefined): Record<string, string> | undefined {
  const trimmed = url?.trim();
  if (!trimmed) return undefined;
  return { linktype: 'url', url: trimmed, cached_url: trimmed };
}

function pickText(...values: Array<string | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return '';
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid();
}

export function buildBlokFromTemplateSection(
  section: TemplateSectionBlueprint,
  extracted: ScrapedTemplateSection | undefined,
  scraped: ScrapedGenericPage,
): Record<string, unknown> | null {
  // `section.sampleHeading`/`sampleDescription` are the static template reference file's own
  // sample copy (design reference only). With no live match, using them here would silently pass
  // off placeholder text as migrated content — omit the section instead (see detectUnmatchedSections).
  if (!extracted) return null;

  const base = {
    _uid: uid(),
    component: section.component,
  };

  if (section.component === 'page_hero') {
    const sideCard = extracted?.sideCard;
    const blok: Record<string, unknown> = {
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading, scraped.title),
      heading_accent: pickText(extracted?.headingAccent),
      lead: pickText(extracted?.lead, extracted?.body, section.sampleDescription, scraped.metaDescription),
      primary_cta_text: pickText(extracted?.ctaText, 'Learn more'),
    };

    if (extracted?.heroItems.length) {
      blok.items = extracted.heroItems.map(item => ({
        _uid: uid(),
        component: 'page_hero_item',
        text: item.text,
        variant: 'tick',
      }));
    }

    if (sideCard?.quote || sideCard?.authorName) {
      blok.side_card = [{
        _uid: uid(),
        component: 'page_hero_side_card',
        tag: sideCard.tag,
        quote: sideCard.quote,
        author_name: sideCard.authorName,
        author_role: sideCard.authorRole,
      }];
    }

    if (extracted?.badges.length) {
      blok.badges = extracted.badges.map((badge, index) => ({
        _uid: uid(),
        component: 'page_hero_badge',
        title: badge.title,
        subtitle: badge.subtitle,
        tone: index === 0 ? 'green' : 'blue',
      }));
    }

    return sanitizeBlokForStoryblok(blok);
  }

  if (section.component === 'stats_band') {
    const items = extracted?.stats.length
      ? extracted.stats.map(stat => ({
          _uid: uid(),
          component: 'stat_item',
          value: stat.value,
          label: stat.label,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      background_color: '#0E2A57',
      ...(items ? { items } : {}),
    });
  }

  if (section.component === 'content_section') {
    const timeline = extracted?.timeline.length
      ? extracted.timeline.map(item => ({
          _uid: uid(),
          component: 'timeline_item',
          year: item.year,
          title: item.title,
          text: item.text,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      body: pickText(extracted?.body, extracted?.lead, section.sampleDescription),
      ...(timeline ? { timeline } : {}),
    });
  }

  if (section.component === 'icon_card_grid') {
    const cards = extracted?.cards.length
      ? extracted.cards.map(card => ({
          _uid: uid(),
          component: 'icon_card',
          title: card.title,
          description: card.description,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      columns: '3',
      ...(cards ? { cards } : {}),
    });
  }

  if (section.component === 'global_reach_section') {
    const reachFigs = extracted?.stats.length
      ? extracted.stats.map(stat => ({
          _uid: uid(),
          component: 'stat_item',
          value: stat.value,
          label: stat.label,
        }))
      : undefined;

    const regions = extracted?.cards.length
      ? extracted.cards.map(card => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: card.title,
          subtitle: card.description,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      lead: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      cta_text: pickText(extracted?.ctaText, 'Browse all courses'),
      ...(reachFigs ? { reach_figs: reachFigs } : {}),
      ...(regions ? { regions } : {}),
    });
  }

  if (section.component === 'article_library') {
    const colorTones = ['blue', 'green', 'amber', 'purple', 'teal', 'navy', 'rose', 'gold'];
    const topics = extracted?.groups.length
      ? extracted.groups.map((group, index) => ({
          _uid: uid(),
          component: 'article_topic_group',
          topic_key: slugify(group.label),
          label: group.label,
          color_tone: colorTones[index % colorTones.length],
          articles: group.items.map(item => ({
            _uid: uid(),
            component: 'article_link_item',
            code: item.code,
            title: item.title,
            description: item.description,
            ...(storyblokLink(item.url) ? { url: storyblokLink(item.url) } : {}),
          })),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      sidebar_label: 'Currently viewing',
      sidebar_value: pickText(extracted?.headingPrefix, section.label),
      // Explicitly override the component-library preset's `note_text` (a design-reference
      // sample, not real page content) — otherwise it survives the preset merge whenever no
      // real note was extracted from the live page.
      note_text: '',
      ...(topics ? { topics } : {}),
    });
  }

  if (section.component === 'contact_cards') {
    const cards = extracted?.contactCards.length
      ? extracted.contactCards.map(card => ({
          _uid: uid(),
          component: 'contact_card',
          title: card.title,
          detail: card.detail,
          link_text: card.linkText,
          ...(card.linkUrl ? { link: storyblokLink(card.linkUrl) } : {}),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      ...(cards ? { cards } : {}),
    });
  }

  if (section.component === 'promotion_section') {
    return sanitizeBlokForStoryblok({
      ...base,
      name: section.key,
      eyebrow: pickText(extracted?.eyebrow),
      title: pickText(extracted?.ctaTitle, extracted?.headingPrefix, section.sampleHeading, scraped.title, 'Get started'),
      subtitle: pickText(extracted?.ctaSubtitle, extracted?.body, extracted?.lead, section.sampleDescription, scraped.metaDescription),
      cta_text: pickText(extracted?.ctaText, 'Learn more'),
    });
  }

  if (section.component === 'quote_block') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      quote: pickText(extracted?.body, extracted?.lead, extracted?.headingPrefix, section.sampleDescription),
      author_name: pickText(extracted?.sideCard?.authorName, 'Vertex Learning Solutions'),
      author_initials: 'V',
    });
  }

  if (section.component === 'team_profiles') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.body, extracted?.lead, section.sampleDescription),
    });
  }

  if (section.component === 'faq_section' && scraped.faq?.items.length) {
    return null;
  }

  return sanitizeBlokForStoryblok({
    ...base,
    eyebrow: pickText(extracted?.eyebrow, section.label),
    heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading, scraped.title),
    heading_accent: pickText(extracted?.headingAccent),
    body: pickText(extracted?.body, extracted?.lead, section.sampleDescription, scraped.metaDescription),
    description: pickText(extracted?.body, extracted?.lead, section.sampleDescription, scraped.metaDescription),
  });
}
