export function wrapGeneratedHtml(sectionName: string, html: string): string {
  const cleanName = sectionName.trim() || 'CMS Section';
  const start = `<!-- ${cleanName} Section starting here -->`;
  const end = `<!-- ${cleanName} Section ends here -->`;
  const trimmed = html.trim();

  if (!trimmed) return '';
  if (trimmed.startsWith(start) && trimmed.endsWith(end)) return trimmed;
  return `${start}\n${trimmed}\n${end}`;
}
