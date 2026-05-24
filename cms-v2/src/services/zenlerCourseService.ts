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
  hasKnownLastPage: boolean;
}

export async function fetchZenlerCourses(): Promise<ZenlerCourseDto[]> {
  const apiKey = process.env.ZENLER_API_KEY;
  const accountName = process.env.ZENLER_ACCOUNT_NAME;

  if (!apiKey || !accountName) {
    throw new Error('ZENLER_API_KEY and ZENLER_ACCOUNT_NAME must be set in environment variables');
  }

  const baseUrl = `https://${accountName.toLowerCase()}.newzenler.com/api/v1/courses`;
  const allCourses: ZenlerCourseDto[] = [];
  const seenCourseIds = new Set<string>();
  let page = 1;
  const perPage = 100;
  const maxPages = 100;

  while (page <= maxPages) {
    const url = `${baseUrl}?page=${page}&per_page=${perPage}&limit=${perPage}`;
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
    const { items, currentPage, lastPage, hasKnownLastPage } = extractPage(body, page);

    console.log(`[zenler] page ${currentPage}/${hasKnownLastPage ? lastPage : '?'} — ${items.length} items`);

    if (items.length === 0) break;

    let newItems = 0;
    for (const course of items.map(mapToDto)) {
      if (!course.zenlerCourseId || seenCourseIds.has(course.zenlerCourseId)) continue;
      seenCourseIds.add(course.zenlerCourseId);
      allCourses.push(course);
      newItems++;
    }

    if (newItems === 0) break;

    if (hasKnownLastPage && currentPage >= lastPage) break;
    page++;
  }

  return allCourses;
}

function extractPage(body: unknown, requestedPage = 1): PageResult {
  if (!body || typeof body !== 'object') {
    return { items: [], currentPage: requestedPage, lastPage: requestedPage, hasKnownLastPage: true };
  }
  const d = body as Record<string, unknown>;

  // Zenler (Laravel pagination): { data: { current_page, last_page, data: [...] } }
  if (d.data && typeof d.data === 'object' && !Array.isArray(d.data)) {
    const inner = d.data as Record<string, unknown>;
    const currentPage = readNumber(inner, ['current_page', 'currentPage', 'page'], requestedPage);
    const lastPage = readNumber(inner, ['last_page', 'lastPage', 'total_pages', 'totalPages'], currentPage);

    const items: Record<string, unknown>[] =
      Array.isArray(inner.data)    ? inner.data    as Record<string, unknown>[] :
      Array.isArray(inner.items)   ? inner.items   as Record<string, unknown>[] :
      Array.isArray(inner.courses) ? inner.courses as Record<string, unknown>[] :
      [];

    return { items, currentPage, lastPage, hasKnownLastPage: hasAnyKey(inner, ['last_page', 'lastPage', 'total_pages', 'totalPages']) };
  }

  const meta = (d.meta && typeof d.meta === 'object' ? d.meta : d.pagination && typeof d.pagination === 'object' ? d.pagination : null) as Record<string, unknown> | null;
  const currentPage = meta ? readNumber(meta, ['current_page', 'currentPage', 'page'], requestedPage) : requestedPage;
  const lastPage = meta ? readNumber(meta, ['last_page', 'lastPage', 'total_pages', 'totalPages'], currentPage) : currentPage;

  const items: Record<string, unknown>[] =
    Array.isArray(d)           ? d           as Record<string, unknown>[] :
    Array.isArray(d.data)      ? d.data      as Record<string, unknown>[] :
    Array.isArray(d.courses)   ? d.courses   as Record<string, unknown>[] :
    Array.isArray(d.items)     ? d.items     as Record<string, unknown>[] :
    [];

  return {
    items,
    currentPage,
    lastPage,
    hasKnownLastPage: Boolean(meta && hasAnyKey(meta, ['last_page', 'lastPage', 'total_pages', 'totalPages'])),
  };
}

function readNumber(source: Record<string, unknown>, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallback;
}

function hasAnyKey(source: Record<string, unknown>, keys: string[]): boolean {
  return keys.some(key => source[key] != null);
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
