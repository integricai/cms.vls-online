export const EXPERIMENT_STATUSES = ['draft', 'running', 'ended'] as const;

export type ExperimentStatus = (typeof EXPERIMENT_STATUSES)[number];

export type ExperimentVariantInput = {
  label: string;
  path: string;
  weight: number;
};

export type ExperimentInput = {
  name: string;
  entryPath: string;
  variants: ExperimentVariantInput[];
};

export type ExperimentVariantRecord = ExperimentVariantInput & {
  id: number;
  position: number;
};

export type ExperimentRecord = {
  id: number;
  name: string;
  entryPath: string;
  status: ExperimentStatus;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  variants: ExperimentVariantRecord[];
};

/** Running tests, shaped for the Cloudflare worker. */
export type PublicExperiment = {
  id: number;
  entryPath: string;
  variants: ExperimentVariantInput[];
};

export type ExperimentUrlUse = {
  entryPath: string;
  paths: string[];
};

const MAX_NAME_LENGTH = 80;
const MAX_VARIANTS = 6;
const OWN_HOSTS = new Set(['vls-online.com', 'www.vls-online.com']);

export function isExperimentStatus(value: unknown): value is ExperimentStatus {
  return typeof value === 'string' && EXPERIMENT_STATUSES.includes(value as ExperimentStatus);
}

export function normalizeExperimentPath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return null;

  let pathname = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      return null;
    }
    if (!OWN_HOSTS.has(url.hostname.toLowerCase())) return null;
    if (url.search || url.hash) return null;
    pathname = url.pathname;
  }

  if (pathname.includes('?') || pathname.includes('#') || pathname.includes('\\')) return null;
  if (!pathname.startsWith('/')) pathname = `/${pathname}`;
  if (pathname.includes('//') || pathname.includes('..')) return null;

  const parts = pathname.split('/').filter(Boolean);
  if (parts.some(part => !/^[A-Za-z0-9._~-]+$/.test(part))) return null;
  if (parts[0] === 'api') return null;
  return parts.length === 0 ? '/' : `/${parts.join('/')}`;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH || /[<>]/.test(name)) return null;
  return name;
}

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const label = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9 -]{0,19}$/.test(label)) return null;
  return label;
}

function cleanWeight(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

export function parseExperimentInput(body: unknown): { ok: true; value: ExperimentInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Enter a name, an entry URL, and at least two pages.' };
  }

  const record = body as Record<string, unknown>;
  const name = cleanName(record.name);
  if (!name) return { ok: false, error: 'Enter a name up to 80 characters.' };

  const entryPath = normalizeExperimentPath(record.entryPath);
  if (!entryPath) {
    return { ok: false, error: 'Enter a page path such as /acca, or paste a vls-online.com URL.' };
  }

  if (!Array.isArray(record.variants) || record.variants.length < 2) {
    return { ok: false, error: 'Add at least two pages.' };
  }
  if (record.variants.length > MAX_VARIANTS) {
    return { ok: false, error: 'A test can include up to six pages.' };
  }

  const variants: ExperimentVariantInput[] = [];
  const labels = new Set<string>();
  const paths = new Set<string>();

  for (const item of record.variants) {
    if (!item || typeof item !== 'object') {
      return { ok: false, error: 'Each page needs a label, a URL, and a traffic percentage.' };
    }
    const variant = item as Record<string, unknown>;
    const label = cleanLabel(variant.label);
    if (!label) return { ok: false, error: 'Each page needs a label such as A or B.' };
    const labelKey = label.toLowerCase();
    if (labels.has(labelKey)) return { ok: false, error: 'Each page needs its own label.' };
    labels.add(labelKey);

    const path = normalizeExperimentPath(variant.path);
    if (!path) return { ok: false, error: 'Each page needs a path such as /acca or /acca-v2.' };
    if (paths.has(path)) return { ok: false, error: 'Each page needs its own URL.' };
    paths.add(path);

    const weight = cleanWeight(variant.weight);
    if (weight == null || weight < 1 || weight > 99) {
      return { ok: false, error: 'Enter a whole number from 1 to 99 for each traffic percentage.' };
    }
    variants.push({ label, path, weight });
  }

  const total = variants.reduce((sum, variant) => sum + variant.weight, 0);
  if (total !== 100) return { ok: false, error: 'Traffic percentages must add up to 100.' };
  if (!variants.some(variant => variant.path === entryPath)) {
    return { ok: false, error: 'One page must use the entry URL.' };
  }

  return { ok: true, value: { name, entryPath, variants } };
}

/** True when two running tests would split or fetch the same entry URL. */
export function experimentUrlConflict(candidate: ExperimentUrlUse, running: ExperimentUrlUse[]): string | null {
  for (const experiment of running) {
    const overlaps = experiment.entryPath === candidate.entryPath
      || candidate.paths.includes(experiment.entryPath)
      || experiment.paths.includes(candidate.entryPath);
    if (overlaps) return 'Another running test already uses that URL.';
  }
  return null;
}
