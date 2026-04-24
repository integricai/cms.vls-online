import { del, get, list, put } from '@vercel/blob';

const CMS_PREFIX = 'cms/';
const CMS_BLOB_ACCESS = 'private';
const MAX_VERSIONS_PER_FILE = 10;

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

async function readBlobJson(pathname) {
  var result = await get(pathname, { access: CMS_BLOB_ACCESS });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  var text = await new Response(result.stream).text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return null;
  }
}

async function listBlobVersions(blobFile) {
  var result = await list({
    prefix: buildBlobPrefix(blobFile),
    limit: 1000
  });
  return (result && result.blobs ? result.blobs : []).slice().sort(function(a, b) {
    return String(a.pathname || '').localeCompare(String(b.pathname || ''));
  });
}

async function readLatestBlobVersion(blobFile) {
  var blobs = await listBlobVersions(blobFile);
  if (!blobs.length) return null;
  return readBlobJson(blobs[blobs.length - 1].pathname);
}

async function writeBlobVersion(blobFile, doc) {
  await put(buildBlobPath(blobFile), JSON.stringify(doc, null, 2), {
    access: CMS_BLOB_ACCESS,
    addRandomSuffix: false,
    cacheControlMaxAge: 60,
    contentType: 'application/json; charset=utf-8'
  });
  await pruneBlobVersions(blobFile);
}

async function pruneBlobVersions(blobFile) {
  var blobs = await listBlobVersions(blobFile);
  if (blobs.length <= MAX_VERSIONS_PER_FILE) return;
  await del(blobs.slice(0, blobs.length - MAX_VERSIONS_PER_FILE).map(function(item) {
    return item.pathname;
  }));
}

async function readLegacyGistDocument(legacyFile) {
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
  } catch (error) {
    return null;
  }
}

async function readDocument(blobFile, legacyFile) {
  var doc = await readLatestBlobVersion(blobFile);
  if (doc) return doc;

  var legacyDoc = await readLegacyGistDocument(legacyFile || blobFile);
  if (!legacyDoc) return null;

  await writeBlobVersion(blobFile, legacyDoc);
  return legacyDoc;
}

function requireBlobToken(res) {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  res.status(500).json({ error: 'Server misconfigured — BLOB_READ_WRITE_TOKEN missing' });
  return false;
}

export function createCmsValueHandler(options) {
  var blobFile = options.blobFile;
  var legacyFile = options.legacyFile || blobFile;
  var key = options.key;
  var emptyValue = cloneValue(options.emptyValue);
  var extraResponseData = options.extraResponseData;

  return async function handler(req, res) {
    if (req.method === 'OPTIONS') {
      setCmsHeaders(res, 'GET, POST, OPTIONS');
      return res.status(204).end();
    }

    if (!requireBlobToken(res)) return;

    if (req.method === 'GET') {
      setCmsHeaders(res, 'GET, POST, OPTIONS');
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
      setCmsHeaders(res, 'GET, POST, OPTIONS');
      var body;
      try {
        body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      } catch (error) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }

      var docToSave = {};
      docToSave[key] = Object.prototype.hasOwnProperty.call(body, key) ? body[key] : cloneValue(emptyValue);

      try {
        await writeBlobVersion(blobFile, docToSave);
      } catch (error) {
        return res.status(500).json({ error: error && error.message ? error.message : 'Blob save failed' });
      }

      var responsePayload = { ok: true };
      if (typeof extraResponseData === 'function') {
        Object.assign(responsePayload, extraResponseData(req, { selfUrl: getSelfUrl(req) }) || {});
      }
      return res.status(200).json(responsePayload);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  };
}
