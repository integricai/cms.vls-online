export interface ContentDiff {
  changedPaths: string[];
  summary: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function walkDiff(before: unknown, after: unknown, path: string, out: string[], max: number): void {
  if (out.length >= max || sameJson(before, after)) return;

  if (Array.isArray(before) || Array.isArray(after)) {
    const beforeLength = Array.isArray(before) ? before.length : 0;
    const afterLength = Array.isArray(after) ? after.length : 0;
    if (beforeLength !== afterLength) {
      out.push(`${path || 'root'} length ${beforeLength} -> ${afterLength}`);
      return;
    }
    for (let i = 0; i < afterLength && out.length < max; i++) {
      walkDiff((before as unknown[])[i], (after as unknown[])[i], `${path}[${i}]`, out, max);
    }
    return;
  }

  if (isPlainObject(before) || isPlainObject(after)) {
    const keys = new Set([
      ...Object.keys(isPlainObject(before) ? before : {}),
      ...Object.keys(isPlainObject(after) ? after : {}),
    ]);
    for (const key of keys) {
      if (out.length >= max) break;
      const nextPath = path ? `${path}.${key}` : key;
      walkDiff(
        isPlainObject(before) ? before[key] : undefined,
        isPlainObject(after) ? after[key] : undefined,
        nextPath,
        out,
        max,
      );
    }
    return;
  }

  out.push(path || 'root');
}

function inferComponentName(data: unknown): string | null {
  if (!isPlainObject(data)) return null;
  if (typeof data.name === 'string') return data.name;
  const components = data.components;
  if (Array.isArray(components) && components.length === 1 && isPlainObject(components[0])) {
    return typeof components[0].name === 'string' ? components[0].name : null;
  }
  return null;
}

export function diffContent(before: unknown, after: unknown): ContentDiff & { componentName: string | null } {
  const changedPaths: string[] = [];
  walkDiff(before, after, '', changedPaths, 40);

  const summary = changedPaths.length === 0
    ? 'Saved with no detected content changes'
    : `Changed ${changedPaths.length} field${changedPaths.length === 1 ? '' : 's'}: ${changedPaths.slice(0, 6).join(', ')}${changedPaths.length > 6 ? '...' : ''}`;

  return {
    changedPaths,
    summary,
    componentName: inferComponentName(after),
  };
}
