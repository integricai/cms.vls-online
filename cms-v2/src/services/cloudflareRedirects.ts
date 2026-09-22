import { courseRedirectUrls } from './courseUrlRewrite';

const CLOUDFLARE_API = 'https://api.cloudflare.com/client/v4';
export const COURSE_REDIRECT_LIST_NAME = 'cms_course_redirects';

export type CloudflareRedirectConfig = {
  token: string;
  accountId: string;
  zoneId: string;
  origins: string[];
};

type CloudflareResponse<T> = {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  result?: T;
  result_info?: { cursors?: { after?: string } };
};

type RedirectList = { id: string; name: string; kind: string };
type RedirectItem = {
  id: string;
  redirect?: { source_url?: string; target_url?: string; status_code?: number };
};
type BulkOperation = { operation_id?: string; status?: string; error?: string };
type RedirectRule = {
  id?: string;
  action?: string;
  expression?: string;
  description?: string;
  enabled?: boolean;
  action_parameters?: { from_list?: { name?: string; key?: string } };
};
type Ruleset = { rules?: RedirectRule[] };

export function resolveCloudflareRedirectConfig(): CloudflareRedirectConfig | null {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim();
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
  const zoneId = process.env.CLOUDFLARE_ZONE_ID?.trim();
  if (!token || !accountId || !zoneId) return null;
  return {
    token,
    accountId,
    zoneId,
    origins: redirectOrigins(),
  };
}

export function redirectOrigins(): string[] {
  const raw = process.env.COURSE_REDIRECT_ORIGINS?.trim();
  const origins = (raw ? raw.split(',') : ['https://www.vls-online.com', 'https://vls-online.com'])
    .map(origin => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return origins.length ? origins : ['https://www.vls-online.com', 'https://vls-online.com'];
}

export function missingCloudflareRedirectConfigMessage(): string {
  return 'Cloudflare redirects are not configured. Set CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and CLOUDFLARE_ZONE_ID. The token needs Account Filter Lists Edit and Zone Dynamic Redirect Write.';
}

function cloudflareError(status: number, payload: CloudflareResponse<unknown> | null): string {
  const message = payload?.errors?.map(error => error.message).filter(Boolean).join('; ');
  return message || `Cloudflare HTTP ${status}`;
}

async function cloudflareFetch<T>(
  config: CloudflareRedirectConfig,
  method: string,
  path: string,
  body?: unknown,
): Promise<CloudflareResponse<T>> {
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let payload: CloudflareResponse<T> | null = null;
  try {
    payload = await response.json() as CloudflareResponse<T>;
  } catch {
    payload = null;
  }
  if (!response.ok || payload?.success === false) {
    throw new Error(cloudflareError(response.status, payload));
  }
  return payload ?? { success: true };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForOperation(config: CloudflareRedirectConfig, operationId: string): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const data = await cloudflareFetch<BulkOperation>(
      config,
      'GET',
      `/accounts/${config.accountId}/rules/lists/bulk_operations/${operationId}`,
    );
    const status = data.result?.status;
    if (status === 'completed' || status === 'success') return;
    if (status === 'failed') {
      throw new Error(data.result?.error || 'Cloudflare bulk operation failed');
    }
    await sleep(1000);
  }
  throw new Error('Cloudflare bulk operation did not finish in time');
}

async function runBulkOperation(
  config: CloudflareRedirectConfig,
  payload: CloudflareResponse<{ operation_id?: string }>,
): Promise<void> {
  const operationId = payload.result?.operation_id;
  if (operationId) await waitForOperation(config, operationId);
}

async function ensureRedirectList(config: CloudflareRedirectConfig): Promise<string> {
  const data = await cloudflareFetch<RedirectList[]>(
    config,
    'GET',
    `/accounts/${config.accountId}/rules/lists`,
  );
  const existing = (data.result ?? []).find(list => list.name === COURSE_REDIRECT_LIST_NAME);
  if (existing) {
    if (existing.kind !== 'redirect') {
      throw new Error(`Cloudflare list ${COURSE_REDIRECT_LIST_NAME} exists but is not a redirect list.`);
    }
    return existing.id;
  }

  const created = await cloudflareFetch<RedirectList>(
    config,
    'POST',
    `/accounts/${config.accountId}/rules/lists`,
    {
      name: COURSE_REDIRECT_LIST_NAME,
      kind: 'redirect',
      description: 'CMS course URL redirects',
    },
  );
  const id = created.result?.id;
  if (!id) throw new Error('Cloudflare did not return a redirect list id');
  return id;
}

