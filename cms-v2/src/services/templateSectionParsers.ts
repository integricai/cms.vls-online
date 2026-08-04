import type { ScrapedFaqItem, ScrapedTemplateSection } from '../../shared/migrationTypes';

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

function teamInitials(name: string): string {
  if (!name) return '';
  return name.trim().split(/\s+/).map(word => word[0] || '').join('').toUpperCase().slice(0, 2);
}

export function parseLegacyTeamCards(sectionHtml: string): ScrapedTemplateSection['profiles'] {
  const uidMatch = sectionHtml.match(/class="(vlsteam[a-z0-9]+)"/i);
  const uid = uidMatch?.[1];
  if (!uid) return [];

  const cardPattern = new RegExp(
    `<div class="${uid}-card">([\\s\\S]*?)</div>\\s*</div>\\s*(?=<div class="${uid}-card"|</div>\\s*<style)`,
    'gi',
  );

  return allMatches(sectionHtml, cardPattern)
    .map(match => {
      const block = match[1] ?? match[0];
      const name = firstMatch(block, new RegExp(`class="${uid}-name"[^>]*>([\\s\\S]*?)<\\/h3>`, 'i'))
        || firstMatch(block, new RegExp(`class="${uid}-name"[^>]*>([\\s\\S]*?)<\\/`, 'i'));
      const role = firstMatch(block, new RegExp(`class="${uid}-role"[^>]*>([\\s\\S]*?)<\\/p>`, 'i'));
      const photoUrl = block.match(new RegExp(`class="${uid}-photo"[^>]*src="([^"]+)"`, 'i'))?.[1]?.trim() ?? '';
      const initials = firstMatch(block, new RegExp(`class="${uid}-initials"[^>]*>[\\s\\S]*?<span>([\\s\\S]*?)<\\/span>`, 'i'))
        || teamInitials(name);
      const bio = allMatches(block, new RegExp(`class="${uid}-para"[^>]*>([\\s\\S]*?)<\\/p>`, 'gi'))
        .map(item => stripTemplateTags(item[1]))
        .filter(Boolean)
        .join('\n\n');
      const tags = allMatches(block, new RegExp(`class="${uid}-tag"[^>]*>([\\s\\S]*?)<\\/span>`, 'gi'))
        .map(item => stripTemplateTags(item[1]))
        .join(', ');
      const stats = allMatches(
        block,
        new RegExp(
          `class="${uid}-feat"[^>]*>[\\s\\S]*?class="${uid}-fv"[^>]*>([\\s\\S]*?)<\\/div>[\\s\\S]*?class="${uid}-fl"[^>]*>([\\s\\S]*?)<\\/div>`,
          'gi',
        ),
      )
        .map(item => ({ value: stripTemplateTags(item[1]), label: stripTemplateTags(item[2]) }))
        .filter(item => item.value || item.label);

      return {
        name,
        role,
        initials,
        photoUrl,
        bio,
        tags,
        logosNote: '',
        stats,
      };
    })
    .filter(item => item.name || item.bio || item.photoUrl);
}

