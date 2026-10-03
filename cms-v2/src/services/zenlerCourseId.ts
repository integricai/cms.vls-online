/** Pull the Zenler course ID from live / scraped page HTML. */
export function inferZenlerCourseIdFromHtml(html: string): string {
  const courseAssign = html.match(/\bcourse\s*=\s*\{[\s\S]*?"id"\s*:\s*(\d+)/i);
  if (courseAssign?.[1]) return courseAssign[1];

  const thumbMatch = html.match(/contents\.newzenler\.com\/\d+\/courses\/(\d+)\//i);
  if (thumbMatch?.[1]) return thumbMatch[1];

  const dataMatch = html.match(/data-course-id=["'](\d+)["']/i);
  if (dataMatch?.[1]) return dataMatch[1];

  return '';
}

export function htmlHasZenlerCurriculum(html: string): boolean {
  return /zen_cs_cur_dynamic/i.test(html)
    || /cdn\.newzenler\.com\/js\/curriculum\.js/i.test(html)
    || Boolean(inferZenlerCourseIdFromHtml(html));
}
