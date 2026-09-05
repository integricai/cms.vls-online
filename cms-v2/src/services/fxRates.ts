import { fetchWithTimeout } from '../utils/fetchWithTimeout';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FX_URL = 'https://open.er-api.com/v6/latest/USD';

type FxCache = {
  rates: Record<string, number>;
  fetchedAt: number;
};

let cache: FxCache | null = null;
let inflight: Promise<Record<string, number> | null> | null = null;

function parseRates(body: unknown): Record<string, number> | null {
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const rates = record.rates;
  if (!rates || typeof rates !== 'object') return null;

  const parsed: Record<string, number> = { USD: 1 };
  for (const [code, value] of Object.entries(rates as Record<string, unknown>)) {
    const rate = Number(value);
    if (Number.isFinite(rate) && rate > 0) {
      parsed[code.toUpperCase()] = rate;
    }
  }
  return Object.keys(parsed).length > 1 ? parsed : null;
}

async function fetchUsdRates(): Promise<Record<string, number> | null> {
  try {
    const response = await fetchWithTimeout(FX_URL, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeoutMs: 5_000,
    });
    if (!response.ok) {
      console.warn('[fx-rates] FX API failed', response.status);
      return null;
    }
    return parseRates(await response.json());
  } catch (err) {
    console.warn('[fx-rates] FX API error', err);
    return null;
  }
}

export async function getUsdRates(): Promise<Record<string, number> | null> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.rates;
  }
  if (!inflight) {
    inflight = fetchUsdRates()
      .then(rates => {
        if (rates) cache = { rates, fetchedAt: Date.now() };
        return rates;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function rateForCurrency(
  rates: Record<string, number> | null | undefined,
  currency: string,
): number | null {
  if (currency.toUpperCase() === 'USD') return 1;
  const rate = rates?.[currency.toUpperCase()];
  return rate != null && rate > 0 ? rate : null;
}

/** Test helper — clears in-memory FX cache. */
export function resetFxRatesCache(): void {
  cache = null;
  inflight = null;
}
