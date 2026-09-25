import { prisma, type PrismaTransactionClient } from "@/lib/prisma";
import { ConcurrentUpdateError } from "@/lib/errors";
import type { RequestStatus } from "./types";

export interface CreateRequestInput {
  businessId: string;
  guestStayId: string;
  locationId: string;
  serviceId?: string | null;
  departmentId?: string | null;
  title: string;
  description?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  createdByGuestId: string;
  /** When the request should be done by, derived from the service's
   * estimated minutes. Drives the "overdue" metrics. */
  dueAt?: Date | null;
}

/** Creates a Request and its initial (null → NEW) history row atomically,
 * so a request never exists without at least one history entry. */
export async function createRequest(input: CreateRequestInput) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const request = await tx.request.create({
      data: {
        businessId: input.businessId,
        guestStayId: input.guestStayId,
        locationId: input.locationId,
        serviceId: input.serviceId ?? null,
        departmentId: input.departmentId ?? null,
        title: input.title,
        description: input.description ?? null,
        priority: input.priority ?? "NORMAL",
        createdByGuestId: input.createdByGuestId,
        dueAt: input.dueAt ?? null,
      },
    });
    await tx.requestStatusHistory.create({
      data: {
        businessId: input.businessId,
        requestId: request.id,
        fromStatus: null,
        toStatus: "NEW",
        changedByGuestId: input.createdByGuestId,
      },
    });
    return request;
  });
}

/** Tenant-scoped lookup — a cross-tenant or nonexistent id both resolve to
 * `null` here, by construction (see lib/errors.ts NotFoundError). */
export async function getRequestById(businessId: string, requestId: string) {
  return prisma.request.findFirst({ where: { id: requestId, businessId } });
}

export interface ListRequestsFilter {
  status?: RequestStatus[];
  departmentId?: string | null;
  assignedMembershipId?: string | null;
  /** When true (used for a STAFF actor's own queue), matches requests
   * that are either unassigned OR assigned to `assignedMembershipId`. */
  unassignedOrOwnedBy?: string;
  /** A STAFF member's actionable queue: assigned to them, or unassigned
   * in their department (or with no department). Mirrors the
   * `request:accept` row rule so the board never offers an action that
   * authorize() would refuse. */
  staffQueue?: { membershipId: string; departmentId: string | null };
  locationId?: string;
  /** Cap on rows returned (history views). */
  limit?: number;
}

export function staffQueueWhere(queue: { membershipId: string; departmentId: string | null }) {
  return {
    OR: [
      { assignedMembershipId: queue.membershipId },
      {
        assignedMembershipId: null,
        OR: [{ departmentId: null }, ...(queue.departmentId ? [{ departmentId: queue.departmentId }] : [])],
      },
    ],
  };
}

/** Includes the display fields a staff/manager list view needs, so the UI
 * layer never has to make a second round trip per row. */
export async function listRequestsForBusiness(businessId: string, filter: ListRequestsFilter = {}) {
  return prisma.request.findMany({
    where: {
      businessId,
      ...(filter.status ? { status: { in: filter.status } } : {}),
      ...(filter.departmentId ? { departmentId: filter.departmentId } : {}),
      ...(filter.assignedMembershipId ? { assignedMembershipId: filter.assignedMembershipId } : {}),
      ...(filter.unassignedOrOwnedBy
        ? {
            OR: [
              { assignedMembershipId: null },
              { assignedMembershipId: filter.unassignedOrOwnedBy },
            ],
          }
        : {}),
      ...(filter.staffQueue ? staffQueueWhere(filter.staffQueue) : {}),
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
    },
    include: {
      location: { select: { id: true, name: true } },
      service: { select: { id: true, name: true, icon: true } },
      department: { select: { id: true, name: true } },
      assignedMembership: { include: { user: { select: { name: true } } } },
      guestStay: { select: { guest: { select: { fullName: true } } } },
    },
    orderBy: { createdAt: "desc" },
    ...(filter.limit ? { take: filter.limit } : {}),
  });
}

export async function listRequestsForGuestStay(businessId: string, guestStayId: string) {
  return prisma.request.findMany({
    where: { businessId, guestStayId },
    orderBy: { createdAt: "desc" },
  });
}

export interface ApplyStatusChangeInput {
  businessId: string;
  requestId: string;
  fromStatus: RequestStatus;
  toStatus: RequestStatus;
  timestampField: "acceptedAt" | "startedAt" | "completedAt" | "closedAt" | null;
  actorUserId?: string | null;
  actorGuestId?: string | null;
  note?: string | null;
  /** Set when accepting a request should also claim it for the acting
   * staff member. `undefined` leaves the current assignment untouched. */
  setAssignedMembershipId?: string | null;
}

/**
 * Applies a status transition with optimistic concurrency: the UPDATE's
 * WHERE clause includes `fromStatus`, so if someone else already moved the
 * request away from that status (e.g. two staff accepting the same
 * request at once), this update matches zero rows and throws
 * `ConcurrentUpdateError` instead of silently overwriting a decision made
 * a moment earlier. The status update and its history row are written in
 * one transaction — never one without the other.
 */
export async function applyStatusChange(input: ApplyStatusChangeInput) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const data: Record<string, unknown> = { status: input.toStatus };
    if (input.timestampField) {
      data[input.timestampField] = new Date();
    }
    if (input.setAssignedMembershipId !== undefined) {
      data.assignedMembershipId = input.setAssignedMembershipId;
    }

    const updateResult = await tx.request.updateMany({
      where: { id: input.requestId, businessId: input.businessId, status: input.fromStatus },
      data,
    });

    if (updateResult.count === 0) {
      throw new ConcurrentUpdateError("Request");
    }

    await tx.requestStatusHistory.create({
      data: {
        businessId: input.businessId,
        requestId: input.requestId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        changedByUserId: input.actorUserId ?? null,
        changedByGuestId: input.actorGuestId ?? null,
        note: input.note ?? null,
      },
    });

    return tx.request.findFirstOrThrow({ where: { id: input.requestId, businessId: input.businessId } });
  });
}

export async function getRequestStatusHistory(businessId: string, requestId: string) {
  return prisma.requestStatusHistory.findMany({
    where: { businessId, requestId },
    orderBy: { createdAt: "asc" },
  });
}

/** A guest's own requests with everything the portal's status view shows:
 * where, what, and each status change in order. Scoped by business AND
 * stay, so a guest only ever sees their own stay's requests. */
export async function listRequestsForGuestStayDetailed(businessId: string, guestStayId: string) {
  return prisma.request.findMany({
    where: { businessId, guestStayId },
    include: {
      location: { select: { name: true } },
      service: { select: { name: true, icon: true, estimatedMinutes: true } },
      statusHistory: { select: { toStatus: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

/**
 * Sets (or clears) who a request is assigned to, without changing its
 * status. Only while the request is still open. Tenant-scoped in the WHERE
 * clause, and the composite foreign key rejects a membership from another
 * business at the database level.
 */
export async function setAssignment(businessId: string, requestId: string, membershipId: string | null) {
  return prisma.request.updateMany({
    where: { id: requestId, businessId, status: { in: ["NEW", "ACCEPTED", "IN_PROGRESS"] } },
    data: { assignedMembershipId: membershipId },
  });
}
