"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env.local') });
const serverless_1 = require("@neondatabase/serverless");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const readline = __importStar(require("readline"));
const sql = (0, serverless_1.neon)(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise(res => rl.question(q, res));
async function main() {
    const username = await ask('Username: ');
    const password = await ask('Password: ');
    const role = (await ask('Role (admin/editor/viewer) [admin]: ')).trim() || 'admin';
    if (!username || !password) {
        console.error('Username and password are required');
        process.exit(1);
    }
    if (!['admin', 'editor', 'viewer'].includes(role)) {
        console.error('Invalid role');
        process.exit(1);
    }
    const hash = await bcryptjs_1.default.hash(password, 12);
    const cleanUsername = username.trim();
    await sql `
    INSERT INTO users (email, username, password_hash, role)
    VALUES (${cleanUsername}, ${cleanUsername}, ${hash}, ${role})
    ON CONFLICT (username) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = EXCLUDED.role,
          updated_at    = NOW()
  `;
    console.log(`\n✓ User "${cleanUsername}" saved with role "${role}".`);
    rl.close();
}
main().catch(err => { console.error(err); process.exit(1); });
//# sourceMappingURL=seed-user.js.map