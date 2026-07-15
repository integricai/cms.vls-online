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

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || uid();
}

const VALUES_ICON_KEYS = ['heart', 'globe', 'chart'];
const PLATFORM_ICON_KEYS = ['video', 'book', 'help', 'document', 'checklist', 'upload', 'chat', 'message'];
const CONTACT_ICON_KEYS = ['phone', 'mail', 'pin'];

function iconKeyForCard(sectionKey: string, index: number): string | undefined {
  if (sectionKey.includes('values') || sectionKey.includes('culture')) {
    return VALUES_ICON_KEYS[index];
  }
  if (sectionKey.includes('platform')) {
    return PLATFORM_ICON_KEYS[index];
  }
  if (sectionKey.includes('career')) {
    return ['chart', 'document', 'chart', 'search', 'briefcase', 'shield'][index];
  }
  if (sectionKey.includes('industr')) {
    return ['building', 'desktop', 'chart', 'health', 'building', 'cart', 'factory', 'globe'][index];
  }
  return undefined;
}

function landingCardVariant(sectionKey: string): string | undefined {
  if (sectionKey.includes('career')) return 'career';
  if (sectionKey.includes('how-long')) return 'duo';
  if (sectionKey.includes('entry')) return 'requirement';
  if (sectionKey.includes('industr')) return 'industry';
  return undefined;
}

function landingCardColumns(sectionKey: string, fallback: number): number {
  if (sectionKey.includes('career')) return 3;
  if (sectionKey.includes('how-long')) return 2;
  if (sectionKey.includes('industr')) return 4;
  return fallback;
}

