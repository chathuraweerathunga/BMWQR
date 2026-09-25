import type {
  Actor,
  MembershipRole,
  Permission,
  ResourceContext,
} from "./types";

/**
 * Base permission grants per staff role. This is the ONLY place role →
 * permission mappings should live. A business's feature flags (see
 * BusinessSettings.featureFlags) may later disable whole features, but they
 * should gate at the module/route level, not by editing this matrix per
 * business.
 */
export const ROLE_PERMISSIONS: Readonly<Record<MembershipRole, ReadonlySet<Permission>>> = {
  BUSINESS_OWNER: new Set<Permission>([
    "business:update_settings",
    "business:manage_billing",
    "business:view_analytics",
    "business:view_audit_log",
    "staff:invite",
    "staff:update_role",
    "staff:disable",
    "department:manage",
    "location:manage",
    "service:manage",
    "qr:manage",
    "guest_stay:create",
    "guest_stay:checkout",
    "guest_stay:view",
    "request:view_all",
    "request:view_own",
    "request:accept",
    "request:start",
    "request:complete",
    "request:reject",
    "request:reassign",
    "request:cancel_any",
    "feedback:view",
  ]),
  MANAGER: new Set<Permission>([
    "business:view_analytics",
    "business:view_audit_log",
    "staff:invite",
    "department:manage",
    "location:manage",
    "service:manage",
    "qr:manage",
    "guest_stay:create",
    "guest_stay:checkout",
    "guest_stay:view",
    "request:view_all",
    "request:view_own",
    "request:accept",
    "request:start",
    "request:complete",
    "request:reject",
    "request:reassign",
    "request:cancel_any",
    "feedback:view",
  ]),
  // STAFF deliberately excludes reject/reassign/cancel_any and billing/staff
  // management (spec section 14: staff "reject/reassign where permitted" —
  // the MVP default is "not permitted"; a business can be given a looser
  // policy later without changing this file, via a per-business override
  // layered on top of this base matrix).
  STAFF: new Set<Permission>([
    "guest_stay:view",
    "request:view_own",
    "request:accept",
    "request:start",
    "request:complete",
  ]),
};

/** Fixed permission set for an authenticated guest session. */
export const GUEST_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "request:create",
  "request:view_own",
  "request:cancel_own",
  "feedback:create",
]);

/** SUPER_ADMIN — full permission set, usable across tenant boundaries. */
export const PLATFORM_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  ...ROLE_PERMISSIONS.BUSINESS_OWNER,
]);

/**
 * Minimal permissions for trusted background jobs. Kept intentionally small
 * — extend only when a specific worker needs a specific permission, never
 * grant broadly "just in case".
 */
export const SYSTEM_PERMISSIONS: ReadonlySet<Permission> = new Set<Permission>([
  "guest_stay:checkout", // automatic checkout/expiry sweep
]);

export function permissionsForActor(actor: Actor): ReadonlySet<Permission> {
  switch (actor.kind) {
    case "staff":
      return ROLE_PERMISSIONS[actor.role];
    case "guest":
      return GUEST_PERMISSIONS;
    case "platform":
      return PLATFORM_PERMISSIONS;
    case "system":
      return SYSTEM_PERMISSIONS;
  }
}

/**
 * Row-level rules applied after the base permission grant has already
 * passed. These encode "yes this role can generally do X, but only on
 * resources it owns/is assigned to" — the part a flat role matrix can't
 * express on its own.
 *
 * Returning `true` means the row-level check passed. Absence of an entry
 * for a given permission means no extra row-level check is required beyond
 * tenant matching and the base grant.
 */
export const ROW_LEVEL_RULES: Partial<
  Record<Permission, (actor: Actor, resource: ResourceContext) => boolean>
> = {
  "request:view_own": (actor, resource) => {
    if (actor.kind === "guest") {
      return resource.ownerGuestId === actor.guestId;
    }
    if (actor.kind === "staff") {
      // Assigned to this staff member, or unassigned and in their department.
      if (resource.assignedMembershipId) {
        return resource.assignedMembershipId === actor.membershipId;
      }
      return (
        resource.departmentId === null ||
        resource.departmentId === undefined ||
        resource.departmentId === actor.departmentId
      );
    }
    return true;
  },
  // Department and ownership limits apply to the STAFF role only. Managers
  // and owners run the whole operation (spec section 14: they "manage
  // requests"), so they can accept, start and finish any request, e.g. to
  // cover for someone who went off shift.
  "request:accept": (actor, resource) => {
    if (actor.kind !== "staff" || actor.role !== "STAFF") return true;
    // A request a manager assigned to this person is theirs to accept.
    if (resource.assignedMembershipId) return resource.assignedMembershipId === actor.membershipId;
    return (
      resource.departmentId === null ||
      resource.departmentId === undefined ||
      resource.departmentId === actor.departmentId
    );
  },
  "request:start": (actor, resource) => {
    if (actor.kind !== "staff" || actor.role !== "STAFF") return true;
    return resource.assignedMembershipId === actor.membershipId;
  },
  "request:complete": (actor, resource) => {
    if (actor.kind !== "staff" || actor.role !== "STAFF") return true;
    return resource.assignedMembershipId === actor.membershipId;
  },
  "request:cancel_own": (actor, resource) => {
    if (actor.kind !== "guest") return true;
    return resource.ownerGuestId === actor.guestId;
  },
};