export function parseTeamProfiles(sectionHtml: string): ScrapedTemplateSection['profiles'] {
  return allMatches(sectionHtml, /<div class="profile"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="profile"|<!--\s*TEMPLATE NOTE|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const name = firstMatch(block, /<div class="prof-name"[^>]*>([\s\S]*?)<\/div>/i)
        || firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const role = firstMatch(block, /<div class="prof-role"[^>]*>([\s\S]*?)<\/div>/i);
      const photoBlock = block.match(/<div class="prof-photo"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
      const photoUrl = photoBlock.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1]?.trim() ?? '';
      const initials = photoUrl
        ? ''
        : stripTemplateTags(photoBlock);
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
      return { name, role, initials, photoUrl, bio, tags, logosNote, stats };
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

function inferStepIconKey(title: string, index: number): string {
  const normalized = title.toLowerCase();
  if (normalized.includes('time') || normalized.includes('pick') || normalized.includes('calendar') || normalized.includes('book')) {
    return 'calendar';
  }
  if (normalized.includes('meet') || normalized.includes('tutor') || normalized.includes('call') || normalized.includes('video')) {
    return 'video';
  }
  if (normalized.includes('start') || normalized.includes('confidence') || normalized.includes('plan') || normalized.includes('enrol')) {
    return 'check';
  }
  return ['calendar', 'video', 'check'][index] || 'checklist';
}

export function parseStepCards(sectionHtml: string): ScrapedTemplateSection['steps'] {
  const legacy = allMatches(
    sectionHtml,
    /<div class="step"[^>]*>[\s\S]*?<span class="num"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
  ).map((match, index) => ({
    number: stripTemplateTags(match[1]),
    title: stripTemplateTags(match[2]),
    description: stripTemplateTags(match[3]),
    iconKey: inferStepIconKey(stripTemplateTags(match[2]), index),
  }));

  const pageContent = allMatches(
    sectionHtml,
    /<div class="step-card"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi,
  ).map((match, index) => {
    const heading = stripTemplateTags(match[1]);
    const numberMatch = heading.match(/^(\d+)\.\s*(.*)$/);
    const number = numberMatch?.[1] ?? String(index + 1).padStart(2, '0');
    const title = numberMatch?.[2] ?? heading;
    return {
      number,
      title,
      description: stripTemplateTags(match[2]),
      iconKey: inferStepIconKey(title, index),
    };
  });

  return [...legacy, ...pageContent].filter(item => item.title);
}

function inferFactIconKey(title: string, index: number): string {
  const normalized = title.toLowerCase();
  if (normalized.includes('minute') || normalized.includes('hour') || normalized.includes('duration')) return 'clock';
  if (normalized.includes('video') || normalized.includes('online') || normalized.includes('call')) return 'video';
  if (normalized.includes('obligation') || normalized.includes('global') || normalized.includes('world')) return 'globe';
  return ['clock', 'video', 'globe'][index] || 'check';
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

export function parseSnapCard(sectionHtml: string): ScrapedTemplateSection['sideCard'] {
  const cardMatch = sectionHtml.match(/<div class="snap-card"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>\s*<\/div>|$)/i);
  if (!cardMatch) return null;
  const block = cardMatch[1] ?? cardMatch[0];
  const rows = allMatches(block, /<div class="snap-row"[^>]*>[\s\S]*?<span class="n"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="t"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="s"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({
      number: stripTemplateTags(match[1]),
      title: stripTemplateTags(match[2]),
      subtitle: stripTemplateTags(match[3]),
    }))
    .filter(item => item.title);
  return {
    tag: firstMatch(block, /<span class="sc-tag"[^>]*>([\s\S]*?)<\/span>/i),
    title: firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
    quote: '',
    authorName: '',
    authorRole: '',
    footerLabel: stripTemplateTags(block.match(/<span class="k"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '').replace(/<br\s*\/?>/gi, '\n'),
    footerValue: firstMatch(block, /<span class="v"[^>]*>([\s\S]*?)<\/span>/i),
    rows,
  };
}

export function parseTrustPills(sectionHtml: string): ScrapedTemplateSection['heroItems'] {
  return allMatches(sectionHtml, /<span class="trust-pill"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({
      text: stripTemplateTags(match[1].replace(/<svg[\s\S]*?<\/svg>/gi, '')),
    }))
    .filter(item => item.text);
}

export function parseCareerCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="career"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/gi)
    .map(match => ({ title: stripTemplateTags(match[1]), description: '' }))
    .filter(item => item.title);
}

export function parseIndustryCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="ind"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => ({
      title: stripTemplateTags(match[1]),
      description: stripTemplateTags(match[2]),
    }))
    .filter(item => item.title);
}

export function parseRequirementCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="req([^"]*)"[^>]*>[\s\S]*?<span class="t"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="s"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({
      title: stripTemplateTags(match[2]),
      description: stripTemplateTags(match[3]),
      isTip: match[1].includes('tip'),
    }))
    .filter(item => item.title);
}

export function parseDuoCards(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="duo-card"[^>]*>([\s\S]*?)<\/div>\s*(?=<div class="duo-card"|<\/div>\s*<\/div>|$)/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      return {
        title: firstMatch(block, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
        description: firstMatch(block, /<p[^>]*>([\s\S]*?)<\/p>/i),
        figureValue: firstMatch(block, /<span class="v"[^>]*>([\s\S]*?)<\/span>/i),
        figureLabel: stripTemplateTags(block.match(/<span class="k"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '').replace(/<br\s*\/?>/gi, '\n'),
      };
    })
    .filter(item => item.title);
}

