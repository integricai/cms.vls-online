"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllSnippets = getAllSnippets;
exports.getSnippetById = getSnippetById;
exports.getSnippetByKey = getSnippetByKey;
exports.createSnippet = createSnippet;
exports.updateSnippet = updateSnippet;
exports.deleteSnippet = deleteSnippet;
const client_1 = require("../db/client");
async function getAllSnippets() {
    const rows = await (0, client_1.sql) `
    SELECT * FROM snippets ORDER BY updated_at DESC
  `;
    return rows;
}
async function getSnippetById(id) {
    const rows = await (0, client_1.sql) `
    SELECT * FROM snippets WHERE id = ${id} LIMIT 1
  `;
    return rows[0] ?? null;
}
async function getSnippetByKey(key) {
    const rows = await (0, client_1.sql) `
    SELECT * FROM snippets WHERE key = ${key} LIMIT 1
  `;
    return rows[0] ?? null;
}
async function createSnippet(input, createdBy) {
    const rows = await (0, client_1.sql) `
    INSERT INTO snippets (key, title, html, meta, created_by, created_at, updated_at)
    VALUES (
      ${input.key},
      ${input.title},
      ${input.html},
      ${JSON.stringify(input.meta)},
      ${createdBy},
      NOW(),
      NOW()
    )
    RETURNING *
  `;
    return rows[0];
}
async function updateSnippet(id, input) {
    const rows = await (0, client_1.sql) `
    UPDATE snippets
    SET
      key        = COALESCE(${input.key ?? null}, key),
      title      = COALESCE(${input.title ?? null}, title),
      html       = COALESCE(${input.html ?? null}, html),
      meta       = COALESCE(${input.meta ? JSON.stringify(input.meta) : null}::jsonb, meta),
      updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;
    return rows[0] ?? null;
}
async function deleteSnippet(id) {
    const rows = await (0, client_1.sql) `
    DELETE FROM snippets WHERE id = ${id} RETURNING id
  `;
    return rows.length > 0;
}
//# sourceMappingURL=snippet.js.map