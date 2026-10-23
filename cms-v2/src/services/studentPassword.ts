/**
 * Chosen school passwords stay encrypted on the pending order.
 * They are applied only when Zenler has no account for that email, then deleted.
 */

import { sql } from '../db/client';
import { encryptStudentPassword, decryptStudentPassword } from './studentPasswordCrypto';

export {
  decryptStudentPassword,
  encryptStudentPassword,
  normalizeStudentEmail,
  parseChosenPassword,
} from './studentPasswordCrypto';

let secretsTableReady: Promise<void> | null = null;

async function ensureSecretsTable(): Promise<void> {
  if (!secretsTableReady) {
    secretsTableReady = sql`
      CREATE TABLE IF NOT EXISTS payment_order_secrets (
        order_id INTEGER PRIMARY KEY,
        password_ciphertext TEXT,
        student_chose_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(() => undefined).catch((err: unknown) => {
      secretsTableReady = null;
      throw err;
    });
  }
  await secretsTableReady;
}

export async function saveStudentPassword(orderId: number, password: string): Promise<void> {
  const ciphertext = encryptStudentPassword(password);
  await ensureSecretsTable();
  await sql`
    INSERT INTO payment_order_secrets (order_id, password_ciphertext, student_chose_password)
    VALUES (${orderId}, ${ciphertext}, FALSE)
    ON CONFLICT (order_id) DO UPDATE
      SET password_ciphertext = EXCLUDED.password_ciphertext
  `;
}

export async function readStudentPassword(orderId: number): Promise<string | null> {
  await ensureSecretsTable();
  const rows = await sql`
    SELECT password_ciphertext
    FROM payment_order_secrets
    WHERE order_id = ${orderId}
  `;
  const ciphertext = rows[0]?.password_ciphertext;
  if (typeof ciphertext !== 'string' || !ciphertext) return null;
  return decryptStudentPassword(ciphertext);
}

export async function clearStudentPassword(orderId: number): Promise<void> {
  await ensureSecretsTable();
  await sql`
    UPDATE payment_order_secrets
    SET password_ciphertext = NULL
    WHERE order_id = ${orderId}
  `;
}

export async function markStudentChosePassword(orderId: number): Promise<void> {
  await ensureSecretsTable();
  await sql`
    INSERT INTO payment_order_secrets (order_id, password_ciphertext, student_chose_password)
    VALUES (${orderId}, NULL, TRUE)
    ON CONFLICT (order_id) DO UPDATE
      SET password_ciphertext = NULL,
          student_chose_password = TRUE
  `;
}

export async function didStudentChoosePassword(orderId: number): Promise<boolean> {
  await ensureSecretsTable();
  const rows = await sql`
    SELECT student_chose_password
    FROM payment_order_secrets
    WHERE order_id = ${orderId}
  `;
  return rows[0]?.student_chose_password === true;
}
