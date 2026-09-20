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
  locationId?: string;
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
      ...(filter.locationId ? { locationId: filter.locationId } : {}),
    },
    include: {
      location: { select: { id: true, name: true } },
      service: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      assignedMembership: { include: { user: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
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
