type PgErrorFields = {
  code?: string;
  constraint?: string;
  message?: string;
  cause?: PgErrorFields;
};

function pgFields(err: unknown): PgErrorFields {
  if (typeof err !== 'object' || err === null) return {};
  const error = err as PgErrorFields;
  const cause = error.cause && typeof error.cause === 'object' ? error.cause : undefined;
  return {
    code: error.code || cause?.code,
    constraint: error.constraint || cause?.constraint,
    message: error.message || cause?.message,
  };
}

function mentions(fields: PgErrorFields, name: string): boolean {
  return `${fields.constraint ?? ''} ${fields.message ?? ''}`.includes(name);
}

/**
 * Turn a failed price write into a message an admin can act on.
 * Known database rules get a specific sentence. Anything else keeps the exception text.
 */
export function priceWriteFailure(
  err: unknown,
  durationDays?: number | null,
): { status: number; error: string } {
  const fields = pgFields(err);

  if (fields.code === '23505') {
    if (mentions(fields, 'course_geo_prices_active_slot_idx')) {
      const days = Number.isInteger(durationDays) && (durationDays ?? 0) > 0
        ? `${durationDays} days`
        : 'that duration';
      return {
        status: 409,
        error: `This course already has an active price for ${days}. Deactivate that price or choose a different duration.`,
      };
    }
    if (mentions(fields, 'course_geo_prices_one_active_default_idx')) {
      return {
        status: 409,
        error: 'This course already has an active default price. Clear the other default first.',
      };
    }
    if (mentions(fields, 'course_geo_prices_zenler_pricing_code_idx')) {
      return {
        status: 409,
        error: 'Another price on this course already uses that Zenler pricing code.',
      };
    }
    return { status: 409, error: 'A price with these details already exists.' };
  }

  if (fields.code === '23514') {
    if (mentions(fields, 'course_geo_prices_amount_positive')) {
      return { status: 400, error: 'List price must be 0 or greater.' };
    }
    if (mentions(fields, 'course_geo_prices_discount_percent_range')) {
      return { status: 400, error: 'Discount must be between 0 and 100.' };
    }
    if (mentions(fields, 'course_geo_prices_discounted_price_valid')) {
      return { status: 400, error: 'The discounted price must be between 0 and the list price.' };
    }
    if (mentions(fields, 'course_geo_prices_duration_days_positive')) {
      return { status: 400, error: 'Duration must be a whole number of days greater than 0.' };
    }
    if (mentions(fields, 'course_geo_prices_duration_months_range')) {
      return { status: 400, error: 'Duration is outside the supported range.' };
    }
    return {
      status: 400,
      error: 'This price does not meet a pricing rule. Check the amount, discount, and duration.',
    };
  }

  if (fields.code === '23503') {
    return {
      status: 409,
      error: 'This price is linked to a payment or sale, so that change was rejected.',
    };
  }

  const message = err instanceof Error ? err.message.trim() : '';
  return {
    status: 500,
    error: message || 'The price could not be saved.',
  };
}
