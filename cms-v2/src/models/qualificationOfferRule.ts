import { sql } from '../db/client';
import type {
  QualificationOfferRule,
  QualificationOfferRuleInput,
  QualificationOfferType,
} from '../../shared/types';

type DbRow = {
  id: number;
  qualification: string;
  offer_type: QualificationOfferType;
  duration_days: number[] | null;
  exam_months: number[] | null;
  cutoff_day: number | null;
  course_ids: number[] | null;
  is_active: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

function asIntArray(value: number[] | null | undefined): number[] {
  if (!Array.isArray(value)) return [];
  return value.map(Number).filter(n => Number.isFinite(n));
}

function normalizeCourseIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0),
  )].sort((a, b) => a - b);
}

function rowToRule(row: DbRow): QualificationOfferRule {
  return {
    id: row.id,
    qualification: row.qualification,
    offerType: row.offer_type,
    durationDays: asIntArray(row.duration_days),
    examMonths: asIntArray(row.exam_months),
    cutoffDay: row.cutoff_day,
    courseIds: asIntArray(row.course_ids),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeOfferRuleInput(input: QualificationOfferRuleInput): QualificationOfferRuleInput {
  const qualification = String(input.qualification ?? '').trim();
  if (!qualification) {
    throw new Error('Qualification is required');
  }

  const offerType = input.offerType === 'open' ? 'open' : 'exam_sessions';

  const durationDays = [...new Set(
    (Array.isArray(input.durationDays) ? input.durationDays : [])
      .map(Number)
      .filter(n => Number.isInteger(n) && n > 0),
  )].sort((a, b) => a - b);

  if (durationDays.length === 0) {
    throw new Error('At least one duration (days) is required');
  }

  let examMonths: number[] = [];
  let cutoffDay: number | null = null;
  let courseIds: number[] = [];

  if (offerType === 'exam_sessions') {
    examMonths = [...new Set(
      (Array.isArray(input.examMonths) ? input.examMonths : [])
        .map(Number)
        .filter(n => Number.isInteger(n) && n >= 1 && n <= 12),
    )].sort((a, b) => a - b);

    if (examMonths.length === 0) {
      throw new Error('Exam-session qualifications need at least one exam month');
    }

    if (input.cutoffDay == null || Number.isNaN(Number(input.cutoffDay))) {
      cutoffDay = null;
    } else {
      const day = Number(input.cutoffDay);
      if (!Number.isInteger(day) || day < 1 || day > 28) {
        throw new Error('Cutoff day must be between 1 and 28');
      }
      cutoffDay = day;
    }

    courseIds = normalizeCourseIds(input.courseIds);
  }

  return {
    qualification,
    offerType,
    durationDays,
    examMonths,
    cutoffDay,
    courseIds,
    isActive: input.isActive !== false,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : 0,
  };
}

export async function listQualificationOfferRules(): Promise<QualificationOfferRule[]> {
  const rows = await sql`
    SELECT *
    FROM qualification_offer_rules
    ORDER BY sort_order ASC, qualification ASC
  ` as DbRow[];
  return rows.map(rowToRule);
}

export async function getQualificationOfferRuleByQualification(
  qualification: string | null | undefined,
): Promise<QualificationOfferRule | null> {
  const key = String(qualification ?? '').trim();
  if (!key) return null;

  const rows = await sql`
    SELECT *
    FROM qualification_offer_rules
    WHERE LOWER(qualification) = LOWER(${key})
      AND is_active = true
    LIMIT 1
  ` as DbRow[];

  return rows[0] ? rowToRule(rows[0]) : null;
}

export async function replaceQualificationOfferRules(
  rules: QualificationOfferRuleInput[],
): Promise<QualificationOfferRule[]> {
  const normalized = rules.map((rule, index) => {
    const item = normalizeOfferRuleInput(rule);
    return {
      ...item,
      sortOrder: item.sortOrder && item.sortOrder > 0 ? item.sortOrder : (index + 1) * 10,
    };
  });

  const seen = new Set<string>();
  for (const rule of normalized) {
    const key = rule.qualification.toLowerCase();
    if (seen.has(key)) {
      throw new Error(`Duplicate qualification: ${rule.qualification}`);
    }
    seen.add(key);
  }

  await sql`DELETE FROM qualification_offer_rules`;

  for (const rule of normalized) {
    await sql`
      INSERT INTO qualification_offer_rules (
        qualification, offer_type, duration_days, exam_months, cutoff_day, course_ids, is_active, sort_order
      )
      VALUES (
        ${rule.qualification},
        ${rule.offerType},
        ${rule.durationDays},
        ${rule.examMonths},
        ${rule.cutoffDay},
        ${rule.courseIds ?? []},
        ${rule.isActive !== false},
        ${rule.sortOrder ?? 0}
      )
    `;
  }

  return listQualificationOfferRules();
}
