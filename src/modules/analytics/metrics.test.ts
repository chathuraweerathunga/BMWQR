import { describe, expect, it } from "vitest";
import { computeAverageTimings, isOverdue } from "./metrics";

const base = new Date("2026-01-01T00:00:00.000Z");
function minutesAfter(minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

describe("computeAverageTimings", () => {
  it("returns nulls and zero count for no samples", () => {
    const result = computeAverageTimings([]);
    expect(result).toEqual({ avgResponseMinutes: null, avgCompletionMinutes: null, sampleCount: 0 });
  });

  it("averages response time across accepted samples, ignoring unaccepted ones", () => {
    const result = computeAverageTimings([
      { createdAt: base, acceptedAt: minutesAfter(10), completedAt: null },
      { createdAt: base, acceptedAt: minutesAfter(20), completedAt: null },
      { createdAt: base, acceptedAt: null, completedAt: null },
    ]);
    expect(result.avgResponseMinutes).toBe(15);
    expect(result.avgCompletionMinutes).toBeNull();
    expect(result.sampleCount).toBe(3);
  });

  it("averages completion time independently of response time", () => {
    const result = computeAverageTimings([
      { createdAt: base, acceptedAt: minutesAfter(5), completedAt: minutesAfter(30) },
      { createdAt: base, acceptedAt: minutesAfter(15), completedAt: minutesAfter(90) },
    ]);
    expect(result.avgResponseMinutes).toBe(10);
    expect(result.avgCompletionMinutes).toBe(60);
  });
});

describe("isOverdue", () => {
  const now = minutesAfter(120);

  it("uses dueAt when set, regardless of createdAt", () => {
    expect(isOverdue({ dueAt: minutesAfter(60), createdAt: base }, now, 30)).toBe(true);
    expect(isOverdue({ dueAt: minutesAfter(180), createdAt: base }, now, 30)).toBe(false);
  });

  it("falls back to a flat age threshold when dueAt is not set", () => {
    expect(isOverdue({ dueAt: null, createdAt: minutesAfter(60) }, now, 30)).toBe(true);
    expect(isOverdue({ dueAt: null, createdAt: minutesAfter(110) }, now, 30)).toBe(false);
  });
});
