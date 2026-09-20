import { assertAuthorized } from "@/modules/auth/authorize";
import type { Actor, GuestActor, StaffActor } from "@/modules/auth/types";
import { NotFoundError, InvalidTransitionError } from "@/lib/errors";
import { getServiceById } from "@/modules/services/repository";
import { logAudit } from "@/modules/audit/service";
import { attemptTransition } from "./state-machine";
import * as repo from "./repository";
import type { RequestStatus, RequestTransitionActorKind } from "./types";

/**
 * The request module's service layer: every guest- or staff-facing
 * operation on a Request goes through one of these functions, never
 * straight to `repository.ts`. Each function, in order:
 *   1. loads the request scoped by businessId (a cross-tenant id resolves
 *      to NotFoundError, indistinguishable from "doesn't exist")
 *   2. builds the ResourceContext and calls `assertAuthorized()`
 *   3. validates the transition via the pure state machine
 *   4. persists via `repository.applyStatusChange()`
 */

function actorKindFor(actor: Actor): RequestTransitionActorKind {
  return actor.kind === "guest" ? "guest" : "staff_or_manager";
}

async function loadRequestOrThrow(businessId: string, requestId: string) {
  const request = await repo.getRequestById(businessId, requestId);
  if (!request) throw new NotFoundError("Request");
  return request;
}

export interface CreateGuestRequestInput {
  locationId: string;
  serviceId?: string | null;
  departmentId?: string | null;
  title: string;
  description?: string | null;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}

/**
 * Creates a request on behalf of a guest. `actor` must be a `GuestActor`
 * derived server-side from a validated guest session (never from a
 * client-supplied guestId/guestStayId/businessId — project instructions
 * section 20). If `serviceId` is given but not `departmentId`, the
 * service's own department is used for routing.
 */
export async function createGuestRequest(actor: GuestActor, input: CreateGuestRequestInput) {
  assertAuthorized({
    actor,
    action: "request:create",
    resource: { businessId: actor.businessId },
  });

  let departmentId = input.departmentId ?? null;
  if (input.serviceId && !departmentId) {
    const service = await getServiceById(actor.businessId, input.serviceId);
    if (!service) throw new NotFoundError("Service");
    departmentId = service.departmentId;
  }

  return repo.createRequest({
    businessId: actor.businessId,
    guestStayId: actor.guestStayId,
    locationId: input.locationId,
    serviceId: input.serviceId ?? null,
    departmentId,
    title: input.title,
    description: input.description ?? null,
    priority: input.priority,
    createdByGuestId: actor.guestId,
  });
}

async function transition(
  actor: Actor,
  businessId: string,
  requestId: string,
  action: Parameters<typeof assertAuthorized>[0]["action"],
  to: RequestStatus,
  note?: string,
  claimForStaff = false,
) {
  const request = await loadRequestOrThrow(businessId, requestId);

  assertAuthorized({
    actor,
    action,
    resource: {
      businessId: request.businessId,
      departmentId: request.departmentId,
      assignedMembershipId: request.assignedMembershipId,
      ownerGuestId: request.createdByGuestId,
    },
  });

  const result = attemptTransition({
    from: request.status as RequestStatus,
    to,
    actorKind: actorKindFor(actor),
  });
  if (!result.ok) {
    throw new InvalidTransitionError(result.reason);
  }

  const updated = await repo.applyStatusChange({
    businessId,
    requestId,
    fromStatus: request.status as RequestStatus,
    toStatus: to,
    timestampField: result.timestampField,
    actorUserId: actor.kind === "staff" ? actor.userId : null,
    actorGuestId: actor.kind === "guest" ? actor.guestId : null,
    note,
    setAssignedMembershipId:
      claimForStaff && actor.kind === "staff" ? actor.membershipId : undefined,
  });

  await logAudit(actor, {
    businessId,
    action: "request.status_changed",
    entityType: "Request",
    entityId: requestId,
    oldValue: { status: request.status },
    newValue: {
      status: to,
      ...(claimForStaff && actor.kind === "staff" ? { assignedMembershipId: actor.membershipId } : {}),
    },
  });

  return updated;
}

export function acceptRequest(actor: StaffActor, businessId: string, requestId: string) {
  return transition(actor, businessId, requestId, "request:accept", "ACCEPTED", undefined, true);
}

export function startRequest(actor: StaffActor, businessId: string, requestId: string) {
  return transition(actor, businessId, requestId, "request:start", "IN_PROGRESS");
}

export function completeRequest(
  actor: StaffActor,
  businessId: string,
  requestId: string,
  note?: string,
) {
  return transition(actor, businessId, requestId, "request:complete", "COMPLETED", note);
}

export function closeRequest(actor: StaffActor, businessId: string, requestId: string) {
  // Base permission for closing piggybacks on "complete" — closing is a
  // manager/staff bookkeeping step, not a distinct capability grant, so it
  // reuses the same permission a completer already needed. Revisit if a
  // business wants a dedicated "closer" role distinct from "completer".
  return transition(actor, businessId, requestId, "request:complete", "CLOSED");
}

export function rejectRequest(
  actor: StaffActor,
  businessId: string,
  requestId: string,
  note?: string,
) {
  return transition(actor, businessId, requestId, "request:reject", "REJECTED", note);
}

export function cancelRequest(
  actor: StaffActor | GuestActor,
  businessId: string,
  requestId: string,
  note?: string,
) {
  const action = actor.kind === "guest" ? "request:cancel_own" : "request:cancel_any";
  return transition(actor, businessId, requestId, action, "CANCELLED", note);
}
