export const EXPERIMENTS_URL = "https://api.cms.vls-online.com/api/experiments/active";
export const ASSIGN_URL = "https://api.cms.vls-online.com/api/experiments/assign";
export const COOKIE_NAME = "vls_exp";
export const FETCH_HEADER = "x-vls-exp-fetch";
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 90;
export const EXPERIMENT_CACHE_SECONDS = 12 * 60 * 60;
const EXPERIMENT_FAILURE_CACHE_SECONDS = 60;
const LOOKUP_TIMEOUT_MS = 1000;

const BOT_UA = /bot|spider|crawl|slurp|mediapartners|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|slackbot|discordbot|linkedinbot|pinterest|vkshare|w3c_validator|lighthouse|pagespeed|headless/i;

export function isBot(userAgent) {
  return BOT_UA.test(String(userAgent ?? ""));
}

export function requestPathname(url) {
  const path = url.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

export function shouldPassThrough(request) {
  if (request.method !== "GET" && request.method !== "HEAD") return true;
  if (request.headers.get(FETCH_HEADER)) return true;

  const purpose = [
    request.headers.get("purpose"),
    request.headers.get("sec-purpose"),
    request.headers.get("x-purpose"),
    request.headers.get("x-moz"),
  ].join(" ").toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("preview")) return true;
  if (request.headers.get("next-router-prefetch") === "1") return true;
  if (request.headers.get("rsc") === "1") return true;

  const accept = request.headers.get("accept") ?? "";
  if (accept.includes("text/x-component")) return true;

  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document") return true;
  if (!dest && accept && !accept.includes("text/html") && !accept.includes("*/*")) return true;
  if (isBot(request.headers.get("user-agent"))) return true;
  return false;
}

export function parseAssignments(cookieHeader) {
  const assignments = new Map();
  const pair = readCookie(cookieHeader, COOKIE_NAME);
  if (!pair) return assignments;
  for (const part of pair.split("|")) {
    const splitAt = part.indexOf(":");
    if (splitAt <= 0) continue;
    const id = Number(part.slice(0, splitAt));
    const label = part.slice(splitAt + 1).trim();
    if (!Number.isInteger(id) || id <= 0 || !label) continue;
    assignments.set(id, label);
  }
  return assignments;
}

export function serializeAssignments(assignments) {
  return [...assignments.entries()]
    .map(([id, label]) => `${id}:${label}`)
    .join("|");
}

export function assignmentCookie(value) {
  return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; Secure; SameSite=Lax`;
}

export function pickVariant(variants, unit) {
  const total = variants.reduce((sum, variant) => sum + Number(variant.weight), 0);
  if (!variants.length || total <= 0) return null;
  let cursor = unit * total;
  for (const variant of variants) {
    cursor -= Number(variant.weight);
    if (cursor < 0) return variant;
  }
  return variants[variants.length - 1];
}

export function randomUnit() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return values[0] / 4294967296;
}

function readCookie(cookieHeader, name) {
  const source = String(cookieHeader ?? "");
  for (const part of source.split(";")) {
    const trimmed = part.trim();
    const splitAt = trimmed.indexOf("=");
    if (splitAt <= 0) continue;
    if (trimmed.slice(0, splitAt) !== name) continue;
    return decodeURIComponent(trimmed.slice(splitAt + 1));
  }
  return "";
}

function usableExperiments(body) {
  const rows = Array.isArray(body?.data) ? body.data : [];
  return rows.filter((row) => (
    Number.isInteger(row?.id)
    && row.id > 0
    && typeof row.entryPath === "string"
    && Array.isArray(row.variants)
    && row.variants.length > 0
  ));
}

async function rememberExperiments(cache, key, experiments, maxAge) {
  if (!cache) return;
  await cache.put(key, new Response(JSON.stringify({ ok: true, data: experiments }), {
    headers: {
      "Cache-Control": `public, max-age=${maxAge}`,
      "Content-Type": "application/json",
    },
  }));
}

async function loadExperiments(fetchImpl, cache) {
  const key = new Request(EXPERIMENTS_URL);
  const cached = cache ? await cache.match(key) : undefined;
  if (cached) return usableExperiments(await cached.json());

  let response;
  try {
    response = await fetchImpl(EXPERIMENTS_URL, {
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch {
    await rememberExperiments(cache, key, [], EXPERIMENT_FAILURE_CACHE_SECONDS);
    return [];
  }
  if (!response?.ok) {
    await rememberExperiments(cache, key, [], EXPERIMENT_FAILURE_CACHE_SECONDS);
    return [];
  }
  const experiments = usableExperiments(await response.json());
  await rememberExperiments(cache, key, experiments, EXPERIMENT_CACHE_SECONDS);
  return experiments;
}

function withAssignmentCookie(response, assignments) {
  const headers = new Headers(response.headers);
  headers.append("Set-Cookie", assignmentCookie(serializeAssignments(assignments)));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Returns the variant response for a running entry URL, or null to pass the request through.
 * The browser address stays on the entry URL. The fetched URL is the page that was served.
 */
export async function handleExperiment(request, env, ctx, deps = {}) {
  const url = new URL(request.url);
  if (url.hostname !== "vls-online.com") return null;
  if (shouldPassThrough(request)) return null;

  const fetchImpl = deps.fetch ?? fetch;
  let experiments = [];
  try {
    experiments = await loadExperiments(fetchImpl, deps.cache ?? globalThis.caches?.default);
  } catch {
    return null;
  }

  const experiment = experiments.find((item) => item.entryPath === requestPathname(url));
  if (!experiment) return null;

  const assignments = parseAssignments(request.headers.get("cookie"));
  const existing = assignments.get(experiment.id);
  const kept = experiment.variants.find((variant) => variant.label === existing);
  const chosen = kept ?? pickVariant(experiment.variants, deps.randomUnit ?? randomUnit());
  if (!chosen?.path) return null;

  const fetchedUrl = new URL(request.url);
  fetchedUrl.pathname = chosen.path;
  const headers = new Headers(request.headers);
  headers.set(FETCH_HEADER, "1");
  let origin;
  try {
    origin = await fetchImpl(new Request(fetchedUrl, {
      method: request.method,
      headers,
      redirect: "manual",
    }));
  } catch {
    return null;
  }
  if (!origin) return null;

  assignments.set(experiment.id, chosen.label);
  const response = withAssignmentCookie(origin, assignments);
  if (!kept && request.method === "GET" && env?.VLS_PROXY_SECRET) {
    const count = fetchImpl(ASSIGN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-VLS-Proxy-Secret": env.VLS_PROXY_SECRET,
      },
      body: JSON.stringify({ experimentId: experiment.id, variant: chosen.label }),
    }).catch(() => undefined);
    if (ctx?.waitUntil) ctx.waitUntil(count);
  }

  return { response, fetchedUrl: fetchedUrl.toString() };
}
