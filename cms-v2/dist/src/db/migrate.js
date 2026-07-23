"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const serverless_1 = require("@neondatabase/serverless");
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env.local') });
const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
}
// Use the unpooled connection for DDL — pooled connections don't support
// multi-statement transactions reliably on Neon.
const sql = (0, serverless_1.neon)(connectionString);
async function ensureMigrationsTable() {
    await sql `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
}
async function getAppliedMigrations() {
    const rows = await sql `SELECT filename FROM schema_migrations`;
    return new Set(rows.map(row => row.filename));
}
async function markMigrationApplied(filename) {
    await sql `
    INSERT INTO schema_migrations (filename)
    VALUES (${filename})
    ON CONFLICT (filename) DO NOTHING
  `;
}
async function tableExists(name) {
    const rows = await sql `
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${name}
    LIMIT 1
  `;
    return rows.length > 0;
}
async function bootstrapExistingSchema(allFiles) {
    const applied = await getAppliedMigrations();
    if (applied.size > 0)
        return;
    if (!(await tableExists('courses')))
        return;
    const hasGeoPrices = await tableExists('course_geo_prices');
    if (!hasGeoPrices)
        return;
    const hasCustomers = await tableExists('customers');
    for (const file of allFiles) {
        if (file === '029_customers_and_sales.sql' && !hasCustomers)
            continue;
        await markMigrationApplied(file);
    }
    console.log('Bootstrapped schema_migrations for an existing database (skipping historical migrations).');
}
async function runMigration(file) {
    const filePath = path_1.default.resolve(__dirname, 'migrations', file);
    const ddl = fs_1.default.readFileSync(filePath, 'utf8');
    console.log(`Running migration: ${file}`);
    // Split on semicolons. Strip single-line comments before checking whether
    // a chunk has real SQL content (avoids filtering chunks that START with a
    // comment block but contain actual DDL on subsequent lines).
    const statements = ddl
        .split(';')
        .map(s => s.trim())
        .filter(s => s.replace(/--[^\n]*/g, '').trim().length > 0);
    for (const statement of statements) {
        try {
            await sql(statement);
        }
        catch (err) {
            if (typeof err === 'object'
                && err !== null
                && 'code' in err
                && err.code === '42710'
                && statement.toUpperCase().startsWith('CREATE TYPE USER_ROLE AS ENUM')) {
                console.log('Skipping existing user_role enum.');
                continue;
            }
            throw err;
        }
    }
    await markMigrationApplied(file);
    console.log(`Done: ${file}`);
}
async function main() {
    await ensureMigrationsTable();
    const migrationsDir = path_1.default.resolve(__dirname, 'migrations');
    const files = fs_1.default
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    await bootstrapExistingSchema(files);
    const applied = await getAppliedMigrations();
    const pending = files.filter(file => !applied.has(file));
    if (pending.length === 0) {
        console.log('No pending migrations.');
        return;
    }
    for (const file of pending) {
        await runMigration(file);
    }
    console.log('All migrations complete.');
}
main().catch(err => {
    console.error('[migrate]', err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map