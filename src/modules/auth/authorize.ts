import { permissionsForActor, ROW_LEVEL_RULES } from "./permissions";
import type {
  Actor,
  AuthorizationResult,
  Permission,
  ResourceContext,
} from "./types";
import { AuthorizationError } from "./types";

export interface AuthorizeInput {
  actor: Actor;
  action: Permission;
  resource?: ResourceContext;
}

/**
 * The single entry point for every authorization decision in OneWeb.
 *
 * Order of checks (deliberately fixed, do not reorder):
 *   1. Tenant match — a business-scoped actor may NEVER act on a resource
 *      from a different business, full stop, before any role/permission
 *      logic even runs. A PlatformActor is the only kind allowed to cross
 *      this boundary, and doing so is reported back via
 *      `viaPlatformOverride: true` so the caller can (and must) audit-log it.
 *   2. Base role/kind permission grant (see ./permissions.ts).
 *   3. Row-level rule, if one is registered for this permission (e.g. "staff
 *      can only complete a request assigned to them").
 *
 * This function never reads a database and never trusts caller-supplied
 * ids beyond what's already inside `actor` (which callers must have derived
 * from a verified session/membership/QR+guest-session lookup, never from a
 * raw request body).
 */
export function authorize({
  actor,
  action,
  resource = {},
}: AuthorizeInput): AuthorizationResult {
  // --- 1. Tenant match -----------------------------------------------
  const actorBusinessId =
    actor.kind === "staff" || actor.kind === "guest" || actor.kind === "system"
      ? actor.businessId
      : undefined;

  let viaPlatformOverride = false;

  if (resource.businessId !== undefined) {
    if (actor.kind === "platform") {
      viaPlatformOverride = true;
    } else if (actorBusinessId === undefined) {
      // Should be unreachable given the Actor union, but fail closed.
      return { allowed: false, reason: "MISSING_BUSINESS_CONTEXT" };
    } else if (actorBusinessId !== resource.businessId) {
      return { allowed: false, reason: "CROSS_TENANT" };
    }
  }

  // --- 2. Base permission grant ---------------------------------------
  const grantedPermissions = permissionsForActor(actor);
  if (!grantedPermissions.has(action)) {
    return { allowed: false, reason: "NOT_PERMITTED" };
  }

  // --- 3. Row-level rule ------------------------------------------------
  const rowRule = ROW_LEVEL_RULES[action];
  if (rowRule && !rowRule(actor, resource)) {
    const reason = actor.kind === "guest" ? "NOT_OWNER" : "NOT_ASSIGNED";
    return { allowed: false, reason };
  }

  return { allowed: true, viaPlatformOverride };
}

/**
 * Same decision as `authorize()`, but throws `AuthorizationError` on
 * denial. Prefer this in route handlers / server actions where the
 * natural flow is "check, then proceed" and a denial should short-circuit
 * with a 403 rather than be branched on manually every time.
 */
export function assertAuthorized(input: AuthorizeInput): { viaPlatformOverride: boolean } {
  const result = authorize(input);
  if (!result.allowed) {
    throw new AuthorizationError(result.reason);
  }
  return { viaPlatformOverride: result.viaPlatformOverride };
}
