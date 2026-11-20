/**
 * Sends the three checkout follow-up emails to one address so they can be checked
 * before CHECKOUT_FOLLOWUPS_SEND is switched on. Nothing is written to the database.
 *
 * PowerShell:
 *   $env:MAILERSEND_API_KEY = '<key from Vercel>'
 *   npx ts-node scripts/send-checkout-followup-samples.ts you@example.com
 *
 * Preview only (writes HTML files, sends nothing):
 *   npx ts-node scripts/send-checkout-followup-samples.ts --preview <folder>
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { checkoutFollowupMessage, sendCheckoutFollowupEmail, type CheckoutFollowupStep } from '../src/services/paymentEmails';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SITE_URL = 'https://vls-online.com';
const WHATSAPP = '+44 7446 426261';
const sample = {
  courseTitle: 'ACCA FR (F7) - Financial Reporting',
  courseUrl: `${SITE_URL}/courses/acca-fr-financial-reporting`,
  unsubscribeUrl: 'https://api.cms.vls-online.com/api/public/checkout-followups/unsubscribe?token=sample',
  whatsappNumber: WHATSAPP,
};
const steps: CheckoutFollowupStep[] = [1, 2, 3];

async function main(): Promise<void> {
  const [first, second] = process.argv.slice(2);

  if (first === '--preview') {
    const folder = path.resolve(second ?? 'checkout-followup-preview');
    fs.mkdirSync(folder, { recursive: true });
    for (const step of steps) {
      const message = checkoutFollowupMessage({ ...sample, step });
      fs.writeFileSync(path.join(folder, `followup-${step}.html`), message.html);
      fs.writeFileSync(path.join(folder, `followup-${step}.txt`), `Subject: ${message.subject}\n\n${message.text}`);
      console.log(`Email ${step}: ${message.subject}`);
    }
    console.log(`Preview files written to ${folder}`);
    return;
  }

  const to = first?.trim();
  if (!to || !to.includes('@')) {
    console.error('Usage: npx ts-node scripts/send-checkout-followup-samples.ts you@example.com');
    process.exit(1);
  }
  if (!process.env.MAILERSEND_API_KEY) {
    console.error('Set MAILERSEND_API_KEY first (copy it from Vercel > cms-vls-online-q8ht > Settings > Environment Variables).');
    process.exit(1);
  }

  for (const step of steps) {
    const message = checkoutFollowupMessage({ ...sample, step });
    await sendCheckoutFollowupEmail({ ...sample, step, to });
    console.log(`Sent email ${step}: ${message.subject}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
