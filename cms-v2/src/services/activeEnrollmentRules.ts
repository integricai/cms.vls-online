/** Zenler course ids this order actually enrolled. Combo papers win over the pricing course. */
export function enrolledZenlerCourseIds(input: {
  accessZenlerCourseIds?: readonly string[] | null;
  zenlerCourseId?: string | null;
  saleZenlerCourseId?: string | null;
}): string[] {
  const access = uniqueNumericIds(input.accessZenlerCourseIds);
  if (access.length > 0) return access;
  const primary = firstNumericId(input.zenlerCourseId, input.saleZenlerCourseId);
  return primary ? [primary] : [];
}

/** School access is still open, including a previous unenrol that did not finish. */
export function enrollmentStillOpen(status: string | null | undefined): boolean {
  const value = String(status ?? '').trim().toLowerCase();
  return value.startsWith('enrolled') || value === 'unenroll_failed';
}

export function uniqueNumericIds(values: readonly string[] | null | undefined): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const value of values ?? []) {
    const id = String(value ?? '').trim();
    if (!/^\d+$/.test(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function firstNumericId(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const id = String(value ?? '').trim();
    if (/^\d+$/.test(id)) return id;
  }
  return null;
}
