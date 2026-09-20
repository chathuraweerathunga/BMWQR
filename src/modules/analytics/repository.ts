import { prisma } from "@/lib/prisma";

const ACTIVE_STATUSES = ["NEW", "ACCEPTED", "IN_PROGRESS"] as const;

export function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d;
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
