import { del, get, list, put } from '@vercel/blob';

const CMS_PREFIX = 'cms/';
const CMS_BLOB_ACCESS = 'private';
const MAX_VERSIONS_PER_FILE = 10;

function hasBlobToken()  { return !!process.env.BLOB_READ_WRITE_TOKEN; }
function hasGistConfig() { return !!(process.env.GITHUB_TOKEN && process.env.GIST_ID); }

function cloneValue(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function setCmsHeaders(res, methods) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods || 'GET, POST, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');
}

function buildBlobPrefix(blobFile) {
  return CMS_PREFIX + String(blobFile || '').replace(/\.json$/i, '') + '/';
}

function buildBlobPath(blobFile) {
  var stamp = String(Date.now()).padStart(13, '0');
  var suffix = Math.random().toString(36).slice(2, 8);
  return buildBlobPrefix(blobFile) + stamp + '-' + suffix + '.json';
}

function getSelfUrl(req) {
  var proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim() || 'https';
  var host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  var path = String(req.url || '').split('?')[0];
  return proto + '://' + host + path;
}

// ── Vercel Blob helpers ───────────────────────────────────────────

async function readBlobJson(pathname) {
  try {
    var result = await get(pathname, { access: CMS_BLOB_ACCESS });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    var text = await new Response(result.stream).text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (_) { return null; }
}

async function listBlobVersions(blobFile) {
  try {
    var result = await list({ prefix: buildBlobPrefix(blobFile), limit: 1000 });
    return (result && result.blobs ? result.blobs : []).slice().sort(function(a, b) {
      return String(a.pathname || '').localeCompare(String(b.pathname || ''));
    });
  } catch (_) { return []; }
}

export async function readLatestBlobVersion(blobFile) {
  if (!hasBlobToken()) return null;
  var blobs = await listBlobVersions(blobFile);
  if (!blobs.length) return null;
  return readBlobJson(blobs[blobs.length - 1].pathname);
}

async function writeToBlobStore(blobFile, doc) {
  await put(buildBlobPath(blobFile), JSON.stringify(doc, null, 2), {
    access: CMS_BLOB_ACCESS,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    contentType: 'application/json; charset=utf-8'
  });
  // prune old versions
  var blobs = await listBlobVersions(blobFile);
  if (blobs.length > MAX_VERSIONS_PER_FILE) {
    await del(blobs.slice(0, blobs.length - MAX_VERSIONS_PER_FILE).map(function(b) { return b.pathname; }));
  }
}

// ── GitHub Gist helpers ───────────────────────────────────────────

function gistFileName(blobFile) {
  return String(blobFile || '').replace(/^cms\//, '').replace(/\//g, '-');
}

export async function readLegacyGistDocument(legacyFile) {
  var token = process.env.GITHUB_TOKEN;
  var gistId = process.env.GIST_ID;
  if (!token || !gistId || !legacyFile) return null;
  try {
    var resp = await fetch('https://api.github.com/gists/' + gistId, {
      headers: {
        'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'VLS-CMS'
      }
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    var file = data && data.files ? data.files[legacyFile] : null;
    if (!file || !file.content) return null;
    return JSON.parse(file.content);
  } catch (_) { return null; }
}

async function writeToGist(blobFile, doc) {
  var token = process.env.GITHUB_TOKEN;
  var gistId = process.env.GIST_ID;
  if (!token || !gistId) throw new Error('GitHub Gist not configured');
  var filename = gistFileName(blobFile);
  var resp = await fetch('https://api.github.com/gists/' + gistId, {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'VLS-CMS',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ files: { [filename]: { content: JSON.stringify(doc, null, 2) } } })
  });
  if (!resp.ok) {
    var errText = await resp.text().catch(function() { return ''; });
    throw new Error('Gist write failed: ' + resp.status + ' ' + errText);
  }
}

// ── Unified read / write ──────────────────────────────────────────

export async function writeBlobVersion(blobFile, doc) {
  if (hasBlobToken()) {
    await writeToBlobStore(blobFile, doc);
  } else if (hasGistConfig()) {
    await writeToGist(blobFile, doc);
  } else {
    throw new Error('No storage configured (BLOB_READ_WRITE_TOKEN or GITHUB_TOKEN+GIST_ID required)');
  }
}

export async function readDocument(blobFile, legacyFile) {
  // Try Blob first
  var doc = await readLatestBlobVersion(blobFile);
  if (doc) return doc;

  // Fall back to GitHub Gist
  var gistFile = gistFileName(legacyFile || blobFile);
  var legacyDoc = await readLegacyGistDocument(gistFile);
  if (!legacyDoc) {
    // Also try original legacyFile name for backwards compat
    legacyDoc = await readLegacyGistDocument(legacyFile || blobFile);
  }
  if (!legacyDoc) return null;

  // Migrate to Blob if available
  if (hasBlobToken()) {
    await writeToBlobStore(blobFile, legacyDoc).catch(function() {});
  }
  return legacyDoc;
}

export function requireBlobToken(res) {
  if (hasBlobToken() || hasGistConfig()) return true;
  res.status(500).json({ error: 'Server misconfigured — no storage available. Set BLOB_READ_WRITE_TOKEN or GITHUB_TOKEN + GIST_ID.' });
  return false;
}

export function hasLegacyGistConfig() { return hasGistConfig(); }

export function setCmsHeadersPublic(res, methods) {
  return setCmsHeaders(res, methods);
}

export function createCmsValueHandler(options) {
  var blobFile = options.blobFile;
  var legacyFile = options.legacyFile || blobFile;
  var key = options.key;
  var emptyValue = cloneValue(options.emptyValue);
  var extraResponseData = options.extraResponseData;

  return async function handler(req, res) {
    setCmsHeaders(res, 'GET, POST, OPTIONS');
    try {
      if (req.method === 'OPTIONS') return res.status(204).end();

      if (!requireBlobToken(res)) return;

      if (req.method === 'GET') {
        var doc = await readDocument(blobFile, legacyFile);
        var value = doc && Object.prototype.hasOwnProperty.call(doc, key) ? doc[key] : cloneValue(emptyValue);
        var payload = {};
        payload[key] = value;
        if (typeof extraResponseData === 'function') {
          Object.assign(payload, extraResponseData(req, { selfUrl: getSelfUrl(req) }) || {});
        }
        return res.status(200).json(payload);
      }

      if (req.method === 'POST') {
        var body;
        try {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
        } catch (_) {
          return res.status(400).json({ error: 'Invalid JSON body' });
        }

        var docToSave = {};
        docToSave[key] = Object.prototype.hasOwnProperty.call(body, key) ? body[key] : cloneValue(emptyValue);

        try {
          await writeBlobVersion(blobFile, docToSave);
        } catch (error) {
          return res.status(500).json({ error: error && error.message ? error.message : 'Save failed' });
        }

        var responsePayload = { ok: true };
        if (typeof extraResponseData === 'function') {
          Object.assign(responsePayload, extraResponseData(req, { selfUrl: getSelfUrl(req) }) || {});
        }
        return res.status(200).json(responsePayload);
      }

      return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
      return res.status(500).json({ error: error && error.message ? error.message : 'Handler failed' });
    }
  };
}
