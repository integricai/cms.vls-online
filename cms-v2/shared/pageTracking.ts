import type { Ga4Count } from './ga4Report';

export const TRACKING_NAME_MAX = 120;

/** Public path used to match a sitemap row. Strips a query, an /en or /ar prefix, and a trailing slash. */
export function trackingLookupPath(value: string): string {
  const raw = value.trim();
  if (!raw || raw === '(not set)') return raw;
  let path = raw;
  const query = path.indexOf('?');
  if (query >= 0) path = path.slice(0, query);
  const hash = path.indexOf('#');
  if (hash >= 0) path = path.slice(0, hash);
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  const lower = path.toLowerCase();
  if (lower === '/ar' || lower === '/en') return '/';
  if (lower.startsWith('/ar/') || lower.startsWith('/en/')) return lower.slice(3) || '/';
  return lower;
}

/**
 * Page name for a public path, using the names already saved in the vault.
 * `/` is `vls:[home]`. A top-level page is `vls:[slug]`.
 * A nested page keeps each folder outside the brackets: `vls:blog:[slug]`.
 * Returns '' when the path cannot be named within the storage limit.
 */
export function pageTrackingNameFromPath(value: string): string {
  const path = trackingLookupPath(value);
  if (!path.startsWith('/')) return '';
  const segments = path.split('/').filter(Boolean);
  if (segments.some(segment => /[\u0000-\u001f<>"'`\\]/.test(segment))) return '';
  const leaf = segments[segments.length - 1];
  const name = segments.length === 0
    ? 'vls:[home]'
    : segments.length === 1
      ? `vls:[${leaf}]`
      : `vls:${segments.slice(0, -1).join(':')}:[${leaf}]`;
  return name.length > TRACKING_NAME_MAX ? '' : name;
}

/**
 * Name to store for a new or renamed page.
 * Null leaves a hand-edited name unchanged.
 */
export function autoTrackingName(
  current: { path: string; trackingName: string } | null,
  nextPath: string,
): string | null {
  const generated = pageTrackingNameFromPath(nextPath);
  if (!generated) return null;
  if (!current) return generated;
  const existing = current.trackingName.trim();
  if (!existing || existing === pageTrackingNameFromPath(current.path)) return generated;
  return null;
}

export type PathRename = { fromPath: string; toPath: string };

const RENAME_HOP_LIMIT = 8;

/**
 * An old course URL keeps no page name of its own after a rename.
 * Follow the URL change history and use the current page's name.
 * A path that already has a name is left as it is.
 */
export function withRenamedPathNames(
  names: Record<string, string>,
  renames: PathRename[],
): Record<string, string> {
  const successor = new Map<string, string>();
  for (const rename of renames) {
    const from = trackingLookupPath(rename.fromPath);
    const to = trackingLookupPath(rename.toPath);
    if (!from.startsWith('/') || !to.startsWith('/') || from === to) continue;
    successor.set(from, to);
  }

  const aliased = { ...names };
  for (const start of successor.keys()) {
    if (aliased[start]) continue;
    const seen = new Set<string>([start]);
    let path = successor.get(start);
    for (let hop = 0; path && hop < RENAME_HOP_LIMIT; hop += 1) {
      const name = aliased[path];
      if (name) {
        aliased[start] = name;
        break;
      }
      if (seen.has(path)) break;
      seen.add(path);
      path = successor.get(path);
    }
  }
  return aliased;
}

/** Empty clears the name. Null means the value cannot be stored. */
export function normalizeTrackingName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim().replace(/\s+/g, ' ');
  if (name.length > TRACKING_NAME_MAX) return null;
  if (/[\u0000-\u001f<>"'`\\]/.test(name)) return null;
  return name;
}

/** Replace a URL with its tracking name and combine rows that share that name. */
export function applyPageTrackingNames(rows: Ga4Count[], names: Record<string, string>): Ga4Count[] {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const path = trackingLookupPath(row.label);
    const label = (path && names[path]) || row.label;
    totals.set(label, (totals.get(label) ?? 0) + row.value);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .filter(row => row.value > 0)
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
}
