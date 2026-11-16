import { sql } from '../db/client';
import {
  experimentUrlConflict,
  isExperimentStatus,
  parseExperimentInput,
  type ExperimentInput,
  type ExperimentRecord,
  type ExperimentStatus,
  type ExperimentVariantRecord,
  type PublicExperiment,
} from '../../shared/experiments';

let schemaReady: Promise<void> | null = null;

export class ExperimentRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ExperimentRequestError';
  }
}

interface ExperimentDbRow {
  id: number;
  name: string;
  entry_path: string;
  status: string;
  started_at: Date | string | null;
  ended_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface VariantDbRow {
  id: number;
  experiment_id: number;
  label: string;
  path: string;
  weight: number;
  position: number;
}

export async function ensureExperimentSchema(): Promise<void> {
  schemaReady ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS experiments (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        entry_path TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT experiments_status_check CHECK (status IN ('draft', 'running', 'ended'))
      )
    `;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS experiments_one_running_entry_idx
      ON experiments (entry_path)
      WHERE status = 'running'
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS experiment_variants (
        id SERIAL PRIMARY KEY,
        experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        label TEXT NOT NULL,
        path TEXT NOT NULL,
        weight INTEGER NOT NULL,
        position INTEGER NOT NULL,
        CONSTRAINT experiment_variants_weight_check CHECK (weight >= 1 AND weight <= 99),
        CONSTRAINT experiment_variants_label_unique UNIQUE (experiment_id, label),
        CONSTRAINT experiment_variants_path_unique UNIQUE (experiment_id, path)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS experiment_variants_experiment_idx
      ON experiment_variants (experiment_id, position)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS experiment_assignments (
        experiment_id INTEGER NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
        variant_label TEXT NOT NULL,
        day DATE NOT NULL,
        visitors INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (experiment_id, variant_label, day),
        CONSTRAINT experiment_assignments_visitors_check CHECK (visitors >= 0)
      )
    `;
  })();
  return schemaReady;
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toVariant(row: VariantDbRow): ExperimentVariantRecord {
  return {
    id: row.id,
    label: row.label,
    path: row.path,
    weight: row.weight,
    position: row.position,
  };
}

function toExperiment(row: ExperimentDbRow, variants: VariantDbRow[]): ExperimentRecord {
  const status: ExperimentStatus = isExperimentStatus(row.status) ? row.status : 'draft';
  return {
    id: row.id,
    name: row.name,
    entryPath: row.entry_path,
    status,
    startedAt: iso(row.started_at),
    endedAt: iso(row.ended_at),
    createdAt: iso(row.created_at) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updated_at) ?? new Date(0).toISOString(),
    variants: variants.map(toVariant),
  };
}

async function variantsFor(experimentId: number): Promise<VariantDbRow[]> {
  const rows = await sql`
    SELECT id, experiment_id, label, path, weight, position
    FROM experiment_variants
    WHERE experiment_id = ${experimentId}
    ORDER BY position ASC, id ASC
  `;
  return rows as VariantDbRow[];
}

export async function listExperiments(): Promise<ExperimentRecord[]> {
  await ensureExperimentSchema();
  const experiments = await sql`
    SELECT id, name, entry_path, status, started_at, ended_at, created_at, updated_at
    FROM experiments
    ORDER BY updated_at DESC, id DESC
  ` as ExperimentDbRow[];
  const variants = await sql`
    SELECT id, experiment_id, label, path, weight, position
    FROM experiment_variants
    ORDER BY experiment_id ASC, position ASC, id ASC
  ` as VariantDbRow[];
  const byExperiment = new Map<number, VariantDbRow[]>();
  for (const variant of variants) {
    const group = byExperiment.get(variant.experiment_id) ?? [];
    group.push(variant);
    byExperiment.set(variant.experiment_id, group);
  }
  return experiments.map(row => toExperiment(row, byExperiment.get(row.id) ?? []));
}

export async function getExperiment(id: number): Promise<ExperimentRecord | null> {
  await ensureExperimentSchema();
  const rows = await sql`
    SELECT id, name, entry_path, status, started_at, ended_at, created_at, updated_at
    FROM experiments
    WHERE id = ${id}
  ` as ExperimentDbRow[];
  const row = rows[0];
  if (!row) return null;
  return toExperiment(row, await variantsFor(id));
}

async function replaceVariants(experimentId: number, input: ExperimentInput): Promise<void> {
  await sql`DELETE FROM experiment_variants WHERE experiment_id = ${experimentId}`;
  for (let position = 0; position < input.variants.length; position += 1) {
    const variant = input.variants[position];
    await sql`
      INSERT INTO experiment_variants (experiment_id, label, path, weight, position)
      VALUES (${experimentId}, ${variant.label}, ${variant.path}, ${variant.weight}, ${position})
    `;
  }
}

function readInput(body: unknown): ExperimentInput {
  const parsed = parseExperimentInput(body);
  if (!parsed.ok) throw new ExperimentRequestError(parsed.error, 400);
  return parsed.value;
}

export async function createExperiment(body: unknown): Promise<ExperimentRecord> {
  await ensureExperimentSchema();
  const input = readInput(body);
  const rows = await sql`
    INSERT INTO experiments (name, entry_path, status)
    VALUES (${input.name}, ${input.entryPath}, 'draft')
    RETURNING id
  ` as Array<{ id: number }>;
  const id = rows[0]?.id;
  if (!id) throw new ExperimentRequestError('Could not save the experiment.', 500);
  await replaceVariants(id, input);
  const saved = await getExperiment(id);
  if (!saved) throw new ExperimentRequestError('Could not save the experiment.', 500);
  return saved;
}