function contactIconKey(index: number): string {
  return CONTACT_ICON_KEYS[index] ?? 'mail';
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
      sublead: pickText(extracted?.sublead),
      primary_cta_text: pickText(extracted?.ctaText, 'Meet the team'),
      secondary_cta_text: pickText(extracted?.secondaryCtaText, 'Browse all courses'),
      primary_cta_link: storyblokLink(extracted?.primaryCtaLink || '/courses'),
      secondary_cta_link: storyblokLink(extracted?.secondaryCtaLink || '/book-a-meeting'),
    };

    if (extracted?.heroItems.length) {
      blok.items = extracted.heroItems.map(item => ({
        _uid: uid(),
        component: 'page_hero_item',
        text: item.text,
        variant: section.key.includes('hero') && item.text ? 'pill' : 'tick',
      }));
    }

    if (sideCard?.quote || sideCard?.authorName || sideCard?.rows?.length || sideCard?.title) {
      blok.side_card = [{
        _uid: uid(),
        component: 'page_hero_side_card',
        tag: sideCard.tag,
        title: sideCard.title,
        quote: sideCard.quote,
        author_name: sideCard.authorName,
        author_role: sideCard.authorRole,
        author_initials: sideCard.authorInitials || 'V',
        footer_label: sideCard.footerLabel,
        footer_value: sideCard.footerValue,
        ...(sideCard.rows?.length ? {
          rows: sideCard.rows.map(row => ({
            _uid: uid(),
            component: 'page_hero_side_row',
            number_label: row.number,
            title: row.title,
            subtitle: row.subtitle,
          })),
        } : {}),
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
      background_color: '#FFFFFF',
      padding_top: 0,
      padding_bottom: 34,
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
    const isPlatform = section.key.includes('platform');
    const landingVariant = landingCardVariant(section.key);
    const cards = extracted?.cards.length
      ? extracted.cards.map((card, index) => ({
          _uid: uid(),
          component: 'icon_card',
          title: card.title,
          description: card.description,
          icon_key: iconKeyForCard(section.key, index),
          ...(card.figureValue ? { figure_value: card.figureValue } : {}),
          ...(card.figureLabel ? { figure_label: card.figureLabel } : {}),
          ...(card.isTip ? { is_tip: true } : {}),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      columns: landingCardColumns(section.key, isPlatform ? 4 : 3),
      card_variant: landingVariant || (isPlatform ? 'platform' : 'feature'),
      show_device_pills: isPlatform,
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
      cta_link: storyblokLink('/courses'),
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
      ? extracted.contactCards.map((card, index) => ({
          _uid: uid(),
          component: 'contact_card',
          title: card.title,
          detail: card.detail,
          link_text: card.linkText,
          icon_key: contactIconKey(index),
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
      eyebrow: pickText(extracted?.eyebrow, 'Join the community'),
      title: pickText(extracted?.headingPrefix, extracted?.ctaTitle, section.sampleHeading, scraped.title, 'Get started'),
      title_accent: pickText(extracted?.headingAccent),
      subtitle: pickText(extracted?.ctaSubtitle, extracted?.body, extracted?.lead, section.sampleDescription, scraped.metaDescription),
      cta_text: pickText(extracted?.ctaText, 'Explore courses'),
      cta_link: storyblokLink('/courses'),
      secondary_cta_text: pickText(extracted?.secondaryCtaText, 'Book a meeting'),
      secondary_cta_link: storyblokLink('/bookmeeting'),
    });
  }

  if (section.component === 'quote_block') {
    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      quote: pickText(extracted?.body, extracted?.lead, extracted?.headingPrefix, section.sampleDescription),
      quote_accent: pickText(extracted?.headingAccent),
      author_name: pickText(extracted?.sideCard?.authorName, 'Vertex Learning Solutions'),
      author_role: pickText(extracted?.sideCard?.authorRole, 'Student'),
      author_initials: 'V',
    });
  }

  if (section.component === 'team_profiles') {
    const profiles = extracted?.profiles.length
      ? extracted.profiles.map(profile => ({
          _uid: uid(),
          component: 'team_profile',
          name: profile.name,
          role: profile.role,
          initials: profile.initials,
          bio: profile.bio,
          tags: profile.tags,
          logos_note: profile.logosNote,
          stats: profile.stats.map(stat => ({
            _uid: uid(),
            component: 'team_profile_stat',
            value: stat.value,
            label: stat.label,
          })),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      ...(profiles ? { profiles } : {}),
    });
  }

  if (section.component === 'step_cards') {
    const steps = extracted?.steps.length
      ? extracted.steps.map(step => ({
          _uid: uid(),
          component: 'step_card',
          number: step.number,
          title: step.title,
          description: step.description,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      ...(steps ? { steps } : {}),
    });
  }

  if (section.component === 'live_schedule') {
    const sessions = extracted?.sessions.length
      ? extracted.sessions.map(session => ({
          _uid: uid(),
          component: 'live_session',
          tag: session.tag,
          mode: session.mode,
          title: session.title,
          tutors: session.tutors,
          schedule_line: session.scheduleLine,
          time_line: session.timeLine,
          extras_line: session.extrasLine,
          mock_chip: session.mockChip,
          track: session.track,
          ...(storyblokLink(session.courseLink) ? { course_link: storyblokLink(session.courseLink) } : {}),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      ...(sessions ? { sessions } : {}),
    });
  }

  if (section.component === 'live_sessions_table') {
    const sessions = extracted?.liveSessionRows.length
      ? extracted.liveSessionRows.map(row => ({
          _uid: uid(),
          component: 'live_session_row',
          paper_code: row.paperCode,
          paper_name: row.paperName,
          tutors: row.tutors,
          track: row.track,
          format_label: row.formatLabel,
          start_date: row.startDate,
          live_day: row.liveDay,
          live_time: row.liveTime,
          end_date: row.endDate,
          mock_label: row.mockLabel,
          ...(storyblokLink(row.courseLink) ? { course_link: storyblokLink(row.courseLink) } : {}),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      note_heading: pickText(extracted?.noteHeading),
      note_text: pickText(extracted?.noteText),
      ...(sessions ? { sessions } : {}),
    });
  }

  if (section.component === 'qualification_structure') {
    const levels = extracted?.levels.length
      ? extracted.levels.map(level => ({
          _uid: uid(),
          component: 'qualification_level',
          number: level.number,
          title: level.title,
          requirement: level.requirement,
          tone: level.tone,
          papers: level.papers.map(paper => ({
            _uid: uid(),
            component: 'qualification_paper',
            code: paper.code,
            name: paper.name,
          })),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      description: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      ...(levels ? { levels } : {}),
    });
  }

  if (section.component === 'book_meeting_hero') {
    const benefits = extracted?.labeledItems.length
      ? extracted.labeledItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;
    const metaItems = extracted?.legalMetaItems.length
      ? extracted.legalMetaItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      free_pill: pickText(extracted?.freePill, 'Free consultation'),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      lead: pickText(extracted?.lead, section.sampleDescription, scraped.metaDescription),
      scheduler_title: pickText(extracted?.schedulerTitle, 'Pick a time that suits you'),
      scheduler_subtitle: pickText(extracted?.schedulerSubtitle),
      scheduler_placeholder_heading: pickText(extracted?.schedulerPlaceholderHeading),
      scheduler_placeholder_text: pickText(extracted?.schedulerPlaceholderText),
      scheduler_cta_text: pickText(extracted?.schedulerCtaText, 'Book your free meeting'),
      ...(storyblokLink(extracted?.schedulerCtaLink) ? { scheduler_cta_link: storyblokLink(extracted?.schedulerCtaLink) } : {}),
      ...(benefits ? { benefits } : {}),
      ...(metaItems ? { meta_items: metaItems } : {}),
    });
  }

  if (section.component === 'live_sessions_hero') {
    const ticks = extracted?.labeledItems.length
      ? extracted.labeledItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;
    const cardRows = extracted?.cardRows.length
      ? extracted.cardRows.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      free_pill: pickText(extracted?.freePill),
      eyebrow: pickText(extracted?.eyebrow, section.label),
      heading_prefix: pickText(extracted?.headingPrefix, section.sampleHeading),
      heading_accent: pickText(extracted?.headingAccent),
      lead: pickText(extracted?.lead, section.sampleDescription, scraped.metaDescription),
      primary_cta_text: pickText(extracted?.ctaText, 'View the schedule'),
      ...(storyblokLink(extracted?.primaryCtaLink) ? { primary_cta_link: storyblokLink(extracted?.primaryCtaLink) } : {}),
      secondary_cta_text: pickText(extracted?.secondaryCtaText),
      ...(storyblokLink(extracted?.secondaryCtaLink) ? { secondary_cta_link: storyblokLink(extracted?.secondaryCtaLink) } : {}),
      card_tag: pickText(extracted?.cardTag),
      card_live_label: pickText(extracted?.cardLiveLabel),
      card_title: pickText(extracted?.cardTitle),
      card_meta: pickText(extracted?.cardMeta),
      ...(ticks ? { ticks } : {}),
      ...(cardRows ? { card_rows: cardRows } : {}),
    });
  }

  if (section.component === 'contact_page_section') {
    const infoItems = extracted?.contactInfoItems.length
      ? extracted.contactInfoItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
          ...(storyblokLink(item.link) ? { icon_key: 'mail' } : {}),
        }))
      : undefined;
    const hoursRows = extracted?.supportHoursRows.length
      ? extracted.supportHoursRows.map(row => ({
          _uid: uid(),
          component: 'support_hours_row',
          day: row.day,
          hours: row.hours,
        }))
      : undefined;
    const socials = extracted?.socials.length
      ? extracted.socials.map(item => ({
          _uid: uid(),
          component: 'footer_social',
          label: item.label,
          ...(storyblokLink(item.link) ? { link: storyblokLink(item.link) } : {}),
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      form: [{
        _uid: uid(),
        component: 'contact_form',
        form_title: pickText(extracted?.headingPrefix, 'Send us a message'),
        submit_text: pickText(extracted?.ctaText, 'Send message'),
        thank_you_title: 'Message sent!',
        thank_you_description: 'Thank you for reaching out. We will be in touch within 1 working day.',
      }],
      sidebar: infoItems || hoursRows || socials
        ? [{
            _uid: uid(),
            component: 'contact_info_sidebar',
            info_heading: pickText(extracted?.contactInfoHeading, 'Contact information'),
            ...(infoItems ? { info_items: infoItems } : {}),
            hours_heading: pickText(extracted?.supportHoursHeading),
            ...(hoursRows ? { hours_rows: hoursRows } : {}),
            hours_note: pickText(extracted?.supportHoursNote),
            socials_heading: pickText(extracted?.socialsHeading),
            ...(socials ? { socials } : {}),
          }]
        : [],
    });
  }

  if (section.component === 'legal_hero') {
    const metaItems = extracted?.legalMetaItems.length
      ? extracted.legalMetaItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;
    const tabs = extracted?.legalTabs.length
      ? extracted.legalTabs.map(tab => ({
          _uid: uid(),
          component: 'legal_tab',
          label: tab.label,
          ...(storyblokLink(tab.link) ? { link: storyblokLink(tab.link) } : {}),
          active: tab.active,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      eyebrow: pickText(extracted?.eyebrow, 'Legal'),
      heading: pickText(extracted?.headingPrefix, section.sampleHeading, scraped.title),
      lead: pickText(extracted?.lead, section.sampleDescription, scraped.metaDescription),
      ...(metaItems ? { meta_items: metaItems } : {}),
      ...(tabs ? { tabs } : {}),
    });
  }

  if (section.component === 'legal_article') {
    const introCalloutItems = extracted?.labeledItems.length
      ? extracted.labeledItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
          subtitle: item.subtitle,
        }))
      : undefined;
    const tocItems = extracted?.legalTocItems.length
      ? extracted.legalTocItems.map(item => ({
          _uid: uid(),
          component: 'legal_toc_item',
          label: item.label,
          anchor_id: item.anchorId,
          number: item.number,
        }))
      : undefined;

    return sanitizeBlokForStoryblok({
      ...base,
      toc_title: pickText(extracted?.legalTocTitle, 'On this page'),
      toc_download_label: pickText(extracted?.legalTocDownloadLabel),
      ...(storyblokLink(extracted?.legalTocDownloadLink) ? { toc_download_link: storyblokLink(extracted?.legalTocDownloadLink) } : {}),
      intro: pickText(extracted?.lead, extracted?.body, section.sampleDescription),
      intro_html: pickText(extracted?.introHtml),
      intro_callout_heading: pickText(extracted?.legalCalloutHeading, 'The short version'),
      ...(introCalloutItems ? { intro_callout_items: introCalloutItems } : {}),
      ...(tocItems ? { toc_items: tocItems } : {}),
    });
  }

  if (section.component === 'legal_section') {
    const checklistItems = extracted?.checklistItems.length
      ? extracted.checklistItems.map(item => ({
          _uid: uid(),
          component: 'labeled_icon_item',
          title: item.title,
        }))
      : undefined;
    const tableRows = extracted?.tableRows.length
      ? extracted.tableRows.map(row => ({
          _uid: uid(),
          component: 'legal_table_row',
          col_a: row.colA,
          col_b: row.colB,
        }))
      : undefined;
    const contact = extracted?.contactCta;

    return sanitizeBlokForStoryblok({
      ...base,
      anchor_id: pickText(extracted?.anchorId, section.key),
      number: pickText(extracted?.legalSectionNumber),
      heading: pickText(extracted?.legalSectionHeading, section.sampleHeading),
      body: pickText(extracted?.body, section.sampleDescription),
      bullets: extracted?.bullets?.length ? extracted.bullets.join('\n') : undefined,
      checklist_heading: pickText(extracted?.checklistHeading),
      ...(checklistItems ? { checklist_items: checklistItems } : {}),
      ...(tableRows ? { table_rows: tableRows } : {}),
      ...(contact?.heading ? {
        contact_cta_eyebrow: contact.eyebrow,
        contact_cta_heading: contact.heading,
        contact_cta_body: contact.body,
        contact_cta_email: contact.email,
        contact_cta_primary_text: stripTags(contact.primaryText),
        contact_cta_secondary_text: stripTags(contact.secondaryText),
        ...(storyblokLink(contact.secondaryLink) ? { contact_cta_secondary_link: storyblokLink(contact.secondaryLink) } : {}),
      } : {}),
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
