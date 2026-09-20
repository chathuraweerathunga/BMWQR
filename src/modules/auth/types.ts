/**
 * Actor and permission types for the centralized authorization core.
 *
 * Every protected operation in OneWeb should describe "who is doing this"
 * as one of the Actor variants below, and "on what" as a ResourceContext.
 * `authorize()` (see ./authorize.ts) is the ONLY function that should decide
 * yes/no from those two pieces of information — nothing else in the
 * codebase should scatter its own role checks (project instructions
 * section 14: "Use centralized authorization... Do not scatter role logic
 * throughout random UI components").
 */

/** Roles a User can hold within a single business, via BusinessMembership. */
export type MembershipRole = "BUSINESS_OWNER" | "MANAGER" | "STAFF";

/**
 * A staff member acting within exactly one business. Always derived from an
 * ACTIVE BusinessMembership row looked up server-side — never constructed
 * from a client-supplied businessId or role.
 */
export interface StaffActor {
  kind: "staff";
  userId: string;
  businessId: string;
  membershipId: string;
  role: MembershipRole;
  departmentId: string | null;
}

/**
 * A guest acting within exactly one business, authorized by an active
 * GuestSession tied to an active GuestStay. Always derived server-side from
 * the session token's hash lookup — never from a client-supplied guestId or
 * businessId (project instructions section 7/20).
 */
export interface GuestActor {
  kind: "guest";
  guestId: string;
  businessId: string;
  guestStayId: string;
  guestSessionId: string;
}

/**
 * Platform-level administrator (User.isSuperAdmin = true). Not scoped to a
 * business. Can act across tenants for platform-administration purposes
 * (section 14: manage businesses, subscriptions, system settings, support).
 *
 * Every use of a PlatformActor to reach into a specific business's data is
 * a cross-tenant override and MUST be paired with an AuditLog entry by the
 * calling code — `authorize()` allows it, but does not log it for you.
 */
export interface PlatformActor {
  kind: "platform";
  userId: string;
}

/**
 * Trusted server-side code (background jobs, scheduled sweeps) acting
 * without a human behind it. Still scoped to a specific business — a
 * worker processing tenant data must say which tenant, and `authorize()`
 * still enforces that the resource belongs to that business.
 */
export interface SystemActor {
  kind: "system";
  businessId: string;
}

export type Actor = StaffActor | GuestActor | PlatformActor | SystemActor;

/**
 * The full set of permissions in the system, grouped by resource. Adding a
 * new protected operation means adding a permission here and wiring it into
 * the ROLE_PERMISSIONS matrix in ./permissions.ts — not writing a bespoke
 * `if (role === "MANAGER")` somewhere else.
 */
export type Permission =
  // Business
  | "business:update_settings"
  | "business:manage_billing"
  | "business:view_analytics"
  | "business:view_audit_log"
  // Staff & departments
  | "staff:invite"
  | "staff:update_role"
  | "staff:disable"
  | "department:manage"
  // Locations, services, QR
  | "location:manage"
  | "service:manage"
  | "qr:manage"
  // Guests & stays
  | "guest_stay:create"
  | "guest_stay:checkout"
  | "guest_stay:view"
  // Requests
  | "request:create"
  | "request:view_all"
  | "request:view_own"
  | "request:accept"
  | "request:start"
  | "request:complete"
  | "request:reject"
  | "request:reassign"
  | "request:cancel_any"
  | "request:cancel_own"
  // Feedback
  | "feedback:create"
  | "feedback:view";

/**
 * Describes the resource a permission check is being made against, so
 * `authorize()` can enforce tenant isolation and row-level ownership rules
 * before even consulting the role/permission matrix.
 *
 * `businessId` should be set for every tenant-owned resource. Leaving it
 * unset is only correct for platform-scoped operations (e.g. a
 * PlatformActor listing all businesses).
 */
export interface ResourceContext {
  businessId?: string;
  /** Department the resource belongs to, if any (e.g. a Request's department). */
  departmentId?: string | null;
  /** BusinessMembership id the resource is assigned to, if any. */
  assignedMembershipId?: string | null;
  /** Guest id that owns the resource, if any (e.g. a Request's creator). */
  ownerGuestId?: string | null;
}

export interface AuthorizationDenied {
  allowed: false;
  reason:
    | "CROSS_TENANT"
    | "NOT_PERMITTED"
    | "NOT_ASSIGNED"
    | "NOT_OWNER"
    | "MISSING_BUSINESS_CONTEXT";
}

export interface AuthorizationAllowed {
  allowed: true;
  /** True when a PlatformActor bypassed normal tenant scoping. Callers
   *  MUST write an AuditLog entry when this is true. */
  viaPlatformOverride: boolean;
}

export type AuthorizationResult = AuthorizationAllowed | AuthorizationDenied;

export class AuthorizationError extends Error {
  readonly reason: AuthorizationDenied["reason"];

  constructor(reason: AuthorizationDenied["reason"]) {
    super(`Not authorized: ${reason}`);
    this.name = "AuthorizationError";
    this.reason = reason;
  }
}
