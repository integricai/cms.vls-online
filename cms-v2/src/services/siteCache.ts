export type SiteCacheEnvironment = 'staging' | 'production';

export type SiteCacheTarget = {
  id: SiteCacheEnvironment;
  label: string;
  siteUrl: string;
  configured: boolean;
};

export type SiteCachePurgeResult = {
  environment: SiteCacheEnvironment;
  siteUrl: string;
  revalidated?: boolean;
  purged?: boolean;
  paths?: string[];
  urls?: string[];
  steps?: unknown;
  failedStep?: string | null;
  skipped?: boolean;
  reason?: string;
};

type TargetConfig = {
  urlEnv: string;
  secretEnv: string;
  label: string;
  defaultUrl: string;
};

const TARGETS: Record<SiteCacheEnvironment, TargetConfig> = {
  staging: {
    urlEnv: 'STAGING_SITE_URL',
    secretEnv: 'STAGING_REVALIDATE_SECRET',
    label: 'Staging',
    defaultUrl: 'https://staging.vls-online.com',
  },
  production: {
    urlEnv: 'PRODUCTION_SITE_URL',
    secretEnv: 'PRODUCTION_REVALIDATE_SECRET',
    label: 'Production',
    defaultUrl: 'https://prod.vls-online.com',
  },
};

export class SiteCacheError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = 'SiteCacheError';
    this.status = status;
  }
}

function siteUrlFor(environment: SiteCacheEnvironment): string {
  const target = TARGETS[environment];
  return (process.env[target.urlEnv]?.trim() || target.defaultUrl).replace(/\/+$/, '');
}

function secretFor(environment: SiteCacheEnvironment): string {
  return process.env[TARGETS[environment].secretEnv]?.trim() || '';
}

export function listSiteCacheTargets(): SiteCacheTarget[] {
  return (Object.keys(TARGETS) as SiteCacheEnvironment[]).map(id => ({
    id,
    label: TARGETS[id].label,
    siteUrl: siteUrlFor(id),
    configured: Boolean(secretFor(id)),
  }));
}

export function resolvePagePath(page: string): string {
  const trimmed = page.trim();
  if (!trimmed) {
    throw new SiteCacheError('Enter a page path or URL to purge', 400);
  }
  if (trimmed.startsWith('/')) {
    return trimmed.split(/[?#]/)[0] || '/';
  }
  try {
    return new URL(trimmed).pathname || '/';
  } catch {
    return `/${trimmed.replace(/^\/+/, '')}`.split(/[?#]/)[0] || '/';
  }
}

export async function purgeSiteCache(input: {
  environment: SiteCacheEnvironment;
  purgeAll: boolean;
  page?: string;
}): Promise<SiteCachePurgeResult> {
  const target = TARGETS[input.environment];
  const siteUrl = siteUrlFor(input.environment);
  const secret = secretFor(input.environment);

  if (!secret) {
    throw new SiteCacheError(
      `${target.label} REVALIDATE_SECRET is not configured on the CMS`,
      503,
    );
  }

  const body = input.purgeAll
    ? { purge: 'all' }
    : { purge: false, urls: [resolvePagePath(input.page ?? '')] };

  const response = await fetch(`${siteUrl}/api/revalidate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json().catch(() => ({}))) as SiteCachePurgeResult & {
    error?: string;
  };

  if (!response.ok) {
    throw new SiteCacheError(
      typeof data.error === 'string'
        ? data.error
        : `${target.label} revalidate failed (${response.status})`,
      response.status,
    );
  }

  return {
    environment: input.environment,
    siteUrl,
    revalidated: data.revalidated,
    purged: data.purged,
    paths: data.paths,
    urls: data.urls,
    steps: data.steps,
    failedStep: data.failedStep ?? null,
    skipped: data.skipped,
    reason: data.reason,
  };
}
