type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();

/** Cheap eviction so the map cannot grow without bound on a long-lived instance. */
const prune = (now: number) => {
  if (buckets.size < 5000) return;
  for (const [key, window] of buckets) {
    if (window.resetAt <= now) buckets.delete(key);
  }
};

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window limiter held in process memory.
 *
 * This slows abuse rather than stopping it: serverless instances each keep
 * their own map and cold starts reset it. It is enough to keep a public form
 * from being trivially looped; move to a shared store or a bot check if real
 * abuse shows up.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  prune(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: limit - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000),
    };
  }

  existing.count += 1;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((existing.resetAt - now) / 1000)
  );

  if (existing.count > limit) {
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  return {
    allowed: true,
    remaining: limit - existing.count,
    retryAfterSeconds,
  };
}

/** Best-effort client IP behind Netlify/Cloudflare proxies. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-nf-client-connection-ip');
  if (forwarded) return forwarded;

  const xff = headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]?.trim() || 'unknown';

  return headers.get('x-real-ip') ?? 'unknown';
}
