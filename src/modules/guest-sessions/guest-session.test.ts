import { describe, expect, it } from "vitest";
import {
  computeGuestSessionExpiry,
  DEFAULT_MAX_SESSION_HOURS,
  generateGuestSessionToken,
  hashGuestSessionToken,
  isGuestSessionValid,
} from "./guest-session";
import type { GuestSessionLike, GuestStayLike } from "./types";

describe("generateGuestSessionToken", () => {
  it("produces a token whose hash matches hashGuestSessionToken", () => {
    const { token, tokenHash } = generateGuestSessionToken();
    expect(hashGuestSessionToken(token)).toBe(tokenHash);
  });

  it("never reuses a token across calls", () => {
    const a = generateGuestSessionToken().token;
    const b = generateGuestSessionToken().token;
    expect(a).not.toBe(b);
  });
});

describe("computeGuestSessionExpiry", () => {
  const NOW = new Date("2026-01-10T12:00:00.000Z");

  it("caps a long stay's session at the rolling max, not the full stay length", () => {
    const checkOutInFiveDays = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
    const expiry = computeGuestSessionExpiry(checkOutInFiveDays, NOW);
    const expectedRolling = new Date(NOW.getTime() + DEFAULT_MAX_SESSION_HOURS * 60 * 60 * 1000);
    expect(expiry.getTime()).toBe(expectedRolling.getTime());
    expect(expiry.getTime()).toBeLessThan(checkOutInFiveDays.getTime());
  });

  it("never sets an expiry later than checkout for a short stay", () => {
    const checkOutInTwoHours = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);
    const expiry = computeGuestSessionExpiry(checkOutInTwoHours, NOW);
    expect(expiry.getTime()).toBe(checkOutInTwoHours.getTime());
  });

  it("respects a custom max session length", () => {
    const checkOutInFiveDays = new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000);
    const expiry = computeGuestSessionExpiry(checkOutInFiveDays, NOW, 2);
    expect(expiry.getTime()).toBe(NOW.getTime() + 2 * 60 * 60 * 1000);
  });
});

describe("isGuestSessionValid", () => {
  const NOW = new Date("2026-01-10T12:00:00.000Z");

  function session(overrides: Partial<GuestSessionLike> = {}): GuestSessionLike {
    return {
      expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
      revokedAt: null,
      ...overrides,
    };
  }

  function stay(overrides: Partial<GuestStayLike> = {}): GuestStayLike {
    return {
      status: "ACTIVE",
      checkOutAt: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
      ...overrides,
    };
  }

  it("is valid when session is unexpired/unrevoked and stay is active and not past checkout", () => {
    expect(isGuestSessionValid(session(), stay(), NOW)).toEqual({ valid: true });
  });

  it("is invalid when revoked, even if not yet expired", () => {
    expect(isGuestSessionValid(session({ revokedAt: NOW }), stay(), NOW)).toEqual({
      valid: false,
      reason: "REVOKED",
    });
  });

  it("is invalid when expired", () => {
    expect(
      isGuestSessionValid(
        session({ expiresAt: new Date(NOW.getTime() - 1) }),
        stay(),
        NOW,
      ),
    ).toEqual({ valid: false, reason: "EXPIRED" });
  });

  it("is invalid once the stay is no longer ACTIVE (checked out or cancelled)", () => {
    expect(
      isGuestSessionValid(session(), stay({ status: "EXPIRED" }), NOW),
    ).toEqual({ valid: false, reason: "STAY_NOT_ACTIVE" });
    expect(
      isGuestSessionValid(session(), stay({ status: "CANCELLED" }), NOW),
    ).toEqual({ valid: false, reason: "STAY_NOT_ACTIVE" });
  });

  it("is invalid once checkout time has passed, even if the session token itself hasn't expired", () => {
    expect(
      isGuestSessionValid(
        session({ expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000) }),
        stay({ checkOutAt: new Date(NOW.getTime() - 1) }),
        NOW,
      ),
    ).toEqual({ valid: false, reason: "STAY_EXPIRED" });
  });
});
