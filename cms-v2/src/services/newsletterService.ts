import { getCustomerById, upsertCustomer } from '../models/customer';
import { sql } from '../db/client';
import {
  mailerliteConfigured,
  unsubscribeMailerLiteSubscriber,
  upsertMailerLiteSubscriber,
} from './mailerliteSubscribers';

export type NewsletterSubscribeResult = {
  email: string;
  subscribed: boolean;
  customerId: number;
  mailerliteSubscriberId: string | null;
  alreadySubscribed: boolean;
};

async function setNewsletterFlags(input: {
  customerId: number;
  subscribed: boolean;
  mailerliteSubscriberId?: string | null;
}): Promise<void> {
  if (input.subscribed) {
    await sql`
      UPDATE customers
      SET newsletter_subscribed = TRUE,
          newsletter_subscribed_at = COALESCE(newsletter_subscribed_at, NOW()),
          mailerlite_subscriber_id = COALESCE(${input.mailerliteSubscriberId ?? null}, mailerlite_subscriber_id),
          updated_at = NOW()
      WHERE id = ${input.customerId}
    `;
    return;
  }

  await sql`
    UPDATE customers
    SET newsletter_subscribed = FALSE,
        mailerlite_subscriber_id = COALESCE(${input.mailerliteSubscriberId ?? null}, mailerlite_subscriber_id),
        updated_at = NOW()
    WHERE id = ${input.customerId}
  `;
}

export async function subscribeToNewsletter(input: {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<NewsletterSubscribeResult> {
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('A valid email address is required');
  }

  const existing = await upsertCustomer({
    email,
    firstName: input.firstName ?? null,
    lastName: input.lastName ?? null,
    source: 'newsletter',
  });

  const alreadySubscribed = existing.newsletterSubscribed;

  let mailerliteSubscriberId = existing.mailerliteSubscriberId;
  if (mailerliteConfigured()) {
    const subscriber = await upsertMailerLiteSubscriber({
      email,
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      resubscribe: true,
    });
    mailerliteSubscriberId = subscriber.id;
  }

  await setNewsletterFlags({
    customerId: existing.id,
    subscribed: true,
    mailerliteSubscriberId,
  });

  // Refresh subscribed_at when newly (re)subscribed
  if (!alreadySubscribed) {
    await sql`
      UPDATE customers
      SET newsletter_subscribed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${existing.id}
    `;
  }

  return {
    email,
    subscribed: true,
    customerId: existing.id,
    mailerliteSubscriberId,
    alreadySubscribed,
  };
}

export async function setStudentNewsletterSubscription(input: {
  customerId: number;
  subscribed: boolean;
}): Promise<NewsletterSubscribeResult> {
  const customer = await getCustomerById(input.customerId);
  if (!customer) throw new Error('Student not found');

  let mailerliteSubscriberId = customer.mailerliteSubscriberId;

  if (input.subscribed) {
    if (mailerliteConfigured()) {
      const subscriber = await upsertMailerLiteSubscriber({
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        resubscribe: true,
      });
      mailerliteSubscriberId = subscriber.id;
    }
    await setNewsletterFlags({
      customerId: customer.id,
      subscribed: true,
      mailerliteSubscriberId,
    });
    if (!customer.newsletterSubscribed) {
      await sql`
        UPDATE customers
        SET newsletter_subscribed_at = NOW(),
            updated_at = NOW()
        WHERE id = ${customer.id}
      `;
    }
  } else {
    if (mailerliteConfigured()) {
      const subscriber = await unsubscribeMailerLiteSubscriber({
        email: customer.email,
        subscriberId: customer.mailerliteSubscriberId,
      });
      if (subscriber) mailerliteSubscriberId = subscriber.id;
    }
    await setNewsletterFlags({
      customerId: customer.id,
      subscribed: false,
      mailerliteSubscriberId,
    });
  }

  return {
    email: customer.email,
    subscribed: input.subscribed,
    customerId: customer.id,
    mailerliteSubscriberId,
    alreadySubscribed: customer.newsletterSubscribed && input.subscribed,
  };
}
