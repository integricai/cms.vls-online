"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env.local') });
const blob_1 = require("@vercel/blob");
const serverless_1 = require("@neondatabase/serverless");
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN is not set');
    process.exit(1);
}
const sql = (0, serverless_1.neon)(connectionString);
const BLOB_FILES = [
    'vls-header-config',
    'vls-footer',
    'vls-home-hero',
    'vls-faq',
    'vls-events',
    'vls-programs',
    'vls-team',
    'vls-banners',
    'vls-about-us',
    'vls-article-groups',
    'vls-form-config',
    'vls-feature-cards',
    'vls-feature-cards-2',
    'vls-feature-cards-3',
    'vls-left-generic-section',
    'vls-right-pane-section',
    'vls-steps-sections',
    'vls-promotion-sections',
    'vls-program-cards-v2',
    'vls-report-config',
    'vls-report-ty-config',
    'vls-cf-components',
    'vls-course-desc-components',
    'vls-course-hero-components',
    'vls-course-hero-right-components',
    'vls-course-tabs-components',
    'vls-dcs-components',
    'vls-dcs2-components',
    'vls-dcs3-components',
    'vls-desc-components',
    'vls-hero2-components',
    'vls-intro-components',
    'vls-page-hero-banner-components',
    'vls-page-hero-v2-components',
    'vls-page-left-hero-components',
    'vls-policy-components',
    'vls-reach-components',
    'vls-tabs-components',
];
async function fetchLatestBlob(name) {
    const prefix = `cms/${name}/`;
    const result = await (0, blob_1.list)({ prefix, limit: 1000 });
    const blobs = (result?.blobs ?? []).sort((a, b) => a.pathname.localeCompare(b.pathname));
    if (!blobs.length)
        return null;
    const latest = blobs[blobs.length - 1];
    const fetched = await (0, blob_1.get)(latest.pathname, { access: 'private' });
    if (!fetched || fetched.statusCode !== 200 || !fetched.stream)
        return null;
    const text = await new Response(fetched.stream).text();
    return text ? JSON.parse(text) : null;
}
async function main() {
    let imported = 0;
    let skipped = 0;
    for (const name of BLOB_FILES) {
        process.stdout.write(`  ${name} ... `);
        try {
            const data = await fetchLatestBlob(name);
            if (!data) {
                console.log('no data in blob, skipped');
                skipped++;
                continue;
            }
            await sql `
        INSERT INTO cms_content (key, data, updated_at)
        VALUES (${name}, ${JSON.stringify(data)}, NOW())
        ON CONFLICT (key) DO UPDATE
          SET data       = EXCLUDED.data,
              updated_at = NOW()
      `;
            console.log('imported');
            imported++;
        }
        catch (err) {
            console.log(`ERROR — ${err?.message ?? err}`);
        }
    }
    console.log(`\nDone. ${imported} imported, ${skipped} skipped (no blob data).`);
}
main().catch(err => {
    console.error('[import-blob]', err);
    process.exit(1);
});
//# sourceMappingURL=import-blob.js.map