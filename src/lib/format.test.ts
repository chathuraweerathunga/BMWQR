import { describe, expect, it } from "vitest";
import { formatDuration, formatTime, humanizeEnum, timeAgo, utcToZonedLocal, zonedLocalToUtc } from "./format";

describe("format helpers", () => {
  it("shows times in the business's timezone, not the server's", () => {
    const date = new Date("2026-09-25T04:00:00Z");
    expect(formatTime(date, "Asia/Colombo")).toBe("09:30");
    expect(formatTime(date, "Europe/London")).toBe("05:00");
  });

  it("falls back to UTC for an invalid timezone instead of throwing", () => {
    expect(formatTime(new Date("2026-09-25T04:00:00Z"), "Not/AZone")).toBe("04:00");
  });

  it("describes relative time coarsely", () => {
    const now = new Date("2026-09-25T10:00:00Z");
    expect(timeAgo(new Date("2026-09-25T09:59:50Z"), now)).toBe("just now");
    expect(timeAgo(new Date("2026-09-25T09:48:00Z"), now)).toBe("12 min ago");
    expect(timeAgo(new Date("2026-09-25T07:00:00Z"), now)).toBe("3 h ago");
  });

  it("formats durations and enums for people", () => {
    expect(formatDuration(65)).toBe("1 h 5 min");
    expect(formatDuration(null)).toBe("—");
    expect(humanizeEnum("SPA_ROOM")).toBe("Spa room");
  });
});

describe("zonedLocalToUtc", () => {
  it("reads a typed time as the property's local time", () => {
    // 11:00 in Colombo (UTC+05:30) is 05:30 UTC.
    expect(zonedLocalToUtc("2026-09-26T11:00", "Asia/Colombo")?.toISOString()).toBe("2026-09-26T05:30:00.000Z");
    expect(zonedLocalToUtc("2026-09-26T11:00", "UTC")?.toISOString()).toBe("2026-09-26T11:00:00.000Z");
  });

  it("handles daylight saving time", () => {
    // London is UTC+1 in summer, UTC+0 in winter.
    expect(zonedLocalToUtc("2026-07-01T11:00", "Europe/London")?.toISOString()).toBe("2026-07-01T10:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-01T11:00", "Europe/London")?.toISOString()).toBe("2026-12-01T11:00:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(zonedLocalToUtc("tomorrow", "UTC")).toBeNull();
  });

  it("round-trips with utcToZonedLocal", () => {
    const utc = zonedLocalToUtc("2026-09-26T11:00", "Asia/Colombo")!;
    expect(utcToZonedLocal(utc, "Asia/Colombo")).toBe("2026-09-26T11:00");
  });
});
