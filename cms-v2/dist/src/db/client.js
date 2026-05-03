"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sql = void 0;
const serverless_1 = require("@neondatabase/serverless");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../../.env.local') });
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set in environment variables');
}
exports.sql = (0, serverless_1.neon)(connectionString);
//# sourceMappingURL=client.js.map