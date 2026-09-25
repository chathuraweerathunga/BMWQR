import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { getFeedbackSummaryForBusiness, listFeedbackForBusiness } from "@/modules/feedback/repository";
import { computeAverageTimings, DEFAULT_OVERDUE_MINUTES, isOverdue } from "./metrics";
import * as repo from "./repository";
import { utcToZonedLocal } from "@/lib/format";

/** Requests older than this with no `dueAt` set are counted as overdue —
 * see metrics.ts `isOverdue` for why a flat fallback exists at all. */
/** How far back "average response/completion time" and "department
 * performance" look. Kept short and fixed for the MVP — a manager-selected
 * date range is a V2 refinement (project instructions section 42). */
const TIMING_WINDOW_DAYS = 30;

export interface DashboardSummary {
  today: { total: number; new: number; accepted: number; inProgress: number; completed: number };
  overdueCount: number;
  avgResponseMinutes: number | null;
  avgCompletionMinutes: number | null;
  departmentPerformance: Array<{
    id: string;
    name: string;
    total: number;
    completed: number;
    overdue: number;
    avgResponseMinutes: number | null;
    avgCompletionMinutes: number | null;
  }>;
  staffWorkload: Array<{ id: string; name: string; role: string; activeCount: number }>;
  feedback: { averageRating: number | null; totalCount: number; negativeCount: number };
  /** Requests per property-local day, oldest first. */
  dailyVolume: Array<{ date: string; label: string; count: number }>;
  /** Most-requested services over the timing window. */
  topServices: Array<{ name: string; count: number }>;
  recentComplaints: Array<{
    id: string;
    rating: number;
    comment: string | null;
    guestName: string;
    createdAt: Date;
  }>;
}

/**
 * The manager dashboard's single data source (project instructions section
 * 25: "What is happening in my business right now?"). Every number here
 * comes from a plain, tenant-scoped Postgres query — no separate analytics
 * warehouse or event pipeline (section 24/42).
 */
const TREND_DAYS = 7;

export async function getDashboardSummary(actor: StaffActor, timeZone: string): Promise<DashboardSummary> {
  assertAuthorized({
    actor,
    action: "business:view_analytics",
    resource: { businessId: actor.businessId },
  });

  const now = new Date();
  const todayStart = repo.startOfDay(now, timeZone);
  const trendStart = new Date(todayStart.getTime() - (TREND_DAYS - 1) * 24 * 60 * 60 * 1000);
  const timingWindowStart = new Date(now.getTime() - TIMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [todayCounts, activeForOverdue, timingSamples, departments, staff, feedbackSummary, recentFeedback, mix] =
    await Promise.all([
      repo.getStatusCounts(actor.businessId, todayStart),
      repo.getActiveRequestsForOverdueCheck(actor.businessId),
      repo.getTimingSamples(actor.businessId, timingWindowStart),
      repo.getDepartmentBreakdown(actor.businessId, timingWindowStart),
      repo.getStaffWorkload(actor.businessId),
      getFeedbackSummaryForBusiness(actor.businessId),
      listFeedbackForBusiness(actor.businessId, { limit: 5, maxRating: 2 }),
      repo.getRecentRequestMix(actor.businessId, timingWindowStart),
    ]);

  const dayKey = (d: Date) => utcToZonedLocal(d, timeZone).slice(0, 10);
  const perDay = new Map<string, number>();
  const perService = new Map<string, number>();
  for (const r of mix) {
    if (r.createdAt >= trendStart) perDay.set(dayKey(r.createdAt), (perDay.get(dayKey(r.createdAt)) ?? 0) + 1);
    const name = r.service?.name ?? "General request";
    perService.set(name, (perService.get(name) ?? 0) + 1);
  }
  const dailyVolume = Array.from({ length: TREND_DAYS }, (_, i) => {
    // Noon avoids DST edges when stepping whole days.
    const day = new Date(trendStart.getTime() + i * 24 * 60 * 60 * 1000 + 12 * 60 * 60 * 1000);
    const key = dayKey(day);
    const label = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone }).format(day);
    return { date: key, label, count: perDay.get(key) ?? 0 };
  });
  const topServices = [...perService.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  const overdueByDepartment = new Map<string, number>();
  let overdueCount = 0;
  for (const request of activeForOverdue) {
    if (!isOverdue(request, now, DEFAULT_OVERDUE_MINUTES)) continue;
    overdueCount += 1;
    if (request.departmentId) {
      overdueByDepartment.set(request.departmentId, (overdueByDepartment.get(request.departmentId) ?? 0) + 1);
    }
  }

  const overallTimings = computeAverageTimings(timingSamples);

  const departmentPerformance = departments.map((dept: (typeof departments)[number]) => {
    const timings = computeAverageTimings(dept.requests);
    return {
      id: dept.id,
      name: dept.name,
      total: dept.requests.length,
      completed: dept.requests.filter(
        (r: (typeof dept.requests)[number]) => r.status === "COMPLETED" || r.status === "CLOSED",
      ).length,
      overdue: overdueByDepartment.get(dept.id) ?? 0,
      avgResponseMinutes: timings.avgResponseMinutes,
      avgCompletionMinutes: timings.avgCompletionMinutes,
    };
  });

  const staffWorkload = staff.map((membership: (typeof staff)[number]) => ({
    id: membership.id,
    name: membership.user.name,
    role: membership.role,
    activeCount: membership.assignedRequests.length,
  }));

  return {
    today: {
      total: Object.values(todayCounts).reduce((sum, n) => sum + n, 0),
      new: todayCounts.NEW ?? 0,
      accepted: todayCounts.ACCEPTED ?? 0,
      inProgress: todayCounts.IN_PROGRESS ?? 0,
      completed: (todayCounts.COMPLETED ?? 0) + (todayCounts.CLOSED ?? 0),
    },
    overdueCount,
    avgResponseMinutes: overallTimings.avgResponseMinutes,
    avgCompletionMinutes: overallTimings.avgCompletionMinutes,
    departmentPerformance,
    staffWorkload,
    feedback: feedbackSummary,
    dailyVolume,
    topServices,
    recentComplaints: recentFeedback.map((f: (typeof recentFeedback)[number]) => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      guestName: f.guest?.fullName ?? "Guest",
      createdAt: f.createdAt,
    })),
  };
}
