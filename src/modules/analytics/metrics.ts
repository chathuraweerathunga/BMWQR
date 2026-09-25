/**
 * Pure timing-metric computations, kept dependency-free (no Prisma import)
 * so they're exhaustively unit-testable without a database — same pattern
 * as modules/requests/state-machine.ts.
 */

/** Overdue threshold for requests without a service time estimate. Shared
 * by the manager overview and the staff board so they always agree. */
export const DEFAULT_OVERDUE_MINUTES = 60;

export interface TimingSample {
  createdAt: Date;
  acceptedAt: Date | null;
  completedAt: Date | null;
}

export interface AverageTimings {
  /** Average minutes from request creation to staff acceptance, across
   * samples that have been accepted. `null` when there are none. */
  avgResponseMinutes: number | null;
  /** Average minutes from request creation to completion, across samples
   * that have been completed. `null` when there are none. */
  avgCompletionMinutes: number | null;
  sampleCount: number;
}

function averageMinutesBetween(
  samples: TimingSample[],
  endField: "acceptedAt" | "completedAt",
): number | null {
  const diffsMs: number[] = [];
  for (const sample of samples) {
    const end = sample[endField];
    if (end) {
      diffsMs.push(end.getTime() - sample.createdAt.getTime());
    }
  }
  if (diffsMs.length === 0) return null;
  const avgMs = diffsMs.reduce((sum, ms) => sum + ms, 0) / diffsMs.length;
  return avgMs / 60_000;
}

export function computeAverageTimings(samples: TimingSample[]): AverageTimings {
  return {
    avgResponseMinutes: averageMinutesBetween(samples, "acceptedAt"),
    avgCompletionMinutes: averageMinutesBetween(samples, "completedAt"),
    sampleCount: samples.length,
  };
}

/** Whether an active (not-yet-completed) request should count as overdue.
 * Uses the request's own `dueAt` when set; otherwise falls back to a flat
 * age threshold so the metric is still meaningful for businesses that
 * haven't configured per-service due times yet (MVP default — project
 * instructions section 42: don't over-engineer, but the dashboard still
 * needs a working number). */
export function isOverdue(
  request: { dueAt: Date | null; createdAt: Date },
  now: Date,
  defaultOverdueMinutes: number,
): boolean {
  if (request.dueAt) return request.dueAt.getTime() < now.getTime();
  return request.createdAt.getTime() < now.getTime() - defaultOverdueMinutes * 60_000;
}
