import {
  hasLegacyGistConfig,
  readLatestBlobVersion,
  readLegacyGistDocument,
  requireBlobToken,
  setCmsHeadersPublic,
  writeBlobVersion
} from './_cms-blob-store.js';

const CMS_MIGRATION_FILES = [
  'vls-about-us.json',
  'vls-banners.json',
  'vls-events.json',
  'vls-faq.json',
  'vls-feature-cards.json',
  'vls-footer.json',
  'vls-form-config.json',
  'vls-header-config.json',
  'vls-home-hero.json',
  'vls-programs.json',
  'vls-promotion-sections.json',
  'vls-steps-sections.json',
  'vls-team.json'
];

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

export default async function handler(req, res) {
  setCmsHeadersPublic(res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!requireBlobToken(res)) return;

  if (req.method === 'GET') {
    var status = [];
    for (var i = 0; i < CMS_MIGRATION_FILES.length; i += 1) {
      var file = CMS_MIGRATION_FILES[i];
      var blobDoc = await readLatestBlobVersion(file);
      status.push({
        file: file,
        blobPresent: !!blobDoc
      });
    }
    return res.status(200).json({
      ok: true,
      legacyConfigured: hasLegacyGistConfig(),
      files: status
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!hasLegacyGistConfig()) {
    return res.status(400).json({
      error: 'Legacy gist env vars missing. Add GITHUB_TOKEN and GIST_ID to this project temporarily to import old content.'
    });
  }

  var body;
  try {
    body = parseBody(req);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  var force = !!body.force;
  var results = [];

  for (var j = 0; j < CMS_MIGRATION_FILES.length; j += 1) {
    var legacyFile = CMS_MIGRATION_FILES[j];
    var existingBlob = await readLatestBlobVersion(legacyFile);
    if (existingBlob && !force) {
      results.push({ file: legacyFile, status: 'skipped', reason: 'blob-exists' });
      continue;
    }

    var legacyDoc = await readLegacyGistDocument(legacyFile);
    if (!legacyDoc) {
      results.push({ file: legacyFile, status: 'skipped', reason: 'legacy-missing' });
      continue;
    }

    await writeBlobVersion(legacyFile, legacyDoc);
    results.push({ file: legacyFile, status: 'imported' });
  }

  return res.status(200).json({
    ok: true,
    force: force,
    results: results
  });
}
