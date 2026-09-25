import { prisma } from "@/lib/prisma";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/format";

const ACTIVE_STATUSES = ["NEW", "ACCEPTED", "IN_PROGRESS"] as const;

/** Midnight at the PROPERTY, as a UTC instant. Using the server's own
 * midnight would shift "today" by the property's UTC offset. */
export function startOfDay(now: Date, timeZone: string): Date {
  const localDate = utcToZonedLocal(now, timeZone).slice(0, 10);
  return zonedLocalToUtc(`${localDate}T00:00`, timeZone) ?? now;
}

export async function getStatusCounts(businessId: string, since?: Date) {
  const grouped = await prisma.request.groupBy({
    by: ["status"],
    where: { businessId, ...(since ? { createdAt: { gte: since } } : {}) },
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const row of grouped) counts[row.status] = row._count._all;
  return counts;
}

/** Active requests plus enough fields for `isOverdue()` to classify each
 * one — fetched once and reused for both the overdue count and (later)
 * per-department/staff breakdowns, rather than re-querying per metric. */
export async function getActiveRequestsForOverdueCheck(businessId: string) {
  return prisma.request.findMany({
    where: { businessId, status: { in: [...ACTIVE_STATUSES] } },
    select: { id: true, dueAt: true, createdAt: true, departmentId: true, assignedMembershipId: true },
  });
}

/** Timing samples for requests created since `since` — used to compute
 * average response/completion times (see modules/analytics/metrics.ts). */
export async function getTimingSamples(businessId: string, since: Date) {
  return prisma.request.findMany({
    where: { businessId, createdAt: { gte: since } },
    select: { createdAt: true, acceptedAt: true, completedAt: true },
  });
}

export async function getDepartmentBreakdown(businessId: string, since: Date) {
  return prisma.department.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      requests: {
        where: { createdAt: { gte: since } },
        select: { status: true, createdAt: true, acceptedAt: true, completedAt: true, dueAt: true },
      },
    },
  });
}

export async function getStaffWorkload(businessId: string) {
  return prisma.businessMembership.findMany({
    where: { businessId, status: "ACTIVE" },
    select: {
      id: true,
      role: true,
      user: { select: { name: true, email: true } },
      assignedRequests: {
        where: { status: { in: [...ACTIVE_STATUSES] } },
        select: { id: true },
      },
    },
  });
}

/** Created-at stamps and service names since `since`, for the daily volume
 * trend and the most-requested services. Bucketing by day happens in the
 * service layer, in the property's timezone. */
export async function getRecentRequestMix(businessId: string, since: Date) {
  return prisma.request.findMany({
    where: { businessId, createdAt: { gte: since } },
    select: { createdAt: true, service: { select: { name: true } } },
  });
}
