export interface ZenlerCourseDto {
  zenlerCourseId: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenlerUrl: string | null;
}

/**
 * Fetches all courses from the Zenler API.
 * Handles pagination automatically (Zenler uses page/per_page query params).
 * Reads ZENLER_API_KEY and ZENLER_ACCOUNT_NAME from environment.
 */
export async function fetchZenlerCourses(): Promise<ZenlerCourseDto[]> {
  const apiKey = process.env.ZENLER_API_KEY;
  const accountName = process.env.ZENLER_ACCOUNT_NAME;

  if (!apiKey || !accountName) {
    throw new Error(
      'ZENLER_API_KEY and ZENLER_ACCOUNT_NAME must be set in environment variables',
    );
  }

  const baseUrl = `https://${accountName.toLowerCase()}.newzenler.com/api/v1/courses`;
  const allCourses: ZenlerCourseDto[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const url = `${baseUrl}?page=${page}&per_page=${perPage}`;
    const response = await fetch(url, {
      headers: {
        'X-API-KEY': apiKey,
        'X-Account-Name': accountName,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      let detail = '';
      try { detail = await response.text(); } catch { /* ignore */ }
      console.error('[zenler] HTTP', response.status, url, detail.slice(0, 400));
      throw new Error(
        `Zenler API returned ${response.status} ${response.statusText}${detail ? ': ' + detail.slice(0, 200) : ''}`,
      );
    }

    const body = await response.json() as unknown;
    console.log('[zenler] page', page, 'raw keys:', Object.keys((body as object) ?? {}));
    const items = extractItems(body);

    if (items.length === 0) break;

    allCourses.push(...items.map(mapToDto).filter(c => c.zenlerCourseId !== ''));

    // Stop if we received fewer items than requested (last page)
    if (items.length < perPage) break;
    page++;
  }

  return allCourses;
}

function extractItems(data: unknown): Record<string, unknown>[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  // Zenler may return { data: { items: [...] } }, { data: [...] }, { courses: [...] }, or just [...]
  if (Array.isArray(d)) return d as Record<string, unknown>[];
  if (Array.isArray(d.data)) return d.data as Record<string, unknown>[];
  if (d.data && typeof d.data === 'object') {
    const inner = d.data as Record<string, unknown>;
    if (Array.isArray(inner.items)) return inner.items as Record<string, unknown>[];
    if (Array.isArray(inner.courses)) return inner.courses as Record<string, unknown>[];
    if (Array.isArray(inner.data)) return inner.data as Record<string, unknown>[];
  }
  if (Array.isArray(d.courses)) return d.courses as Record<string, unknown>[];
  if (Array.isArray(d.items)) return d.items as Record<string, unknown>[];

  return [];
}

function mapToDto(item: Record<string, unknown>): ZenlerCourseDto {
  const rawId = item.id ?? item.course_id ?? item.courseId ?? '';
  const zenlerCourseId = String(rawId);

  const rawCategory = item.category;
  let category: string | null = null;
  if (rawCategory && typeof rawCategory === 'object') {
    category = String((rawCategory as Record<string, unknown>).name ?? '') || null;
  } else if (rawCategory) {
    category = String(rawCategory) || null;
  }

  const rawUrl =
    item.url ?? item.course_url ?? item.permalink ?? item.courseUrl ?? null;

  return {
    zenlerCourseId,
    name: String(item.title ?? item.name ?? item.course_title ?? 'Untitled'),
    slug: item.slug ? String(item.slug) : null,
    category,
    level: item.level ? String(item.level) : null,
    status: item.status ? String(item.status) : null,
    zenlerUrl: rawUrl ? String(rawUrl) : null,
  };
}
