import { afterEach, describe, expect, it, vi } from "vitest";
import { getClientIp, rateLimit, rateLimitInMemory } from "./rate-limit";

describe("rateLimitInMemory", () => {
  it("allows requests up to the limit, then blocks within the same window", () => {
    const key = `test-${Math.random()}`;
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      expect(rateLimitInMemory(key, 3, 60_000, now).allowed).toBe(true);
    }

    const blocked = rateLimitInMemory(key, 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets once the window has elapsed", () => {
    const key = `test-${Math.random()}`;
    const windowMs = 60_000;
    const start = 2_000_000;

    rateLimitInMemory(key, 1, windowMs, start);
    expect(rateLimitInMemory(key, 1, windowMs, start + 1).allowed).toBe(false);
    expect(rateLimitInMemory(key, 1, windowMs, start + windowMs + 1).allowed).toBe(true);
  });

  it("tracks independent keys separately", () => {
    const now = 3_000_000;
    rateLimitInMemory("a", 1, 60_000, now);
    expect(rateLimitInMemory("a", 1, 60_000, now).allowed).toBe(false);
    expect(rateLimitInMemory("b", 1, 60_000, now).allowed).toBe(true);
  });
});

describe("rateLimit (Redis backend)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function stubRedis(count: number, pttl: number) {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify([{ result: count }, { result: 1 }, { result: pttl }])),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("uses the shared counter when Redis is configured", async () => {
    const fetchMock = stubRedis(2, 30_000);
    const result = await rateLimit("k", 5, 60_000);
    expect(result).toEqual({ allowed: true, remaining: 3, retryAfterSeconds: 0 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("blocks once the shared counter passes the limit", async () => {
    stubRedis(6, 12_500);
    const result = await rateLimit("k", 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(13);
  });

  it("falls back to in-memory limits when Redis is unreachable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.example");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "t");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("down"); }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const key = `fallback-${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).allowed).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).allowed).toBe(false);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry of x-forwarded-for when no platform header is set", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.5");
  });

  it("prefers the platform-set x-real-ip over a client-supplied x-forwarded-for", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7", "x-forwarded-for": "1.2.3.4" });
    expect(getClientIp(headers)).toBe("198.51.100.7");
  });

  it("falls back to 'unknown'", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