export async function updateExperiment(id: number, body: unknown): Promise<ExperimentRecord> {
  await ensureExperimentSchema();
  const existing = await getExperiment(id);
  if (!existing) throw new ExperimentRequestError('That experiment was not found.', 404);
  if (existing.status !== 'draft') {
    throw new ExperimentRequestError('Only a draft can be edited.', 400);
  }
  const input = readInput(body);
  const updated = await sql`
    UPDATE experiments
    SET name = ${input.name},
        entry_path = ${input.entryPath},
        updated_at = NOW()
    WHERE id = ${id}
      AND status = 'draft'
    RETURNING id
  ` as Array<{ id: number }>;
  if (!updated.length) throw new ExperimentRequestError('Only a draft can be edited.', 400);
  await replaceVariants(id, input);
  const saved = await getExperiment(id);
  if (!saved) throw new ExperimentRequestError('That experiment was not found.', 404);
  return saved;
}

export async function activateExperiment(id: number): Promise<ExperimentRecord> {
  await ensureExperimentSchema();
  const existing = await getExperiment(id);
  if (!existing) throw new ExperimentRequestError('That experiment was not found.', 404);
  if (existing.status !== 'draft') {
    throw new ExperimentRequestError('Only a draft can be activated.', 400);
  }
  const parsed = parseExperimentInput({
    name: existing.name,
    entryPath: existing.entryPath,
    variants: existing.variants,
  });
  if (!parsed.ok) throw new ExperimentRequestError(parsed.error, 400);

  const running = await listExperiments();
  const conflict = experimentUrlConflict(
    { entryPath: existing.entryPath, paths: existing.variants.map(variant => variant.path) },
    running
      .filter(experiment => experiment.status === 'running' && experiment.id !== id)
      .map(experiment => ({
        entryPath: experiment.entryPath,
        paths: experiment.variants.map(variant => variant.path),
      })),
  );
  if (conflict) throw new ExperimentRequestError(conflict, 400);

  try {
    await sql`
      UPDATE experiments
      SET status = 'running',
          started_at = NOW(),
          ended_at = NULL,
          updated_at = NOW()
      WHERE id = ${id}
        AND status = 'draft'
    `;
  } catch (err) {
    const code = typeof err === 'object' && err && 'code' in err ? String((err as { code?: unknown }).code) : '';
    const message = err instanceof Error ? err.message : '';
    if (code === '23505' || message.includes('experiments_one_running_entry')) {
      throw new ExperimentRequestError('Another running test already uses that URL.', 400);
    }
    throw err;
  }
  const saved = await getExperiment(id);
  if (!saved || saved.status !== 'running') {
    throw new ExperimentRequestError('Another running test already uses that URL.', 400);
  }
  return saved;
}

export async function endExperiment(id: number): Promise<ExperimentRecord> {
  await ensureExperimentSchema();
  const existing = await getExperiment(id);
  if (!existing) throw new ExperimentRequestError('That experiment was not found.', 404);
  if (existing.status !== 'running') {
    throw new ExperimentRequestError('Only a running test can be ended.', 400);
  }
  await sql`
    UPDATE experiments
    SET status = 'ended',
        ended_at = NOW(),
        updated_at = NOW()
    WHERE id = ${id}
      AND status = 'running'
  `;
  const saved = await getExperiment(id);
  if (!saved) throw new ExperimentRequestError('That experiment was not found.', 404);
  return saved;
}

export async function deleteExperiment(id: number): Promise<void> {
  await ensureExperimentSchema();
  const existing = await getExperiment(id);
  if (!existing) throw new ExperimentRequestError('That experiment was not found.', 404);
  if (existing.status !== 'draft') {
    throw new ExperimentRequestError('Only a draft can be deleted.', 400);
  }
  await sql`DELETE FROM experiments WHERE id = ${id} AND status = 'draft'`;
}

/** One new visitor on a running test. The label must be one of that test's pages. */
export async function recordExperimentAssignment(experimentId: number, label: string): Promise<boolean> {
  await ensureExperimentSchema();
  const rows = await sql`
    SELECT v.label
    FROM experiments e
    INNER JOIN experiment_variants v ON v.experiment_id = e.id
    WHERE e.id = ${experimentId}
      AND e.status = 'running'
      AND v.label = ${label}
    LIMIT 1
  ` as Array<{ label: string }>;
  if (!rows.length) return false;
  await sql`
    INSERT INTO experiment_assignments (experiment_id, variant_label, day, visitors)
    VALUES (
      ${experimentId},
      ${label},
      (NOW() AT TIME ZONE 'Europe/London')::date,
      1
    )
    ON CONFLICT (experiment_id, variant_label, day)
    DO UPDATE SET visitors = experiment_assignments.visitors + 1
  `;
  return true;
}

export async function listRunningExperiments(): Promise<PublicExperiment[]> {
  const experiments = await listExperiments();
  return experiments
    .filter(experiment => experiment.status === 'running')
    .map(experiment => ({
      id: experiment.id,
      entryPath: experiment.entryPath,
      variants: experiment.variants
        .slice()
        .sort((left, right) => left.position - right.position)
        .map(variant => ({
          label: variant.label,
          path: variant.path,
          weight: variant.weight,
        })),
    }));
}
