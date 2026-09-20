import { describe, expect, it } from "vitest";
import { generateSecureToken, hashToken, safeCompareHex } from "./tokens";

describe("generateSecureToken", () => {
  it("produces a URL-safe token with no padding or unsafe characters", () => {
    const { token } = generateSecureToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a token whose hash matches hashToken(token)", () => {
    const { token, tokenHash } = generateSecureToken();
    expect(tokenHash).toBe(hashToken(token));
  });

  it("never generates the same token twice across many calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const { token } = generateSecureToken();
      expect(seen.has(token)).toBe(false);
      seen.add(token);
    }
  });

  it("respects a custom byte length (longer input, longer token)", () => {
    const short = generateSecureToken(16);
    const long = generateSecureToken(64);
    expect(long.token.length).toBeGreaterThan(short.token.length);
  });
});

describe("hashToken", () => {
  it("is deterministic", () => {
    expect(hashToken("same-input")).toBe(hashToken("same-input"));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashToken("input-a")).not.toBe(hashToken("input-b"));
  });

  it("produces a 64-character hex string (SHA-256)", () => {
    expect(hashToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("safeCompareHex", () => {
  it("returns true for equal hex strings", () => {
    const h = hashToken("some-token");
    expect(safeCompareHex(h, h)).toBe(true);
  });

  it("returns false for different hex strings of the same length", () => {
    expect(safeCompareHex(hashToken("a"), hashToken("b"))).toBe(false);
  });

  it("returns false for different-length inputs without throwing", () => {
    expect(safeCompareHex("ab", "abcd")).toBe(false);
  });
});
