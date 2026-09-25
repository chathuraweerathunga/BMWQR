import { describe, expect, it } from "vitest";
import {
  computeDueAt,
  normalizeGuestText,
  resolveGuestRequestLocation,
} from "./guest-request-rules";

describe("resolveGuestRequestLocation", () => {
  const both = { scannedLocationId: "pool-4", stayLocationId: "room-208" };

  it("uses the scanned location by default", () => {
    expect(resolveGuestRequestLocation(null, both)).toBe("pool-4");
  });

  it("honours an explicit choice of the guest's room", () => {
    expect(resolveGuestRequestLocation("stay", both)).toBe("room-208");
  });

  it("falls back to the room when nothing was scanned", () => {
    expect(
      resolveGuestRequestLocation("scanned", { scannedLocationId: null, stayLocationId: "room-208" }),
    ).toBe("room-208");
  });

  it("falls back to the scan when the stay has no room", () => {
    expect(
      resolveGuestRequestLocation("stay", { scannedLocationId: "pool-4", stayLocationId: null }),
    ).toBe("pool-4");
  });

  it("returns null when the server knows no location", () => {
    expect(resolveGuestRequestLocation(null, { scannedLocationId: null, stayLocationId: null })).toBeNull();
  });
});

describe("normalizeGuestText", () => {
  it("trims, collapses whitespace and caps length", () => {
    expect(normalizeGuestText("  two   extra\n towels  ", 100)).toBe("two extra towels");
    expect(normalizeGuestText("x".repeat(50), 10)).toHaveLength(10);
  });

  it("treats blank input as missing", () => {
    expect(normalizeGuestText("   ", 10)).toBeNull();
    expect(normalizeGuestText(null, 10)).toBeNull();
  });
});

describe("computeDueAt", () => {
  const now = new Date("2026-09-25T10:00:00Z");

  it("adds the service's estimated minutes", () => {
    expect(computeDueAt(15, now)?.toISOString()).toBe("2026-09-25T10:15:00.000Z");
  });

  it("returns null without a positive estimate", () => {
    expect(computeDueAt(null, now)).toBeNull();
    expect(computeDueAt(0, now)).toBeNull();
  });
});
