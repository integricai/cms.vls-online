export interface ZenlerCourseDto {
  zenlerCourseId: string;
  name: string;
  slug: string | null;
  category: string | null;
  level: string | null;
  status: string | null;
  zenlerUrl: string | null;
}

interface PageResult {
  items: Record<string, unknown>[];
  currentPage: number;
  lastPage: number;
}

export async function fetchZenlerCourses(): Promise<ZenlerCourseDto[]> {
  const apiKey = process.env.ZENLER_API_KEY;
  const accountName = process.env.ZENLER_ACCOUNT_NAME;

  if (!apiKey || !accountName) {
    throw new Error('ZENLER_API_KEY and ZENLER_ACCOUNT_NAME must be set in environment variables');
  }

  const baseUrl = `https://${accountName.toLowerCase()}.newzenler.com/api/v1/courses`;
  const allCourses: ZenlerCourseDto[] = [];
  let page = 1;

  while (true) {
    const url = `${baseUrl}?page=${page}`;
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
    const { items, currentPage, lastPage } = extractPage(body);

    console.log(`[zenler] page ${currentPage}/${lastPage} — ${items.length} items`);

    if (items.length === 0) break;

    allCourses.push(...items.map(mapToDto).filter(c => c.zenlerCourseId !== ''));

    if (currentPage >= lastPage) break;
    page++;
  }

  return allCourses;
}

function extractPage(body: unknown): PageResult {
  if (!body || typeof body !== 'object') return { items: [], currentPage: 1, lastPage: 1 };
  const d = body as Record<string, unknown>;

  // Zenler (Laravel pagination): { data: { current_page, last_page, data: [...] } }
  if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
    const inner = d.data as Record<string, unknown>;
    const currentPage = Number(inner.current_page) || 1;
    const lastPage    = Number(inner.last_page)    || 1;

    const items: Record<string, unknown>[] =
      Array.isArray(inner.data)    ? inner.data    as Record<string, unknown>[] :
      Array.isArray(inner.items)   ? inner.items   as Record<string, unknown>[] :
      Array.isArray(inner.courses) ? inner.courses as Record<string, unknown>[] :
      [];

    return { items, currentPage, lastPage };
  }

  // Flat array fallback
  const items: Record<string, unknown>[] =
    Array.isArray(d)           ? d           as Record<string, unknown>[] :
    Array.isArray(d.data)      ? d.data      as Record<string, unknown>[] :
    Array.isArray(d.courses)   ? d.courses   as Record<string, unknown>[] :
    Array.isArray(d.items)     ? d.items     as Record<string, unknown>[] :
    [];

  return { items, currentPage: 1, lastPage: 1 };
}

function mapToDto(item: Record<string, unknown>): ZenlerCourseDto {
  const rawId = item.id ?? item.course_id ?? item.courseId ?? '';

  const rawCategory = item.category;
  let category: string | null = null;
  if (rawCategory && typeof rawCategory === 'object') {
    category = String((rawCategory as Record<string, unknown>).name ?? '') || null;
  } else if (rawCategory) {
    category = String(rawCategory) || null;
  }

  const rawUrl = item.url ?? item.course_url ?? item.permalink ?? item.courseUrl ?? null;

  return {
    zenlerCourseId: String(rawId),
    name: String(item.title ?? item.name ?? item.course_title ?? 'Untitled'),
    slug: item.slug ? String(item.slug) : null,
    category,
    level:     item.level  ? String(item.level)  : null,
    status:    item.status ? String(item.status) : null,
    zenlerUrl: rawUrl      ? String(rawUrl)       : null,
  };
}
