/** Mirrors the Prisma `RequestStatus` enum — kept as a standalone type so
 * this module has zero dependency on the generated Prisma client and can be
 * unit tested without a database or `prisma generate` having run. */
export type RequestStatus =
  | "NEW"
  | "ACCEPTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CLOSED"
  | "REJECTED"
  | "CANCELLED";

export type RequestTransitionActorKind = "staff_or_manager" | "guest";

export interface TransitionInput {
  from: RequestStatus;
  to: RequestStatus;
  actorKind: RequestTransitionActorKind;
}

export interface TransitionAllowed {
  ok: true;
  /** Timestamp fields the caller should stamp on the Request row. */
  timestampField:
    | "acceptedAt"
    | "startedAt"
    | "completedAt"
    | "closedAt"
    | null;
}

export interface TransitionDenied {
  ok: false;
  reason:
    | "TERMINAL_STATE"
    | "INVALID_TRANSITION"
    | "ACTOR_NOT_PERMITTED_FOR_TRANSITION";
}

export type TransitionResult = TransitionAllowed | TransitionDenied;
