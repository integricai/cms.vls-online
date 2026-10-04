export interface RateLimitDecision {
  allowed: boolean;
  hitCount: number;
  windowStartedAt: number;
  retryAfterSec: number;
}

export function nextRateLimitState(
  existing: { windowStartedAt: number; hitCount: number } | null,
  now: number,
  windowMs: number,
  limit: number,
): RateLimitDecision {
  const windowOpen = existing != null && now - existing.windowStartedAt < windowMs;
  const windowStartedAt = windowOpen ? existing.windowStartedAt : now;
  const hitCount = windowOpen ? existing.hitCount + 1 : 1;
  const retryAfterSec = Math.max(1, Math.ceil((windowStartedAt + windowMs - now) / 1000));
  return {
    allowed: hitCount <= limit,
    hitCount,
    windowStartedAt,
    retryAfterSec,
  };
}
