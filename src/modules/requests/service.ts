import { assertAuthorized } from "@/modules/auth/authorize";
import { getActiveMembershipById } from "@/modules/staff/repository";
import type { Actor, GuestActor, StaffActor } from "@/modules/auth/types";
import { NotFoundError, InvalidTransitionError, ValidationError } from "@/lib/errors";
import { getLocationById } from "@/modules/locations/repository";
import { getStayById } from "@/modules/guest-stays/repository";
import { getSessionWithLocation } from "@/modules/guest-sessions/repository";
import {
  computeDueAt,
  MAX_REQUEST_DETAILS_LENGTH,
  MAX_REQUEST_TITLE_LENGTH,
  normalizeGuestText,
  resolveGuestRequestLocation,
  type GuestLocationChoice,
} from "./guest-request-rules";
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
  /** Which server-known location the guest wants help at. Never an id. */
  where?: GuestLocationChoice | null;
  serviceId?: string | null;
  title: string;
  description?: string | null;
}

/**
 * Creates a request on behalf of a guest. `actor` must be a `GuestActor`
 * derived server-side from a validated guest session. Every id the request
 * references is resolved or verified here, never taken from the client
 * (project instructions section 20):
 *   - location: the session's server-recorded QR scan location or the
 *     stay's room, and it must be ACTIVE in this business
 *   - service: must exist in this business and be active; its department
 *     routes the request, its default priority and time estimate set
 *     priority and due time
 */
export async function createGuestRequest(actor: GuestActor, input: CreateGuestRequestInput) {
  assertAuthorized({
    actor,
    action: "request:create",
    resource: { businessId: actor.businessId },
  });

  const title = normalizeGuestText(input.title, MAX_REQUEST_TITLE_LENGTH);
  if (!title) throw new ValidationError("MISSING_TITLE");
  const description = normalizeGuestText(input.description, MAX_REQUEST_DETAILS_LENGTH);

  const [session, stay] = await Promise.all([
    getSessionWithLocation(actor.businessId, actor.guestSessionId),
    getStayById(actor.businessId, actor.guestStayId),
  ]);
  if (!session || !stay) throw new NotFoundError("Guest stay");

  const locationId = resolveGuestRequestLocation(input.where ?? null, {
    scannedLocationId: session.currentLocationId,
    stayLocationId: stay.locationId,
  });
  if (!locationId) throw new ValidationError("NO_LOCATION");
  const location = await getLocationById(actor.businessId, locationId);
  if (!location || location.status !== "ACTIVE") throw new ValidationError("LOCATION_UNAVAILABLE");

  let service: Awaited<ReturnType<typeof getServiceById>> = null;
  if (input.serviceId) {
    service = await getServiceById(actor.businessId, input.serviceId);
    if (!service || !service.isActive) throw new ValidationError("SERVICE_UNAVAILABLE");
  }

  return repo.createRequest({
    businessId: actor.businessId,
    guestStayId: actor.guestStayId,
    locationId: location.id,
    serviceId: service?.id ?? null,
    departmentId: service?.departmentId ?? null,
    title,
    description,
    priority: service?.defaultPriority ?? "NORMAL",
    dueAt: computeDueAt(service?.estimatedMinutes, new Date()),
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

/**
 * A manager assigning (or unassigning) a request to a team member
 * (project instructions section 41: request assignment). Requires
 * `request:reassign` (MANAGER+ in the base matrix). The target must hold
 * an ACTIVE membership at the same business: looked up server-side,
 * never trusted from the form.
 */
export async function assignRequest(
  actor: StaffActor,
  businessId: string,
  requestId: string,
  membershipId: string | null,
) {
  const request = await loadRequestOrThrow(businessId, requestId);
  assertAuthorized({
    actor,
    action: "request:reassign",
    resource: {
      businessId: request.businessId,
      departmentId: request.departmentId,
      assignedMembershipId: request.assignedMembershipId,
    },
  });

  if (membershipId) {
    const target = await getActiveMembershipById(businessId, membershipId);
    if (!target) throw new NotFoundError("Team member");
  }

  const result = await repo.setAssignment(businessId, requestId, membershipId);
  if (result.count === 0) throw new InvalidTransitionError("TERMINAL_STATE");

  await logAudit(actor, {
    businessId,
    action: "request.assigned",
    entityType: "Request",
    entityId: requestId,
    oldValue: { assignedMembershipId: request.assignedMembershipId },
    newValue: { assignedMembershipId: membershipId },
  });
}
