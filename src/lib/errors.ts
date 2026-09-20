/**
 * Thrown when a tenant-scoped lookup finds nothing. Deliberately the SAME
 * error whether the id doesn't exist at all OR belongs to a different
 * business — every repository method here scopes its WHERE clause by
 * businessId, so a cross-tenant id and a nonexistent id are
 * indistinguishable by construction. That's intentional: a route handler
 * should return 404 for both, never leak "that exists, but not for you."
 */
export class NotFoundError extends Error {
  constructor(entity: string) {
    super(`${entity} not found`);
    this.name = "NotFoundError";
  }
}

/** Thrown when a request-status transition is not legal (see
 * modules/requests/state-machine.ts for the reasons). */
export class InvalidTransitionError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super(`Invalid request transition: ${reason}`);
    this.name = "InvalidTransitionError";
    this.reason = reason;
  }
}

/** Thrown when an operation requires a signed-in user (or an ACTIVE
 * membership at the relevant business) and neither is present. Route
 * handlers should map this to 401 (not signed in) — a missing membership
 * at a specific business is intentionally the same error as not being
 * signed in at all, so a valid session can't be used to probe which
 * businesses a user does or doesn't belong to. */
export class AuthenticationError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** Thrown when an update lost an optimistic-concurrency race (e.g. two
 * staff members accepting the same request at the same moment). The
 * caller should treat this like a normal "someone else got there first"
 * outcome, not a server error. */
export class ConcurrentUpdateError extends Error {
  constructor(entity: string) {
    super(`${entity} was modified concurrently — reload and retry`);
    this.name = "ConcurrentUpdateError";
  }
}

/** Thrown by a service function when caller-supplied input fails a
 * business-rule check that isn't expressible as a Zod schema alone (e.g. "1
 * to 5 inclusive"). Route/action handlers should map this to a plain
 * user-facing message, never a raw stack trace (project instructions
 * section 46). */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}
