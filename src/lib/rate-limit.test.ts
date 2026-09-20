import { describe, expect, it } from "vitest";
import { getClientIp, rateLimit } from "./rate-limit";

describe("rateLimit", () => {
  it("allows requests up to the limit, then blocks within the same window", () => {
    const key = `test-${Math.random()}`;
    const now = 1_000_000;

    for (let i = 0; i < 3; i++) {
      const result = rateLimit(key, 3, 60_000, now);
      expect(result.allowed).toBe(true);
    }

    const blocked = rateLimit(key, 3, 60_000, now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets once the window has elapsed", () => {
    const key = `test-${Math.random()}`;
    const windowMs = 60_000;
    const start = 2_000_000;

    rateLimit(key, 1, windowMs, start);
    expect(rateLimit(key, 1, windowMs, start + 1).allowed).toBe(false);
    expect(rateLimit(key, 1, windowMs, start + windowMs + 1).allowed).toBe(true);
  });

  it("tracks independent keys separately", () => {
    const now = 3_000_000;
    rateLimit("a", 1, 60_000, now);
    expect(rateLimit("a", 1, 60_000, now).allowed).toBe(false);
    expect(rateLimit("b", 1, 60_000, now).allowed).toBe(true);
  });
});

describe("getClientIp", () => {
  it("prefers the first entry of x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip, then 'unknown'", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(getClientIp(new Headers())).toBe("unknown");
  });
});
