import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { getFeedbackSummaryForBusiness, listFeedbackForBusiness } from "@/modules/feedback/repository";
import { computeAverageTimings, isOverdue } from "./metrics";
import * as repo from "./repository";

/** Requests older than this with no `dueAt` set are counted as overdue —
 * see metrics.ts `isOverdue` for why a flat fallback exists at all. */
const DEFAULT_OVERDUE_MINUTES = 60;
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
export async function getDashboardSummary(actor: StaffActor): Promise<DashboardSummary> {
  assertAuthorized({
    actor,
    action: "business:view_analytics",
    resource: { businessId: actor.businessId },
  });

  const now = new Date();
  const todayStart = repo.startOfDay(now);
  const timingWindowStart = new Date(now.getTime() - TIMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [todayCounts, activeForOverdue, timingSamples, departments, staff, feedbackSummary, recentFeedback] =
    await Promise.all([
      repo.getStatusCounts(actor.businessId, todayStart),
      repo.getActiveRequestsForOverdueCheck(actor.businessId),
      repo.getTimingSamples(actor.businessId, timingWindowStart),
      repo.getDepartmentBreakdown(actor.businessId, timingWindowStart),
      repo.getStaffWorkload(actor.businessId),
      getFeedbackSummaryForBusiness(actor.businessId),
      listFeedbackForBusiness(actor.businessId, { limit: 5, maxRating: 2 }),
    ]);

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
    recentComplaints: recentFeedback.map((f: (typeof recentFeedback)[number]) => ({
      id: f.id,
      rating: f.rating,
      comment: f.comment,
      guestName: f.guest?.fullName ?? "Guest",
      createdAt: f.createdAt,
    })),
  };
}
