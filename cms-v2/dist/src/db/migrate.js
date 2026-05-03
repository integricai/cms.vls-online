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
    console.log(`Done: ${file}`);
}
async function main() {
    const migrationsDir = path_1.default.resolve(__dirname, 'migrations');
    const files = fs_1.default
        .readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        await runMigration(file);
    }
    console.log('All migrations complete.');
}
main().catch(err => {
    console.error('[migrate]', err);
    process.exit(1);
});
//# sourceMappingURL=migrate.js.map