export function parseQualificationLevels(sectionHtml: string): ScrapedTemplateSection['levels'] {
  return sectionHtml.split(/<div class="level">/i).slice(1)
    .map(part => {
      const block = part;
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
  return allMatches(sectionHtml, /<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => ({
      label: stripTemplateTags(match[2]),
      link: match[1],
      active: /class="[^"]*active/.test(match[0]),
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

function sanitizeIntroHtml(html: string): string {
  return html
    .replace(/<(?!\/?(a)\b)[^>]+>/gi, '')
    .replace(/<a(?![^>]*class=)/gi, '<a class="inline-link"')
    .trim();
}

export function parseLegalArticleBlock(layoutHtml: string): Partial<ScrapedTemplateSection> {
  const introRaw = layoutHtml.match(/<p class="intro"[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? '';
  const introHtml = sanitizeIntroHtml(introRaw);
  const intro = stripTemplateTags(introRaw);
  const calloutHeading = firstMatch(layoutHtml, /<div class="callout-h"[^>]*>[\s\S]*?<\/svg>\s*([\s\S]*?)<\/div>/i);
  const calloutItems = allMatches(layoutHtml, /<div class="callout"[^>]*>[\s\S]*?<li>[\s\S]*?<\/span>\s*([\s\S]*?)<\/li>/gi)
    .map(match => ({ title: stripTemplateTags(match[1]), subtitle: '' }));
  const tocTitle = firstMatch(layoutHtml, /<div class="toc-title"[^>]*>([\s\S]*?)<\/div>/i) || 'On this page';
  const copyCard = layoutHtml.match(/<div class="copy-card"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const downloadLabel = firstMatch(copyCard, /<a[^>]*>([\s\S]*?)<\/a>/i) || 'Download PDF';
  const downloadLink = copyCard.match(/<a[^>]+href=["']([^"']+)["']/i)?.[1] ?? '';

  return {
    lead: intro,
    body: intro,
    introHtml,
    legalCalloutHeading: calloutHeading,
    labeledItems: calloutItems,
    legalTocTitle: tocTitle,
    legalTocDownloadLabel: stripTemplateTags(downloadLabel),
    legalTocDownloadLink: downloadLink,
    legalTocItems: parseLegalTocItems(layoutHtml),
  };
}

function sanitizeLegalParagraph(html: string): string {
  return html
    .replace(/<(?!\/?(strong|a)\b)[^>]+>/gi, '')
    .replace(/<a(?![^>]*class=)/gi, '<a class="inline-link"')
    .trim();
}

export function parseLegalSectionBlock(sectionHtml: string, anchorId = ''): Partial<ScrapedTemplateSection> {
  const number = firstMatch(sectionHtml, /<span class="num"[^>]*>([\s\S]*?)<\/span>/i);
  const heading = firstMatch(sectionHtml, /<div class="sec-h"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)
    || firstMatch(sectionHtml, /<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const paragraphs = allMatches(sectionHtml, /<p[^>]*>([\s\S]*?)<\/p>/gi)
    .map(match => sanitizeLegalParagraph(match[1]))
    .filter(text => text && !/^(Get in touch|Questions about)/i.test(stripTemplateTags(text)));
  const bulletsBlock = sectionHtml.match(/<ul class="bullets"[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const bullets = allMatches(bulletsBlock, /<li[^>]*>([\s\S]*?)<\/li>/gi)
    .map(match => stripTemplateTags(match[1]))
    .filter(Boolean);
  const checklistHeading = firstMatch(sectionHtml, /<div class="rights-box"[^>]*>[\s\S]*?<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const rightsGridStart = sectionHtml.indexOf('<div class="rights-grid"');
  const checklistItems = rightsGridStart >= 0
    ? allMatches(sectionHtml.slice(rightsGridStart), /<div><span class="ck">[\s\S]*?<\/span>\s*([^<]+)/gi)
        .map(match => ({ title: stripTemplateTags(match[1]) }))
        .filter(item => item.title)
    : [];
  const tableRows = allMatches(sectionHtml, /<tr>[\s\S]*?<td class="cat"[^>]*>([\s\S]*?)<\/td>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi)
    .map(match => ({ colA: stripTemplateTags(match[1]), colB: stripTemplateTags(match[2]) }))
    .filter(item => item.colA || item.colB);
  const contactBlock = sectionHtml.match(/<div class="contact-cta"[^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const contactCta = contactBlock
    ? {
        eyebrow: firstMatch(contactBlock, /<div class="eyebrow"[^>]*>([\s\S]*?)<\/div>/i),
        heading: firstMatch(contactBlock, /<h3[^>]*>([\s\S]*?)<\/h3>/i),
        body: firstMatch(contactBlock, /<p[^>]*>([\s\S]*?)<\/p>/i),
        email: contactBlock.match(/href=["']mailto:([^"']+)["']/i)?.[1] ?? '',
        primaryText: firstMatch(contactBlock, /<a[^>]*class="[^"]*btn-primary[^"]*"[^>]*>([\s\S]*?)<\/a>/i),
        secondaryText: firstMatch(contactBlock, /<a[^>]*class="[^"]*btn-outline-blue[^"]*"[^>]*>([\s\S]*?)<\/a>/i),
        secondaryLink: contactBlock.match(/<a[^>]*class="[^"]*btn-outline-blue[^"]*"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
      }
    : null;

  return {
    legalSectionNumber: number,
    legalSectionHeading: heading,
    body: paragraphs.join('\n\n'),
    bullets,
    checklistHeading,
    checklistItems,
    tableRows,
    contactCta,
    headingPrefix: heading,
    anchorId,
  };
}

export function parseBookMeetingHero(sectionHtml: string): Partial<ScrapedTemplateSection> {
  const factItems = allMatches(sectionHtml, /<span class="fact"[^>]*>([\s\S]*?)<\/span>/gi)
    .map((match, index) => {
      const title = stripTemplateTags(match[1].replace(/<svg[\s\S]*?<\/svg>/gi, ''));
      return { title, subtitle: '', iconKey: inferFactIconKey(title, index) };
    })
    .filter(item => item.title);

  const meetMetaItems = allMatches(sectionHtml, /<div class="meet-meta"[^>]*>[\s\S]*?<span>([\s\S]*?)<\/span>/gi)
    .map((match, index) => {
      const title = stripTemplateTags(match[1]);
      return { title, subtitle: '', iconKey: inferFactIconKey(title, index) };
    })
    .filter(item => item.title);

  const coverList = sectionHtml.match(/<div class="cover"[^>]*>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i)?.[1] ?? '';
  const coverItems = allMatches(coverList, /<li[^>]*>([\s\S]*?)<\/li>/gi)
    .map(match => ({
      title: stripTemplateTags(match[1].replace(/<span class="ck"[\s\S]*?<\/span>/gi, '')),
      subtitle: '',
      iconKey: 'check',
    }))
    .filter(item => item.title);

  const legacyBenefits = parseLabeledItems(sectionHtml, 'bn').map(item => ({
    ...item,
    iconKey: item.iconKey || 'check',
  }));

  const altBlock = sectionHtml.match(/<div class="alt"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const altCards = allMatches(altBlock, /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => ({
      title: stripTemplateTags(match[2].replace(/<svg[\s\S]*?<\/svg>/gi, '')),
      detail: '',
      linkText: stripTemplateTags(match[2].replace(/<svg[\s\S]*?<\/svg>/gi, '')),
      linkUrl: match[1],
    }))
    .filter(item => item.title && item.linkUrl);

  const hostName = firstMatch(sectionHtml, /<div class="h-name"[^>]*>([\s\S]*?)<\/div>/i);
  const hostRole = firstMatch(sectionHtml, /<div class="h-role"[^>]*>([\s\S]*?)<\/div>/i);
  const hostInitials = firstMatch(sectionHtml, /<span class="h-av"[^>]*>([\s\S]*?)<\/span>/i);

  return {
    freePill: (() => {
      const pillMatch = sectionHtml.match(/<span class="(?:free-)?pill"[^>]*>([\s\S]*?)<\/span>\s*(?=<h1|<p|<\/div|$)/i)
        ?? sectionHtml.match(/<span class="(?:free-)?pill"[^>]*>((?:[^<]|<span[\s\S]*?<\/span>)*)<\/span>/i);
      return stripTemplateTags(pillMatch?.[1] ?? '');
    })(),
    labeledItems: coverItems.length ? coverItems : legacyBenefits,
    legalMetaItems: factItems.length ? factItems : meetMetaItems,
    checklistHeading: firstMatch(sectionHtml, /<div class="cover"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i)
      || 'What we\'ll cover',
    contactCards: altCards,
    sideCard: hostName || hostRole ? {
      tag: '',
      title: '',
      quote: '',
      authorName: hostName,
      authorRole: hostRole,
      authorInitials: hostInitials || 'VLS',
    } : null,
    badges: (() => {
      const trust = firstMatch(sectionHtml, /<div class="trust"[^>]*>([\s\S]*?)<\/div>/i);
      return trust ? [{ title: trust.replace(/★+/g, '').trim(), subtitle: trust.includes('★') ? '★★★★★' : '' }] : [];
    })(),
    schedulerTitle: firstMatch(sectionHtml, /<div class="sched-head"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)
      || firstMatch(sectionHtml, /<div class="book-card"[^>]*>[\s\S]*?<h2[^>]*>([\s\S]*?)<\/h2>/i)
      || 'Pick a date & time',
    schedulerSubtitle: firstMatch(sectionHtml, /<div class="book-card"[^>]*>[\s\S]*?<h2[^>]*>[\s\S]*?<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i)
      || 'Free 30-minute consultation with a Vertex tutor',
    schedulerPlaceholderHeading: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<h3[^>]*>([\s\S]*?)<\/h3>/i)
      || 'Calendar loading',
    schedulerPlaceholderText: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i)
      || 'Paste your Calendly embed URL in Storyblok to show the booking calendar here.',
    schedulerCtaText: firstMatch(sectionHtml, /<div class="scheduler-placeholder"[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i)
      || 'Book your free meeting',
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

export function parseSyllabusRows(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<div class="syl-row"[^>]*>[\s\S]*?<span class="num"[^>]*>([\s\S]*?)<\/span>[\s\S]*?<span class="t"[^>]*>([\s\S]*?)<\/span>(?:<br>\s*<span class="s"[^>]*>([\s\S]*?)<\/span>)?/gi)
    .map(match => ({
      title: stripTemplateTags(match[2]),
      description: match[3] ? stripTemplateTags(match[3]) : '',
      figureValue: stripTemplateTags(match[1]),
      figureLabel: '',
    }))
    .filter(item => item.title);
}

export function parseContentsRows(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<a class="cl-row"[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => {
      const block = match[2] ?? match[0];
      const title = firstMatch(block, /<span class="t"[^>]*>([\s\S]*?)<\/span>/i);
      const description = firstMatch(block, /<span class="s"[^>]*>([\s\S]*?)<\/span>/i);
      const action = firstMatch(block, /<span class="act[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      return {
        title,
        description,
        figureLabel: action,
        figureValue: match[1] ?? '',
      };
    })
    .filter(item => item.title);
}

export function parseRelatedRows(sectionHtml: string): ScrapedTemplateSection['cards'] {
  return allMatches(sectionHtml, /<a class="rel-row"[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)
    .map(match => {
      const block = match[2] ?? match[0];
      const code = firstMatch(block, /<span class="code"[^>]*>([\s\S]*?)<\/span>/i);
      const title = firstMatch(block, /<span class="t"[^>]*>([\s\S]*?)<\/span>/i);
      const description = firstMatch(block, /<span class="s"[^>]*>([\s\S]*?)<\/span>/i);
      return {
        title: code ? `${code} — ${title}` : title,
        description,
        figureValue: match[1] ?? '',
      };
    })
    .filter(item => item.title);
}

export function parseNotesTableGroups(sectionHtml: string): ScrapedTemplateSection['groups'] {
  return sectionHtml.split(/<div class="table-shell">/i).slice(1)
    .map(part => {
      const label = firstMatch(part, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const items = allMatches(part, /<tr[^>]*>([\s\S]*?)<\/tr>/gi)
        .map(match => {
          const row = match[1] ?? match[0];
          if (!row.includes('n-code')) return null;
          const code = firstMatch(row, /<span class="n-code[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
          const title = firstMatch(row, /<span class="n-title"[^>]*>([\s\S]*?)<\/span>/i);
          const pages = stripTemplateTags(row.match(/<td class="n-pages"[^>]*>([\s\S]*?)<\/td>/i)?.[1] ?? '');
          const url = row.match(/<a class="see"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '';
          if (!title) return null;
          return { code, title, description: pages, url };
        })
        .filter((item): item is { code: string; title: string; description: string; url: string } => Boolean(item));
      return { label, items };
    })
    .filter(group => group.label && group.items.length);
}

export function parseCatalogGroups(sectionHtml: string): ScrapedTemplateSection['groups'] {
  return sectionHtml.split(/<div class="group[^"]*"[^>]*>/i).slice(1)
    .map(part => {
      const label = firstMatch(part, /<h3[^>]*>([\s\S]*?)<\/h3>/i);
      const items = allMatches(part, /<a class="row[^"]*"[^>]+href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)
        .map(rowMatch => {
          const rowBlock = rowMatch[2] ?? rowMatch[0];
          const code = firstMatch(rowBlock, /<span class="code"[^>]*>([\s\S]*?)<\/span>/i);
          const title = firstMatch(rowBlock, /<span class="title"[^>]*>([\s\S]*?)<\/span>/i);
          const description = firstMatch(rowBlock, /<span class="meta"[^>]*>([\s\S]*?)<\/span>/i);
          return {
            code,
            title,
            description,
            url: rowMatch[1] ?? '',
          };
        })
        .filter(item => item.title);
      return { label, items };
    })
    .filter(group => group.label && group.items.length);
}

export function parseProofPoints(sectionHtml: string): ScrapedTemplateSection['labeledItems'] {
  return allMatches(sectionHtml, /<div class="pf"[^>]*>([\s\S]*?)<\/div>/gi)
    .map(match => ({
      title: stripTemplateTags(match[1].replace(/<span class="chk"[\s\S]*?<\/span>/gi, '')),
      subtitle: '',
    }))
    .filter(item => item.title);
}

export function parseFaqDetails(sectionHtml: string): ScrapedFaqItem[] {
  return allMatches(sectionHtml, /<details class="qa"[^>]*>([\s\S]*?)<\/details>/gi)
    .map(match => {
      const block = match[1] ?? match[0];
      const question = firstMatch(block, /<summary>([\s\S]*?)<\/summary>/i)
        .replace(/<span class="qa-icon"[\s\S]*?<\/span>/gi, '');
      const answerHtml = block.match(/<div class="qa-body"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
      const answerText = stripTemplateTags(answerHtml);
      return { question: stripTemplateTags(question), answerHtml, answerText };
    })
    .filter(item => item.question);
}

export function parseStudyNotesHeroFields(sectionHtml: string): Partial<ScrapedTemplateSection> {
  const priceBlock = sectionHtml.match(/<div class="price-card"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '';
  const includes = allMatches(priceBlock, /<li[^>]*>([\s\S]*?)<\/li>/gi)
    .map(match => stripTemplateTags(match[1].replace(/<span class="ico"[\s\S]*?<\/span>/gi, '')))
    .filter(Boolean);
  const facts = allMatches(sectionHtml, /<span class="fact"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => stripTemplateTags(match[1].replace(/<svg[\s\S]*?<\/svg>/gi, '')))
    .filter(Boolean);
  const videoUrl = sectionHtml.match(/<a[^>]+href=["'](https?:\/\/player\.vimeo\.com\/[^"']+)["']/i)?.[1]
    ?? sectionHtml.match(/<a[^>]+href=["'](https?:\/\/vimeo\.com\/[^"']+)["']/i)?.[1]
    ?? '';
  const videoTitle = firstMatch(sectionHtml, /<div class="vs-label"[^>]*>[\s\S]*?<div class="t"[^>]*>([\s\S]*?)<\/div>/i);
  const videoSubtitle = firstMatch(sectionHtml, /<div class="vs-label"[^>]*>[\s\S]*?<div class="s"[^>]*>([\s\S]*?)<\/div>/i);

  return {
    eyebrow: firstMatch(sectionHtml, /<span class="level-pill"[^>]*>([\s\S]*?)<\/span>/i),
    priceNow: firstMatch(priceBlock, /<span class="price-now"[^>]*>([\s\S]*?)<\/span>/i),
    priceAccess: stripTemplateTags(priceBlock.match(/<div class="price-access"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? ''),
    priceTag: firstMatch(priceBlock, /<span class="pc-tag"[^>]*>([\s\S]*?)<\/span>/i),
    includesItems: includes,
    bullets: facts,
    videoUrl,
    videoTitle,
    videoSubtitle,
    primaryCtaLink: priceBlock.match(/<a[^>]+class="[^"]*btn-primary[^"]*"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
    secondaryCtaLink: priceBlock.match(/<a[^>]+class="[^"]*btn-ghost[^"]*"[^>]+href=["']([^"']+)["']/i)?.[1] ?? '',
    ctaText: firstMatch(priceBlock, /<a[^>]+class="[^"]*btn-primary[^"]*"[^>]*>([\s\S]*?)<\/a>/i),
    secondaryCtaText: firstMatch(priceBlock, /<a[^>]+class="[^"]*btn-ghost[^"]*"[^>]*>([\s\S]*?)<\/a>/i),
  };
}

export function parseLmsFeatures(sectionHtml: string): ScrapedTemplateSection['labeledItems'] {
  return allMatches(sectionHtml, /<li[^>]*>[\s\S]*?<span class="t"[^>]*>([\s\S]*?)<\/span>(?:<br>\s*<span class="s"[^>]*>([\s\S]*?)<\/span>)?/gi)
    .map(match => ({
      title: stripTemplateTags(match[1]),
      subtitle: match[2] ? stripTemplateTags(match[2]) : '',
    }))
    .filter(item => item.title);
}

export function parseDevicePills(sectionHtml: string): ScrapedTemplateSection['labeledItems'] {
  return allMatches(sectionHtml, /<span class="device-pill"[^>]*>([\s\S]*?)<\/span>/gi)
    .map(match => ({
      title: stripTemplateTags(match[1].replace(/<svg[\s\S]*?<\/svg>/gi, '')),
      subtitle: '',
    }))
    .filter(item => item.title);
}

export function emptyTemplateSectionFields(): Pick<
  ScrapedTemplateSection,
  | 'profiles' | 'steps' | 'sessions' | 'liveSessionRows' | 'levels' | 'labeledItems'
  | 'legalTabs' | 'legalMetaItems' | 'legalTocItems' | 'legalCalloutHeading' | 'legalTocTitle'
  | 'legalTocDownloadLabel' | 'legalTocDownloadLink' | 'legalSectionNumber' | 'legalSectionHeading'
  | 'checklistHeading' | 'checklistItems' | 'tableRows' | 'bullets' | 'introHtml' | 'contactCta' | 'schedulerTag' | 'schedulerTitle'
  | 'schedulerSubtitle' | 'schedulerPlaceholderHeading' | 'schedulerPlaceholderText' | 'schedulerCtaText'
  | 'schedulerCtaLink' | 'cardTag' | 'cardLiveLabel' | 'cardTitle' | 'cardMeta' | 'cardRows'
  | 'noteHeading' | 'noteText' | 'freePill' | 'primaryCtaLink' | 'secondaryCtaText' | 'secondaryCtaLink'
  | 'contactInfoHeading' | 'contactInfoItems' | 'supportHoursHeading' | 'supportHoursRows'
  | 'supportHoursNote' | 'socialsHeading' | 'socials' | 'anchorId'
  | 'faqItems' | 'priceNow' | 'priceAccess' | 'priceTag' | 'includesItems' | 'videoUrl' | 'videoTitle' | 'videoSubtitle'
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
    bullets: [],
    introHtml: '',
    contactCta: null,
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
    faqItems: [],
    priceNow: '',
    priceAccess: '',
    priceTag: '',
    includesItems: [],
    videoUrl: '',
    videoTitle: '',
    videoSubtitle: '',
  };
}
