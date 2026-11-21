import {
  claimDueFollowups,
  claimFollowupStep,
  getFailedPayment,
  listFailedPayments,
  recordAbandonedCheckouts,
  releaseFollowupClaim,
  stopPurchasedFollowups,
  touchFollowupStep,
  type FailedPaymentRecord,
} from '../models/checkoutFollowup';
import { checkoutFollowupMessage, sendCheckoutFollowupEmail, type CheckoutFollowupStep } from './paymentEmails';

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
        firstName: followup.firstName,
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

/** Sends all three emails for a sample course to one address. Writes nothing to the database. */
export async function sendCheckoutFollowupSamples(to: string): Promise<string[]> {
  const subjects: string[] = [];
  for (const step of [1, 2, 3] as const) {
    const input = {
      step,
      courseTitle: 'ACCA FR (F7) - Financial Reporting',
      courseUrl: followupCourseUrl('/courses/acca-fr-financial-reporting'),
      unsubscribeUrl: followupUnsubscribeUrl('sample'),
      whatsappNumber: process.env.CHECKOUT_FOLLOWUP_WHATSAPP?.trim() || DEFAULT_FOLLOWUP_WHATSAPP,
    };
    await sendCheckoutFollowupEmail({ ...input, to });
    subjects.push(checkoutFollowupMessage(input).subject);
  }
  return subjects;
}

export interface FailedPaymentRow {
  id: number;
  abandonedAt: string;
  courseTitle: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  emailSentAt: string | null;
  secondEmailSentAt: string | null;
  thirdEmailSentAt: string | null;
  purchased: boolean;
  canResend: boolean;
}

export class CheckoutFollowupResendError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'CheckoutFollowupResendError';
    this.status = status;
  }
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toFailedPaymentRow(row: FailedPaymentRecord): FailedPaymentRow {
  return {
    id: row.id,
    abandonedAt: row.abandonedAt.toISOString(),
    courseTitle: row.courseTitle,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    emailSentAt: iso(row.followup1SentAt),
    secondEmailSentAt: iso(row.followup2SentAt),
    thirdEmailSentAt: iso(row.followup3SentAt),
    purchased: row.purchased,
    canResend: row.canResend,
  };
}

/** The next reminder that has not gone out. The third is sent again once all three have. */
export function nextManualFollowupStep(row: {
  followup1SentAt: Date | null;
  followup2SentAt: Date | null;
  followup3SentAt: Date | null;
}): CheckoutFollowupStep {
  if (!row.followup1SentAt) return 1;
  if (!row.followup2SentAt) return 2;
  return 3;
}

/** Records new closed checkouts, stops anyone who has paid, then lists the period. */
export async function listFailedPaymentsForVault(start: string, end: string): Promise<FailedPaymentRow[]> {
  await recordAbandonedCheckouts();
  await stopPurchasedFollowups();
  const rows = await listFailedPayments(start, end);
  return rows.map(toFailedPaymentRow);
}

export async function resendFailedPaymentEmail(id: number): Promise<FailedPaymentRow> {
  const row = await getFailedPayment(id);
  if (!row) throw new CheckoutFollowupResendError('That failed payment could not be found.', 404);
  if (!row.canResend) {
    throw new CheckoutFollowupResendError('This reminder has stopped.', 409);
  }
  const step = nextManualFollowupStep(row);
  const resending = step === 3 && row.followup3SentAt != null;
  if (!resending) {
    const claimed = await claimFollowupStep(id, step);
    if (!claimed) throw new CheckoutFollowupResendError('That reminder was just sent. Refresh the list.', 409);
  }
  try {
    await sendCheckoutFollowupEmail({
      to: row.email,
      step,
      firstName: row.firstName,
      courseTitle: row.courseTitle,
      courseUrl: followupCourseUrl(row.coursePageUrl),
      unsubscribeUrl: followupUnsubscribeUrl(row.unsubscribeToken),
      whatsappNumber: process.env.CHECKOUT_FOLLOWUP_WHATSAPP?.trim() || DEFAULT_FOLLOWUP_WHATSAPP,
    });
  } catch (err) {
    if (!resending) {
      await releaseFollowupClaim(id, step).catch(releaseErr => {
        console.error(`[checkout-followups] could not release row ${id}`, releaseErr);
      });
    }
    throw err;
  }
  if (resending) await touchFollowupStep(id, step);
  const updated = await getFailedPayment(id);
  if (!updated) throw new CheckoutFollowupResendError('That failed payment could not be found.', 404);
  return toFailedPaymentRow(updated);
}
