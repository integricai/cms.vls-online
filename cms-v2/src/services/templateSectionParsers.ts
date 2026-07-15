import type { ScrapedTemplateSection } from '../../shared/migrationTypes';

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"');
}

export function stripTemplateTags(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function firstMatch(html: string, pattern: RegExp): string {
  const match = html.match(pattern);
  return match ? stripTemplateTags(match[1]) : '';
}

function allMatches(html: string, pattern: RegExp): RegExpMatchArray[] {
  return [...html.matchAll(pattern)];
}

export function parseLabeledItems(sectionHtml: string, itemClass: string): ScrapedTemplateSection['labeledItems'] {
  const pattern = new RegExp(
    `<div class="${itemClass}"[^>]*>[\\s\\S]*?<span class="t"[^>]*>([\\s\\S]*?)<\\/span>(?:<br>\\s*<span class="s"[^>]*>([\\s\\S]*?)<\\/span>)?`,
    'gi',
  );
  return allMatches(sectionHtml, pattern)
    .map(match => ({
      title: stripTemplateTags(match[1]),
      subtitle: match[2] ? stripTemplateTags(match[2]) : '',
    }))
    .filter(item => item.title);
}

export function parseHeroTicks(sectionHtml: string): ScrapedTemplateSection['labeledItems'] {
  return allMatches(sectionHtml, /<div class="ht"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({ title: stripTemplateTags(match[1].replace(/<span class="chk"[\s\S]*?<\/span>/i, '')), subtitle: '' }))
    .filter(item => item.title);
}

export function parseTeamProfiles(sectionHtml: string): ScrapedTemplateSection['profiles'] {
  return allMatches(sectionHtml, /<div class="profile"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="profile"|<!--\s*TEMPLATE NOTE|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const name = firstMatch(block, /<div class="prof-name"[^>]*>([\s\S]*?)<\/div>/i)
        || firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const role = firstMatch(block, /<div class="prof-role"[^>]*>([\s\S]*?)<\/div>/i);
      const initials = firstMatch(block, /<div class="prof-photo"[^>]*>([\s\S]*?)<\/div>/i);
      const bio = allMatches(block, /<div class="prof-body"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
        .map(m => stripTemplateTags(m[1]))
        .filter(Boolean)
        .join('\n\n');
      const tags = allMatches(block, /<span class="tag"[^>]*>([\s\S]*?)<\/span>/gi)
        .map(m => stripTemplateTags(m[1]))
        .join(', ');
      const logosNote = stripTemplateTags(block.match(/<p class="prof-logos"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
      const stats = allMatches(block, /<div class="ps"[^>]*>[\s\S]*?<span class="v"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="k"[^>]*>([\s\S]*?)<\/span>/gi)
        .map(m => ({ value: stripTemplateTags(m[1]), label: stripTemplateTags(m[2]) }))
        .filter(item => item.value || item.label);
      return { name, role, initials, bio, tags, logosNote, stats };
    })
    .filter(item => item.name || item.bio);
}

export function parseTutorCard(sectionHtml: string): ScrapedTemplateSection['profiles'] {
  const block = sectionHtml.match(/<div class="tutor-card"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!block) return [];
  const name = firstMatch(block, /<div class="tname"[^>]*>([\s\S]*?)<\/div>/i);
  const role = firstMatch(block, /<div class="trole"[^>]*>([\s\S]*?)<\/div>/i);
  const initials = firstMatch(block, /<div class="big-avatar"[^>]*>([\s\S]*?)<\/div>/i);
  const bio = allMatches(block, /<p class="tbio"[^>]*>([\s\S]*?)<\/p>/gi)
    .map(m => stripTemplateTags(m[1]))
    .join('\n\n');
  return name || bio ? [{ name, role, initials, bio, tags: '', logosNote: '', stats: [] }] : [];
}

export function parseStepCards(sectionHtml: string): ScrapedTemplateSection['steps'] {
  return allMatches(sectionHtml, /<div class="step"[^>]*>[\s\S]*?<span class="num"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => ({
      number: stripTemplateTags(match[1]),
      title: stripTemplateTags(match[2]),
      description: stripTemplateTags(match[3]),
    }))
    .filter(item => item.title);
}

export function parseLiveSessions(sectionHtml: string): ScrapedTemplateSection['sessions'] {
  return allMatches(sectionHtml, /<div class="sess"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="sess"|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const track = /sess-bar strategic|class="strat"/i.test(block) ? 'strategic' : 'skills';
      const tag = firstMatch(block, /<span class="sess-tag[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const mode = firstMatch(block, /<span class="sess-mode"[^>]*>([\s\S]*?)<\/span>/i);
      const title = firstMatch(block, /<h3 class="sess-title"[^>]*>([\s\S]*?)<\/h3>/i);
      const tutors = stripTemplateTags(block.match(/<p class="sess-tutor"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '').replace(/^Tutors?:\s*/i, '');
      const rows = allMatches(block, /<div class="sr[^"]*"[^>]*>([\s\S]*?)<\/div>/gi).map(m => stripTemplateTags(m[1]));
      const courseLink = block.match(/<a class="sess-link"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '';
      return {
        tag,
        mode,
        title,
        tutors,
        scheduleLine: rows[0] ?? '',
        timeLine: rows[1] ?? '',
        extrasLine: rows[2] ?? '',
        mockChip: firstMatch(block, /<span class="mock-chip"[^>]*>([\s\S]*?)<\/span>/i),
        courseLink,
        track,
      };
    })
    .filter(item => item.title);
}

export function parseLiveSessionRows(sectionHtml: string): ScrapedTemplateSection['liveSessionRows'] {
  return allMatches(sectionHtml, /<tbody>[\s\S]*?<\/tbody>/gi)
    .flatMap(tbodyMatch => allMatches(tbodyMatch[0], /<tr>([\s\S]*?)<\/tr>/gi))
    .map(match => {
      const row = match[1];
      const paperCode = firstMatch(row, /<span class="p-code[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const paperName = firstMatch(row, /<div class="p-name"[^>]*>([\s\S]*?)<\/div>/i);
      const tutors = firstMatch(row, /<div class="p-tutor"[^>]*>([\s\S]*?)<\/div>/i);
      const track = /strategic|strat/i.test(row) ? 'strategic' : 'skills';
      const formatLabel = firstMatch(row, /<span class="fmt[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const dateCells = allMatches(row, /<td class="dt"[^>]*>([\s\S]*?)<\/td>/gi).map(m => stripTemplateTags(m[1]));
      const liveParts = row.match(/<td class="dt"[^>]*>[\s\S]*?<b>([\s\S]*?)<\/b>[\s\S]*?<span>([\s\S]*?)<\/span>/i);
      return {
        paperCode,
        paperName,
        tutors,
        track,
        formatLabel,
        startDate: dateCells[0] ?? '',
        liveDay: liveParts ? stripTemplateTags(liveParts[1]) : '',
        liveTime: liveParts ? stripTemplateTags(liveParts[2]) : '',
        endDate: dateCells[1] ?? '',
        mockLabel: firstMatch(row, /<span class="mock"[^>]*>([\s\S]*?)<\/span>/i),
        courseLink: row.match(/<a class="see"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
      };
    })
    .filter(item => item.paperName);
}

export function parseQualificationLevels(sectionHtml: string): ScrapedTemplateSection['levels'] {
  return allMatches(sectionHtml, /<div class="level"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="level"|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const tone = block.includes('level-bar l3') ? 'l3' : block.includes('level-bar l2') ? 'l2' : 'l1';
      const number = firstMatch(block, /<span class="level-num[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const title = firstMatch(block, /<span class="level-title"[^>]*>([\s\S]*?)<\/span>/i);
      const requirement = firstMatch(block, /<span class="level-req"[^>]*>([\s\S]*?)<\/span>/i);
      const papers = allMatches(block, /<div class="paper"[^>]*>[\s\S]*?<span class="code[^"]*"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="name"[^>]*>([\s\S]*?)<\/span>/gi)
        .map(m => ({ code: stripTemplateTags(m[1]), name: stripTemplateTags(m[2]) }))
        .filter(item => item.code || item.name);
      return { number, title, requirement, tone, papers };
    })
    .filter(item => item.title);
}

export function parseLegalMetaItems(sectionHtml: string): ScrapedTemplateSection['legalMetaItems'] {
  return allMatches(sectionHtml, /<span class="meta-item"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => {
      const text = stripTemplateTags(match[1]);
      const bold = stripTemplateTags(match[1].match(/<b[^>]*>([\s\S]*?)<\/b>/i)?.[1] ?? '');
      return { title: text, subtitle: bold };
    })
    .filter(item => item.title);
}

export function parseLegalTabs(sectionHtml: string): ScrapedTemplateSection['legalTabs'] {
  return allMatches(sectionHtml, /<a[^>]*href=["']([^"']*)["'][^>]*class="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => ({
      label: stripTemplateTags(match[3]),
      link: match[1],
      active: match[2].includes('active'),
    }))
    .filter(item => item.label);
}

export function parseLegalTocItems(layoutHtml: string): ScrapedTemplateSection['legalTocItems'] {
  return allMatches(layoutHtml, /<li><a[^>]+href=["']#([^"']+)["'][^>]*>[\s\S]*?<span class="n">([\s\S]*?)<\/span>\s*([\s\S]*?)<\/a><\/li>/gi)
    .map(match => ({
      anchorId: stripTemplateTags(match[1]),
      number: stripTemplateTags(match[2]),
      label: stripTemplateTags(match[3]),
    }))
    .filter(item => item.label);
}

export function parseLegalArticleBlock(layoutHtml: string): Partial<ScrapedTemplateSection> {
  const intro = stripTemplateTags(layoutHtml.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '');
  const calloutHeading = firstMatch(layoutHtml, /<div class="callout-h"[^>]*>[\s\S]*?<\/svg>\s*([\s\S]*?)<\/div>/i);
  const calloutItems = allMatches(layoutHtml, /<div class="callout"[^>]*>[\s\S]*?<li>[\s\S]*?<\/span>\s*([\s\S]*?)<\/li>/gi)
    .map(match => ({ title: stripTemplateTags(match[1]), subtitle: '' }));
  const tocTitle = firstMatch(layoutHtml, /<div class="toc-title"[^>]*>([\s\S]*?)<\/div>/i) || 'On this page';
  const downloadLabel = firstMatch(layoutHtml, /<div class="copy-card"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const downloadLink = layoutHtml.match(/<div class="copy-card"[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? '';

  return {
    lead: intro,
    body: intro,
    legalCalloutHeading: calloutHeading,
    labeledItems: calloutItems,
    legalTocTitle: tocTitle,
    legalTocDownloadLabel: downloadLabel,
    legalTocDownloadLink: downloadLink,
    legalTocItems: parseLegalTocItems(layoutHtml),
  };
}

export function parseLegalSectionBlock(sectionHtml: string, anchorId = ''): Partial<ScrapedTemplateSection> {
  const number = firstMatch(sectionHtml, /<span class="num"[^>]*>([\s\S]*?)<\/span>/i);
  const heading = firstMatch(sectionHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const paragraphs = allMatches(sectionHtml, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(text => text && !/^(Get in touch|Questions about)/i.test(text));
  const checklistHeading = firstMatch(sectionHtml, /<div class="rights-box"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const checklistItems = allMatches(sectionHtml, /<div class="rights-grid"[^>]*>[\s\S]*?<div>[\s\S]*?<\/span>\s*([\s\S]*?)<\/div>/gi)
    .map(match => ({ title: stripTemplateTags(match[1]) }))
    .filter(item => item.title);
  const tableRows = allMatches(sectionHtml, /<tr>[\s\S]*?<td class="cat"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi)
    .map(match => ({ colA: stripTemplateTags(match[1]), colB: stripTemplateTags(match[2]) }))
    .filter(item => item.colA || item.colB);

  return {
    legalSectionNumber: number,
    legalSectionHeading: heading,
    body: paragraphs.join('\n\n'),
    checklistHeading,
    checklistItems,
    tableRows,
    headingPrefix: heading,
    anchorId,
  };
}

export function parseBookMeetingHero(sectionHtml: string): Partial<ScrapedTemplateSection> {
  return {
    freePill: firstMatch(sectionHtml, /<span class="free-pill"[^>]*>[\s\S]*?<\/span>\s*([^<]+)/i)
      || firstMatch(sectionHtml, /<span class="free-pill"[^>]*>([\s\S]*?)<\/span>/i),
    labeledItems: parseLabeledItems(sectionHtml, 'bn'),
    legalMetaItems: allMatches(sectionHtml, /<div class="meet-meta"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/gi)
      .map(match => ({ title: stripTemplateTags(match[1]), subtitle: '' }))
      .filter(item => item.title),
    schedulerTitle: firstMatch(sectionHtml, /<div class="book-card"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i),
    schedulerSubtitle: firstMatch(sectionHtml, /<div class="book-card"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i),
    schedulerPlaceholderHeading: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i),
    schedulerPlaceholderText: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i),
    schedulerCtaText: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i),
    schedulerCtaLink: sectionHtml.match(/<div class="scheduler-placeholder"[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
  };
}

export function parseLiveSessionsHero(sectionHtml: string): Partial<ScrapedTemplateSection> {
  return {
    freePill: firstMatch(sectionHtml, /<span class="free-pill"[^>]*>([\s\S]*?)<\/span>/i),
    labeledItems: parseHeroTicks(sectionHtml),
    primaryCtaLink: sectionHtml.match(/<div class="hero-cta"[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
    secondaryCtaText: firstMatch(sectionHtml, /<a class="btn btn-ghost"[^>]*>([\s\S]*?)<\/a>/i),
    secondaryCtaLink: sectionHtml.match(/<a class="btn btn-ghost"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
    cardTag: firstMatch(sectionHtml, /<span class="lc-tag"[^>]*>([\s\S]*?)<\/span>/i),
    cardLiveLabel: firstMatch(sectionHtml, /<span class="lc-live"[^>]*>([\s\S]*?)<\/span>/i),
    cardTitle: firstMatch(sectionHtml, /<h3 class="lc-title"[^>]*>([\s\S]*?)<\/h3>/i),
    cardMeta: firstMatch(sectionHtml, /<p class="lc-meta"[^>]*>([\s\S]*?)<\/p>/i),
    cardRows: parseLabeledItems(sectionHtml, 'lc-row'),
  };
}

export function parseContactPageSection(sectionHtml: string): Partial<ScrapedTemplateSection> {
  const sidebar = sectionHtml.match(/<aside class="side"[^>]*>([\s\S]*?)<\/aside>/i)?.[1] ?? '';
  const infoItems = allMatches(sidebar, /<div class="ci"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="ci"|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const link = block.match(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      return {
        title: link ? stripTemplateTags(link[2]) : firstMatch(block, /<span class="t"[^>]*>([\s\S]*?)<\/span>/i),
        subtitle: firstMatch(block, /<span class="s"[^>]*>([\s\S]*?)<\/span>/i),
        link: link?.[1] ?? '',
      };
    })
    .filter(item => item.title);
  const hoursRows = allMatches(sidebar, /<div class="hrow"[^>]*>[\s\S]*?<span class="d"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="h"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({ day: stripTemplateTags(match[1]), hours: stripTemplateTags(match[2]) }))
    .filter(item => item.day);
  const socials = allMatches(sidebar, /<a class="soc"[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?<span class="n"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({ label: stripTemplateTags(match[2]), link: match[1] }));

  return {
    contactInfoHeading: firstMatch(sidebar, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
    contactInfoItems: infoItems,
    supportHoursHeading: firstMatch(sidebar, /<h4[^>]*>([\s\S]*?)<\/h4>/i),
    supportHoursRows: hoursRows,
    supportHoursNote: firstMatch(sidebar, /<p class="hours-note"[^>]*>([\s\S]*?)<\/p>/i),
    socialsHeading: firstMatch(sidebar, /<div class="socials"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i),
    socials,
  };
}

export function emptyTemplateSectionFields(): Pick<
  ScrapedTemplateSection,
  | 'profiles' | 'steps' | 'sessions' | 'liveSessionRows' | 'levels' | 'labeledItems'
  | 'legalTabs' | 'legalMetaItems' | 'legalTocItems' | 'legalCalloutHeading' | 'legalTocTitle'
  | 'legalTocDownloadLabel' | 'legalTocDownloadLink' | 'legalSectionNumber' | 'legalSectionHeading'
  | 'checklistHeading' | 'checklistItems' | 'tableRows' | 'schedulerTag' | 'schedulerTitle'
  | 'schedulerSubtitle' | 'schedulerPlaceholderHeading' | 'schedulerPlaceholderText' | 'schedulerCtaText'
  | 'schedulerCtaLink' | 'cardTag' | 'cardLiveLabel' | 'cardTitle' | 'cardMeta' | 'cardRows'
  | 'noteHeading' | 'noteText' | 'freePill' | 'primaryCtaLink' | 'secondaryCtaText' | 'secondaryCtaLink'
  | 'contactInfoHeading' | 'contactInfoItems' | 'supportHoursHeading' | 'supportHoursRows'
  | 'supportHoursNote' | 'socialsHeading' | 'socials' | 'anchorId'
> {
  return {
    profiles: [],
    steps: [],
    sessions: [],
    liveSessionRows: [],
    levels: [],
    labeledItems: [],
    legalTabs: [],
    legalMetaItems: [],
    legalTocItems: [],
    legalCalloutHeading: '',
    legalTocTitle: '',
    legalTocDownloadLabel: '',
    legalTocDownloadLink: '',
    legalSectionNumber: '',
    legalSectionHeading: '',
    checklistHeading: '',
    checklistItems: [],
    tableRows: [],
    schedulerTag: '',
    schedulerTitle: '',
    schedulerSubtitle: '',
    schedulerPlaceholderHeading: '',
    schedulerPlaceholderText: '',
    schedulerCtaText: '',
    schedulerCtaLink: '',
    cardTag: '',
    cardLiveLabel: '',
    cardTitle: '',
    cardMeta: '',
    cardRows: [],
    noteHeading: '',
    noteText: '',
    freePill: '',
    primaryCtaLink: '',
    secondaryCtaText: '',
    secondaryCtaLink: '',
    contactInfoHeading: '',
    contactInfoItems: [],
    supportHoursHeading: '',
    supportHoursRows: [],
    supportHoursNote: '',
    socialsHeading: '',
    socials: [],
    anchorId: '',
  };
}
