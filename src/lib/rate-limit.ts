/**
 * Fixed-window rate limiter, in-process only.
 *
 * Deliberately NOT Redis-backed (project instructions section 17: don't
 * introduce infrastructure before a real requirement forces it) — this is
 * correct for a single Next.js server instance and becomes a liability
 * the moment the app runs on more than one instance/region, because each
 * instance keeps its own counters. TODO before a multi-instance
 * deployment: swap the `Map` below for a Redis `INCR`+`EXPIRE` pair behind
 * the same `rateLimit()` signature — every call site here is already
 * written against that interface, not against `Map` directly.
 *
 * Used to satisfy project instructions section 6 (QR scan abuse
 * protection), section 44 ("Public QR endpoints require special
 * protection... rate-limit public endpoints"), and section 32 (general
 * rate limiting / abuse detection).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound memory growth from one-off keys (e.g. an IP seen once). Runs only
// in long-lived server processes — harmless no-op cost anywhere else, and
// `unref()` keeps it from ever being the reason a script/test process
// hangs waiting to exit.
const CLEANUP_INTERVAL_MS = 60_000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref?.();

export interface RateLimitResult {
  allowed: boolean;
  /** Requests remaining in the current window if allowed; 0 if not. */
  remaining: number;
  /** How long the caller should wait before retrying, in seconds. 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * Checks and consumes one unit of `key`'s quota for this window.
 *
 * @param key a string that identifies who/what is being limited, e.g.
 *   `qr-scan:${ip}` or `feedback:${guestSessionId}` — callers must
 *   namespace their own keys so different limiters never collide.
 * @param limit max requests allowed per window
 * @param windowMs window length in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

/** Minimal shape both a Route Handler's `Request.headers` and a Server
 * Action's `next/headers` `headers()` result satisfy, so this helper works
 * in either context. */
interface HeaderReader {
  get(name: string): string | null;
}

/** Best-effort client IP extraction behind a proxy/load balancer. Never
 * trust this for authorization decisions — only for coarse abuse
 * throttling, where an attacker spoofing it just makes their own rate
 * limiting less effective, not more. */
export function getClientIp(headers: HeaderReader): string {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return headers.get("x-real-ip") ?? "unknown";
}
