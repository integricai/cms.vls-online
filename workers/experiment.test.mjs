import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSIGN_URL,
  EXPERIMENT_CACHE_SECONDS,
  EXPERIMENTS_URL,
  handleExperiment,
  isBot,
  parseAssignments,
  pickVariant,
  requestPathname,
  serializeAssignments,
  shouldPassThrough,
} from "./experiment.mjs";

const experiment = {
  id: 4,
  entryPath: "/acca",
  variants: [
    { label: "A", path: "/acca", weight: 50 },
    { label: "B", path: "/acca-v2", weight: 50 },
  ],
};

function memoryCache() {
  const store = new Map();
  return {
    async match(request) {
      return store.get(request.url);
    },
    async put(request, response) {
      store.set(request.url, response);
    },
  };
}

function pageRequest(url, headers = {}) {
  return new Request(url, {
    headers: {
      accept: "text/html",
      "sec-fetch-dest": "document",
      "user-agent": "Mozilla/5.0",
      ...headers,
    },
  });
}

test("strips a trailing slash and keeps the home path", () => {
  assert.equal(requestPathname(new URL("https://vls-online.com/acca/")), "/acca");
  assert.equal(requestPathname(new URL("https://vls-online.com/")), "/");
});

test("picks a page from the traffic weights", () => {
  assert.equal(pickVariant(experiment.variants, 0).label, "A");
  assert.equal(pickVariant(experiment.variants, 0.49).label, "A");
  assert.equal(pickVariant(experiment.variants, 0.5).label, "B");
  assert.equal(pickVariant(experiment.variants, 0.99).label, "B");
});

test("reads and writes assignment pairs", () => {
  const assignments = parseAssignments("other=1; vls_exp=4:B|9:A");
  assert.equal(assignments.get(4), "B");
  assert.equal(assignments.get(9), "A");
  assert.equal(serializeAssignments(assignments), "4:B|9:A");
});

test("passes bots, prefetch, and files through", () => {
  assert.equal(isBot("Mozilla/5.0 (compatible; Googlebot/2.1)"), true);
  assert.equal(shouldPassThrough(pageRequest("https://vls-online.com/acca", {
    "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
  })), true);
  assert.equal(shouldPassThrough(pageRequest("https://vls-online.com/acca", {
    purpose: "prefetch",
  })), true);
  assert.equal(shouldPassThrough(new Request("https://vls-online.com/acca.js", {
    headers: { accept: "application/javascript", "sec-fetch-dest": "script" },
  })), true);
  assert.equal(shouldPassThrough(pageRequest("https://vls-online.com/acca")), false);
});

test("serves the remembered page and does not count it again", async () => {
  const calls = [];
  const cache = memoryCache();
  await cache.put(new Request(EXPERIMENTS_URL), Response.json({ ok: true, data: [experiment] }));
  const pending = [];
  const result = await handleExperiment(
    pageRequest("https://vls-online.com/acca", { cookie: "vls_exp=4:B" }),
    { VLS_PROXY_SECRET: "secret" },
    { waitUntil(promise) { pending.push(promise); } },
    {
      cache,
      randomUnit: () => 0,
      fetch(input) {
        calls.push(input instanceof Request ? input.url : String(input));
        return new Response("<html></html>", { headers: { "content-type": "text/html" } });
      },
    },
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0], "https://vls-online.com/acca-v2");
  assert.match(result.response.headers.get("set-cookie") ?? "", /vls_exp=4:B/);
  assert.equal(pending.length, 0);
});

test("assigns a new visitor, counts once, and keeps the entry address", async () => {
  const calls = [];
  const pending = [];
  const result = await handleExperiment(
    pageRequest("https://vls-online.com/acca?utm_source=google"),
    { VLS_PROXY_SECRET: "secret" },
    { waitUntil(promise) { pending.push(promise); } },
    {
      cache: memoryCache(),
      randomUnit: () => 0.8,
      async fetch(input, init) {
        const url = input instanceof Request ? input.url : String(input);
        calls.push({ url, method: init?.method ?? "GET", header: input instanceof Request ? input.headers.get("x-vls-exp-fetch") : "" });
        if (url === EXPERIMENTS_URL) return Response.json({ ok: true, data: [experiment] });
        return new Response("page");
      },
    },
  );
  assert.equal(result.fetchedUrl, "https://vls-online.com/acca-v2?utm_source=google");
  assert.equal(calls[1].header, "1");
  await Promise.all(pending);
  assert.equal(calls.some((call) => call.url === ASSIGN_URL && call.method === "POST"), true);
});

test("caches an empty test list for 12 hours and does not fetch the page", async () => {
  const cache = memoryCache();
  let pageFetches = 0;
  const deps = {
    cache,
    async fetch(input) {
      const url = input instanceof Request ? input.url : String(input);
      if (url === EXPERIMENTS_URL) return Response.json({ ok: true, data: [] });
      pageFetches += 1;
      return new Response("page");
    },
  };
  const first = await handleExperiment(pageRequest("https://vls-online.com/acca"), {}, {}, deps);
  const second = await handleExperiment(pageRequest("https://vls-online.com/cima"), {}, {}, deps);
  const stored = await cache.match(new Request(EXPERIMENTS_URL));
  assert.equal(first, null);
  assert.equal(second, null);
  assert.equal(pageFetches, 0);
  assert.equal(stored.headers.get("cache-control"), `public, max-age=${EXPERIMENT_CACHE_SECONDS}`);
});

test("leaves a page alone when no test is running", async () => {
  let fetchedPage = false;
  const result = await handleExperiment(
    pageRequest("https://vls-online.com/cima"),
    {},
    {},
    {
      cache: memoryCache(),
      async fetch(input) {
        const url = input instanceof Request ? input.url : String(input);
        if (url === EXPERIMENTS_URL) return Response.json({ ok: true, data: [experiment] });
        fetchedPage = true;
        return new Response("page");
      },
    },
  );
  assert.equal(result, null);
  assert.equal(fetchedPage, false);
});