function ruleUsesList(rule: RedirectRule, listName: string): boolean {
  return rule.action_parameters?.from_list?.name === listName;
}

async function ensureRedirectRule(config: CloudflareRedirectConfig): Promise<void> {
  const path = `/zones/${config.zoneId}/rulesets/phases/http_request_dynamic_redirect/entrypoint`;
  let ruleset: Ruleset = { rules: [] };
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (response.ok) {
    const payload = await response.json() as CloudflareResponse<Ruleset>;
    ruleset = payload.result ?? { rules: [] };
  } else if (response.status !== 404) {
    let payload: CloudflareResponse<unknown> | null = null;
    try {
      payload = await response.json() as CloudflareResponse<unknown>;
    } catch {
      payload = null;
    }
    throw new Error(cloudflareError(response.status, payload));
  }

  const rules = ruleset.rules ?? [];
  if (rules.some(rule => ruleUsesList(rule, COURSE_REDIRECT_LIST_NAME))) return;

  const nextRule: RedirectRule = {
    action: 'redirect',
    expression: `http.request.full_uri in $${COURSE_REDIRECT_LIST_NAME}`,
    description: 'CMS course URL redirects',
    enabled: true,
    action_parameters: {
      from_list: {
        name: COURSE_REDIRECT_LIST_NAME,
        key: 'http.request.full_uri',
      },
    },
  };

  await cloudflareFetch(
    config,
    'PUT',
    path,
    { rules: [...rules, nextRule] },
  );
}

async function listRedirectItems(config: CloudflareRedirectConfig, listId: string): Promise<RedirectItem[]> {
  const items: RedirectItem[] = [];
  let cursor = '';
  do {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const data = await cloudflareFetch<RedirectItem[]>(
      config,
      'GET',
      `/accounts/${config.accountId}/rules/lists/${listId}/items${query}`,
    );
    items.push(...(data.result ?? []));
    cursor = data.result_info?.cursors?.after ?? '';
  } while (cursor);
  return items;
}

export async function publishPathsToCloudflare(
  pairs: Array<{ fromPath: string; toPath: string }>,
  config = resolveCloudflareRedirectConfig(),
): Promise<{ itemsWritten: number }> {
  if (!config) throw new Error(missingCloudflareRedirectConfigMessage());
  if (!pairs.length) return { itemsWritten: 0 };

  const desired = pairs.flatMap(pair => courseRedirectUrls(pair.fromPath, pair.toPath, config.origins));
  const listId = await ensureRedirectList(config);
  await ensureRedirectRule(config);

  const existing = await listRedirectItems(config, listId);
  const bySource = new Map(existing.flatMap(item => {
    const source = item.redirect?.source_url;
    return source ? [[source, item] as const] : [];
  }));

  const toDelete: string[] = [];
  const toAdd: Array<{ redirect: { source_url: string; target_url: string; status_code: number; preserve_query_string: boolean } }> = [];

  for (const item of desired) {
    const current = bySource.get(item.sourceUrl);
    if (
      current?.redirect?.target_url === item.targetUrl
      && current.redirect.status_code === 301
    ) {
      continue;
    }
    if (current?.id) toDelete.push(current.id);
    toAdd.push({
      redirect: {
        source_url: item.sourceUrl,
        target_url: item.targetUrl,
        status_code: 301,
        preserve_query_string: true,
      },
    });
  }

  if (toDelete.length) {
    const deleted = await cloudflareFetch<{ operation_id?: string }>(
      config,
      'DELETE',
      `/accounts/${config.accountId}/rules/lists/${listId}/items`,
      { items: toDelete.map(id => ({ id })) },
    );
    await runBulkOperation(config, deleted);
  }

  if (toAdd.length) {
    const added = await cloudflareFetch<{ operation_id?: string }>(
      config,
      'POST',
      `/accounts/${config.accountId}/rules/lists/${listId}/items`,
      toAdd,
    );
    await runBulkOperation(config, added);
  }

  return { itemsWritten: toAdd.length };
}
