"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getContent = getContent;
exports.upsertContent = upsertContent;
exports.listContentKeys = listContentKeys;
const client_1 = require("../db/client");
async function getContent(key) {
    const rows = await (0, client_1.sql) `
    SELECT key, data, updated_by, updated_at
    FROM cms_content
    WHERE key = ${key}
  `;
    return rows[0] ?? null;
}
async function upsertContent(key, data, updatedBy) {
    const rows = await (0, client_1.sql) `
    INSERT INTO cms_content (key, data, updated_by, updated_at)
    VALUES (${key}, ${JSON.stringify(data)}, ${updatedBy ?? null}, NOW())
    ON CONFLICT (key) DO UPDATE
      SET data       = EXCLUDED.data,
          updated_by = EXCLUDED.updated_by,
          updated_at = NOW()
    RETURNING key, data, updated_by, updated_at
  `;
    return rows[0];
}
async function listContentKeys() {
    const rows = await (0, client_1.sql) `SELECT key FROM cms_content ORDER BY key`;
    return rows.map((r) => r['key']);
}
//# sourceMappingURL=content.js.map