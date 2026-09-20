import type {
  RequestStatus,
  RequestTransitionActorKind,
  TransitionInput,
  TransitionResult,
} from "./types";

/**
 * The request lifecycle (project instructions section 9):
 *
 *   NEW → ACCEPTED → IN_PROGRESS → COMPLETED → CLOSED
 *   NEW → REJECTED
 *   NEW/ACCEPTED → CANCELLED (guest-initiated allowed)
 *   IN_PROGRESS → CANCELLED (staff/manager only — work already started)
 *
 * This table is the single source of truth for which transitions exist and
 * which actor kind may perform them. `attemptTransition` is a pure
 * function: it does not touch the database and does not know about a
 * specific request. The caller (a request service) is responsible for:
 *   - resolving the actor via `authorize()` first (tenant + row-level checks)
 *   - loading the current status from the database
 *   - calling `attemptTransition`
 *   - persisting the new status AND a RequestStatusHistory row in the same
 *     transaction if the result is `ok: true`
 */
const TRANSITIONS: Readonly<
  Record<RequestStatus, Partial<Record<RequestStatus, readonly RequestTransitionActorKind[]>>>
> = {
  NEW: {
    ACCEPTED: ["staff_or_manager"],
    REJECTED: ["staff_or_manager"],
    CANCELLED: ["staff_or_manager", "guest"],
  },
  ACCEPTED: {
    IN_PROGRESS: ["staff_or_manager"],
    CANCELLED: ["staff_or_manager", "guest"],
  },
  IN_PROGRESS: {
    COMPLETED: ["staff_or_manager"],
    // A guest can no longer self-serve cancel once staff have started the
    // work — they should contact staff instead. This is a deliberate MVP
    // policy choice, not a technical limitation; revisit if hotels want a
    // "cancel with confirmation" flow even mid-service.
    CANCELLED: ["staff_or_manager"],
  },
  COMPLETED: {
    CLOSED: ["staff_or_manager"],
  },
  CLOSED: {},
  REJECTED: {},
  CANCELLED: {},
};

export const TERMINAL_STATUSES: ReadonlySet<RequestStatus> = new Set([
  "CLOSED",
  "REJECTED",
  "CANCELLED",
]);

export function isTerminalStatus(status: RequestStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}

const TIMESTAMP_FIELD_FOR_STATUS: Partial<
  Record<RequestStatus, "acceptedAt" | "startedAt" | "completedAt" | "closedAt">
> = {
  ACCEPTED: "acceptedAt",
  IN_PROGRESS: "startedAt",
  COMPLETED: "completedAt",
  CLOSED: "closedAt",
};

/**
 * Returns the set of statuses reachable from `from` for a given actor kind.
 * Intended for the UI layer to render only the actions that are actually
 * legal, without duplicating the transition table.
 */
export function getAllowedNextStatuses(
  from: RequestStatus,
  actorKind: RequestTransitionActorKind,
): RequestStatus[] {
  const edges = TRANSITIONS[from];
  return (Object.keys(edges) as RequestStatus[]).filter((to) =>
    edges[to]?.includes(actorKind),
  );
}

/**
 * Validates a single proposed transition. Does not perform the transition
 * — it only says whether it's legal and, if so, which timestamp field the
 * caller should stamp.
 */
export function attemptTransition({
  from,
  to,
  actorKind,
}: TransitionInput): TransitionResult {
  if (isTerminalStatus(from)) {
    return { ok: false, reason: "TERMINAL_STATE" };
  }

  const allowedActors = TRANSITIONS[from]?.[to];
  if (!allowedActors) {
    return { ok: false, reason: "INVALID_TRANSITION" };
  }

  if (!allowedActors.includes(actorKind)) {
    return { ok: false, reason: "ACTOR_NOT_PERMITTED_FOR_TRANSITION" };
  }

  return { ok: true, timestampField: TIMESTAMP_FIELD_FOR_STATUS[to] ?? null };
}
