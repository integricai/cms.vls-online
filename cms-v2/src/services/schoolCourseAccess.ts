export type OwnedCourse = {
  zenlerCourseId: string;
  name: string;
};

export type SchoolCourseAccess = {
  registered: boolean;
  lookup: 'ok' | 'unavailable';
  ownsAll: boolean;
  ownedCourses: OwnedCourse[];
};

function uniqueCourseIds(ids: string[]): string[] {
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? '').trim();
    if (!/^\d+$/.test(id) || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

/**
 * Decide what checkout should do after the school lookup.
 * A failed enrollment read never counts as ownership, so payment stays available.
 */
export function summarizeSchoolCourseAccess(input: {
  registered: boolean | null;
  courseIds: string[];
  enrolledIds: string[];
  failedIds: string[];
  namesById: Record<string, string | undefined>;
}): SchoolCourseAccess {
  const courseIds = uniqueCourseIds(input.courseIds);
  const enrolled = new Set(uniqueCourseIds(input.enrolledIds));
  const failed = new Set(uniqueCourseIds(input.failedIds));
  const registered = input.registered === true;
  const ownedCourses = registered
    ? courseIds
      .filter((id) => enrolled.has(id) && !failed.has(id))
      .map((id) => ({
        zenlerCourseId: id,
        name: input.namesById[id]?.trim() || 'this course',
      }))
    : [];
  const ownsAll = registered
    && courseIds.length > 0
    && failed.size === 0
    && courseIds.every((id) => enrolled.has(id));

  return {
    registered,
    lookup: input.registered === null ? 'unavailable' : 'ok',
    ownsAll,
    ownedCourses,
  };
}
