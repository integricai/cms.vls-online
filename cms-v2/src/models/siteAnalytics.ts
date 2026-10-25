import { createHmac } from 'crypto';
import { sql } from '../db/client';
import { londonToday } from '../../shared/salesFormat';

function visitorSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error('JWT_SECRET is required');
  return secret;
}

export function siteVisitorKey(ip: string, userAgent: string): string {
  return createHmac('sha256', visitorSecret())
    .update(`${ip}\n${userAgent.slice(0, 200)}`)
    .digest('hex');
}

/** Count a person once per London day. Repeats are ignored. */
export async function recordSiteVisitor(ip: string, userAgent: string, now = new Date()): Promise<void> {
  const visitedOn = londonToday(now);
  const visitorKey = siteVisitorKey(ip, userAgent);
  await sql`
    INSERT INTO site_visitors (visited_on, visitor_key)
    VALUES (CAST(${visitedOn} AS date), ${visitorKey})
    ON CONFLICT (visited_on, visitor_key) DO NOTHING
  `;
}

export async function countSiteVisitors(startDate: string, endDate: string): Promise<number> {
  const rows = await sql`
    SELECT COUNT(*)::int AS visitors
    FROM site_visitors
    WHERE visited_on >= CAST(${startDate} AS date)
      AND visited_on <= CAST(${endDate} AS date)
  `;
  return Number((rows[0] as { visitors: number } | undefined)?.visitors ?? 0);
}

export async function recordSiteLead(input: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  await sql`
    INSERT INTO site_leads (email, first_name, last_name, source)
    VALUES (${email}, ${input.firstName.trim() || null}, ${input.lastName.trim() || null}, 'contact_form')
  `;
}

export async function listSiteLeadEmails(startDate: string, endDate: string): Promise<string[]> {
  const rows = await sql`
    SELECT LOWER(email) AS email
    FROM site_leads
    WHERE (created_at AT TIME ZONE 'Europe/London')::date >= CAST(${startDate} AS date)
      AND (created_at AT TIME ZONE 'Europe/London')::date <= CAST(${endDate} AS date)
  `;
  return (rows as Array<{ email: string }>).map(row => row.email).filter(Boolean);
}
