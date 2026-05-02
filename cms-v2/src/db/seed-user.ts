import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env.local') });

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';

const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q: string): Promise<string> => new Promise(res => rl.question(q, res));

async function main() {
  const email    = await ask('Email:    ');
  const password = await ask('Password: ');
  const role     = (await ask('Role (admin/editor/viewer) [admin]: ')).trim() || 'admin';

  if (!email || !password) { console.error('Email and password are required'); process.exit(1); }
  if (!['admin', 'editor', 'viewer'].includes(role)) { console.error('Invalid role'); process.exit(1); }

  const hash = await bcrypt.hash(password, 12);

  await sql`
    INSERT INTO users (email, password_hash, role)
    VALUES (${email.trim()}, ${hash}, ${role as 'admin' | 'editor' | 'viewer'})
    ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          role          = EXCLUDED.role,
          updated_at    = NOW()
  `;

  console.log(`\n✓ User "${email.trim()}" saved with role "${role}".`);
  rl.close();
}

main().catch(err => { console.error(err); process.exit(1); });
