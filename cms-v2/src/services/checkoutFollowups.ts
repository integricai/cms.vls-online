import {
  claimDueFollowups,
  recordAbandonedCheckouts,
  releaseFollowupClaim,
  stopPurchasedFollowups,
} from '../models/checkoutFollowup';
import { sendCheckoutFollowupEmail } from './paymentEmails';

const SITE_URL = 'https://vls-online.com';
const API_URL = 'https://api.cms.vls-online.com';
/** Same WhatsApp number as the website's Contact us page. */
export const DEFAULT_FOLLOWUP_WHATSAPP = '+44 7446 426261';
/** Keeps one cron run well inside the 60 s function limit. */
const MAX_EMAILS_PER_RUN = 25;

export interface CheckoutFollowupRunResult {
  sendingEnabled: boolean;
  recorded: number;
  stoppedPurchased: number;
  sent: number;
  failed: number;
}

export function checkoutFollowupsSendingEnabled(): boolean {
  return process.env.CHECKOUT_FOLLOWUPS_SEND === 'on';
}

export function followupCourseUrl(coursePageUrl: string | null): string {
  const value = coursePageUrl?.trim();
  if (!value) return `${SITE_URL}/`;
  if (/^https?:\/\//i.test(value)) return value;
  return `${SITE_URL}${value.startsWith('/') ? '' : '/'}${value}`;
}

export function followupUnsubscribeUrl(token: string): string {
  const base = (process.env.CHECKOUT_FOLLOWUP_API_URL?.trim() || API_URL).replace(/\/+$/, '');
  return `${base}/api/public/checkout-followups/unsubscribe?token=${encodeURIComponent(token)}`;
}

/**
 * One cron run: record newly abandoned checkouts, stop anyone who has paid,
 * then send whatever is due. Sending only happens when CHECKOUT_FOLLOWUPS_SEND=on;
 * otherwise rows are still recorded and stopped so the table can be checked first.
 */
export async function runCheckoutFollowups(): Promise<CheckoutFollowupRunResult> {
  const recorded = await recordAbandonedCheckouts();
  const stoppedPurchased = await stopPurchasedFollowups();
  const result: CheckoutFollowupRunResult = {
    sendingEnabled: checkoutFollowupsSendingEnabled(),
    recorded,
    stoppedPurchased,
    sent: 0,
    failed: 0,
  };
  if (!result.sendingEnabled) return result;

  const due = await claimDueFollowups(MAX_EMAILS_PER_RUN);
  for (const followup of due) {
    try {
      await sendCheckoutFollowupEmail({
        to: followup.email,
        step: followup.step,
        courseTitle: followup.courseTitle,
        courseUrl: followupCourseUrl(followup.coursePageUrl),
        unsubscribeUrl: followupUnsubscribeUrl(followup.unsubscribeToken),
        whatsappNumber: process.env.CHECKOUT_FOLLOWUP_WHATSAPP?.trim() || DEFAULT_FOLLOWUP_WHATSAPP,
      });
      result.sent += 1;
    } catch (err) {
      result.failed += 1;
      console.error(`[checkout-followups] email ${followup.step} for row ${followup.id} failed`, err);
      await releaseFollowupClaim(followup.id, followup.step).catch(releaseErr => {
        console.error(`[checkout-followups] could not release row ${followup.id}`, releaseErr);
      });
    }
  }
  return result;
}
