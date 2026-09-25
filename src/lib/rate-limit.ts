/**
 * Fixed-window rate limiter with two backends behind one async function:
 *
 *  - **Redis (Upstash REST)** when `UPSTASH_REDIS_REST_URL` and
 *    `UPSTASH_REDIS_REST_TOKEN` are set. Counters are shared by every
 *    server instance, which is what makes limits meaningful on Vercel,
 *    where each request can land on a different serverless instance.
 *    Uses plain `fetch` against Upstash's REST API: no SDK, no TCP
 *    connection to manage from a serverless function.
 *  - **In-process memory** otherwise (local dev, tests, a single server).
 *    Correct for one instance; per-instance only on multi-instance hosts.
 *
 * If Redis is configured but unreachable, the limiter falls back to the
 * in-memory backend for that call rather than failing the request: an
 * outage in a supporting system should degrade abuse protection, not take
 * guest services down (project instructions section 17: Redis is a
 * supporting system, not a dependency of the core flow).
 *
 * Used for QR scan / activation abuse protection (sections 6, 44), login
 * brute-force protection, and guest spam limits (section 32).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// Bound memory growth from one-off keys (e.g. an IP seen once). `unref()`
// keeps this timer from ever holding a script or test process open.
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

function resultFor(count: number, limit: number, msUntilReset: number): RateLimitResult {
  if (count > limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil(msUntilReset / 1000)),
    };
  }
  return { allowed: true, remaining: limit - count, retryAfterSeconds: 0 };
}

/**
 * The in-memory backend. Synchronous and clock-injectable so the windowing
 * logic can be unit tested deterministically.
 */
export function rateLimitInMemory(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return resultFor(1, limit, windowMs);
  }
  // Stop counting once over the limit so a flood can't grow the counter
  // without bound; the answer is the same either way.
  if (bucket.count <= limit) bucket.count += 1;
  return resultFor(bucket.count, limit, bucket.resetAt - now);
}

interface RedisConfig {
  url: string;
  token: string;
}

function redisConfig(): RedisConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

const REDIS_TIMEOUT_MS = 1_500;

async function rateLimitRedis(
  config: RedisConfig,
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // INCR creates the key at 1 if missing; PEXPIRE ... NX sets the window
  // only on the first hit, so the window is fixed, not sliding; PTTL tells
  // the caller how long until it resets.
  const redisKey = `oneweb:rl:${key}`;
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
    signal: AbortSignal.timeout(REDIS_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Upstash responded ${response.status}`);
  }
  const results = (await response.json()) as Array<{ result?: unknown; error?: string }>;
  const count = Number(results[0]?.result);
  const pttl = Number(results[2]?.result);
  if (!Number.isFinite(count)) {
    throw new Error(`Unexpected Upstash response: ${results[0]?.error ?? "no result"}`);
  }
  return resultFor(count, limit, pttl > 0 ? pttl : windowMs);
}

let warnedAboutRedis = false;

/**
 * Checks and consumes one unit of `key`'s quota for this window.
 *
 * @param key identifies who/what is limited, e.g. `qr-scan:${ip}`. Callers
 *   namespace their own keys so different limiters never collide.
 * @param limit max requests allowed per window
 * @param windowMs window length in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const config = redisConfig();
  if (config) {
    try {
      return await rateLimitRedis(config, key, limit, windowMs);
    } catch (err) {
      if (!warnedAboutRedis) {
        warnedAboutRedis = true;
        console.error("[rate-limit] Redis unavailable, falling back to in-memory limits", err);
      }
    }
  }
  return rateLimitInMemory(key, limit, windowMs);
}

/** Minimal shape both a Route Handler's `Request.headers` and a Server
 * Action's `next/headers` `headers()` result satisfy. */
interface HeaderReader {
  get(name: string): string | null;
}

/**
 * Best-effort client IP for abuse throttling only, never for authorization.
 * Prefers the headers set by the hosting platform's edge (Vercel sets
 * `x-real-ip` and overwrites `x-forwarded-for`, so neither is
 * client-controlled there), then falls back to the first
 * `x-forwarded-for` entry.
 */
export function getClientIp(headers: HeaderReader): string {
  const vercel = headers.get("x-vercel-forwarded-for");
  if (vercel) return vercel.split(",")[0].trim();
  const realIp = headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return "unknown";
}
