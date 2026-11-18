import type { QualificationOfferRuleInput, QualificationOfferType } from '../../shared/types';

export type ExamSession = { month: number; year: number };

const MONTH_LABELS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

export function formatExamSessionTitle(month: number, year: number): string {
  return `${MONTH_LABELS[month] ?? month} ${year} session`;
}

export function formatDurationLabel(durationDays: number): string {
  if (durationDays % 365 === 0) {
    const years = durationDays / 365;
    return years === 1 ? '1 year' : `${years} years`;
  }
  const months = Math.round(durationDays / 30);
  if (months === 1) return '1 month';
  if (months > 0 && Math.abs(months * 30 - durationDays) <= 5) {
    return `${months} months`;
  }
  return `${durationDays} days`;
}

/**
 * A sitting stays on sale until the cutoff day of its own month.
 * Cutoff 5 → December is offered through 4 December and drops on 5 December.
 * When cutoffDay is null, the sitting stays open until its calendar month begins.
 */
export function isExamSessionOpen(
  session: ExamSession,
  cutoffDay: number | null,
  now: Date = new Date(),
): boolean {
  if (cutoffDay == null) {
    const sessionStart = new Date(session.year, session.month - 1, 1, 0, 0, 0, 0);
    return now.getTime() < sessionStart.getTime();
  }

  const cutoffStart = new Date(session.year, session.month - 1, cutoffDay, 0, 0, 0, 0);
  return now.getTime() < cutoffStart.getTime();
}

/** Upcoming open exam sittings for configured months + cutoff. */
export function getNextOpenExamSessions(
  examMonths: number[],
  cutoffDay: number | null,
  now: Date = new Date(),
  count = 2,
): ExamSession[] {
  const months = [...new Set(
    examMonths
      .map(Number)
      .filter(n => Number.isInteger(n) && n >= 1 && n <= 12),
  )].sort((a, b) => a - b);

  if (months.length === 0 || count <= 0) return [];

  const sessions: ExamSession[] = [];
  const startYear = now.getFullYear();

  for (let year = startYear; year <= startYear + 3 && sessions.length < count; year += 1) {
    for (const month of months) {
      const session = { month, year };
      if (!isExamSessionOpen(session, cutoffDay, now)) continue;
      sessions.push(session);
      if (sessions.length >= count) break;
    }
  }

  return sessions;
}

export type OfferPreviewPlan = {
  durationDays: number;
  durationLabel: string;
  sessionMonth: number | null;
  sessionYear: number | null;
  sessionTitle: string;
};

export type OfferPreview = {
  offerType: QualificationOfferType;
  asOf: string;
  plans: OfferPreviewPlan[];
};

export function previewQualificationOffers(
  rule: Pick<QualificationOfferRuleInput, 'offerType' | 'durationDays' | 'examMonths' | 'cutoffDay'>,
  asOf: Date = new Date(),
): OfferPreview {
  const durations = [...rule.durationDays].sort((a, b) => a - b);

  if (rule.offerType === 'open') {
    return {
      offerType: 'open',
      asOf: asOf.toISOString(),
      plans: durations.map(durationDays => ({
        durationDays,
        durationLabel: formatDurationLabel(durationDays),
        sessionMonth: null,
        sessionYear: null,
        sessionTitle: formatDurationLabel(durationDays),
      })),
    };
  }

  const sessions = getNextOpenExamSessions(
    rule.examMonths,
    rule.cutoffDay,
    asOf,
    Math.max(durations.length, 2),
  );

  return {
    offerType: 'exam_sessions',
    asOf: asOf.toISOString(),
    plans: durations.map((durationDays, index) => {
      const session = sessions[index] ?? null;
      return {
        durationDays,
        durationLabel: formatDurationLabel(durationDays),
        sessionMonth: session?.month ?? null,
        sessionYear: session?.year ?? null,
        sessionTitle: session
          ? formatExamSessionTitle(session.month, session.year)
          : formatDurationLabel(durationDays),
      };
    }),
  };
}
