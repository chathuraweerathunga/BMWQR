import { describe, expect, it } from "vitest";
import { authorize, assertAuthorized } from "./authorize";
import { AuthorizationError } from "./types";
import type { GuestActor, StaffActor } from "./types";

const BUSINESS_A = "biz_a";
const BUSINESS_B = "biz_b";

function staff(overrides: Partial<StaffActor> = {}): StaffActor {
  return {
    kind: "staff",
    userId: "user_1",
    businessId: BUSINESS_A,
    membershipId: "mem_1",
    role: "STAFF",
    departmentId: "dept_housekeeping",
    ...overrides,
  };
}

function guest(overrides: Partial<GuestActor> = {}): GuestActor {
  return {
    kind: "guest",
    guestId: "guest_1",
    businessId: BUSINESS_A,
    guestStayId: "stay_1",
    guestSessionId: "sess_1",
    ...overrides,
  };
}

describe("authorize: tenant isolation", () => {
  it("denies a staff actor acting on a resource from a different business", () => {
    const result = authorize({
      actor: staff({ businessId: BUSINESS_A, role: "BUSINESS_OWNER" }),
      action: "location:manage",
      resource: { businessId: BUSINESS_B },
    });
    expect(result).toEqual({ allowed: false, reason: "CROSS_TENANT" });
  });

  it("denies a guest actor acting on a resource from a different business", () => {
    const result = authorize({
      actor: guest({ businessId: BUSINESS_A }),
      action: "request:view_own",
      resource: { businessId: BUSINESS_B, ownerGuestId: "guest_1" },
    });
    expect(result).toEqual({ allowed: false, reason: "CROSS_TENANT" });
  });

  it("denies cross-tenant access even when the actor otherwise has full permissions", () => {
    const result = authorize({
      actor: staff({ role: "BUSINESS_OWNER", businessId: BUSINESS_A }),
      action: "business:manage_billing",
      resource: { businessId: BUSINESS_B },
    });
    expect(result.allowed).toBe(false);
  });

  it("allows same-tenant access for a permitted action", () => {
    const result = authorize({
      actor: staff({ role: "BUSINESS_OWNER" }),
      action: "location:manage",
      resource: { businessId: BUSINESS_A },
    });
    expect(result).toEqual({ allowed: true, viaPlatformOverride: false });
  });

  it("allows a platform actor to cross tenants, flagged for audit logging", () => {
    const result = authorize({
      actor: { kind: "platform", userId: "root_admin" },
      action: "business:view_audit_log",
      resource: { businessId: BUSINESS_B },
    });
    expect(result).toEqual({ allowed: true, viaPlatformOverride: true });
  });

  it("does not flag platform override when no businessId is on the resource", () => {
    const result = authorize({
      actor: { kind: "platform", userId: "root_admin" },
      action: "business:view_audit_log",
    });
    expect(result).toEqual({ allowed: true, viaPlatformOverride: false });
  });
});

describe("authorize: role permission matrix", () => {
  it("denies STAFF a MANAGER-only action", () => {
    const result = authorize({
      actor: staff({ role: "STAFF" }),
      action: "request:reject",
      resource: { businessId: BUSINESS_A },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_PERMITTED" });
  });

  it("allows MANAGER to reject a request", () => {
    const result = authorize({
      actor: staff({ role: "MANAGER" }),
      action: "request:reject",
      resource: { businessId: BUSINESS_A },
    });
    expect(result.allowed).toBe(true);
  });

  it("denies STAFF from managing billing", () => {
    const result = authorize({
      actor: staff({ role: "STAFF" }),
      action: "business:manage_billing",
      resource: { businessId: BUSINESS_A },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_PERMITTED" });
  });

  it("denies a guest any staff-only permission", () => {
    const result = authorize({
      actor: guest(),
      action: "location:manage",
      resource: { businessId: BUSINESS_A },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_PERMITTED" });
  });

  it("allows a guest to create a request in their own business", () => {
    const result = authorize({
      actor: guest(),
      action: "request:create",
      resource: { businessId: BUSINESS_A },
    });
    expect(result.allowed).toBe(true);
  });
});

describe("authorize: row-level rules", () => {
  it("lets STAFF accept an unclaimed request in their own department", () => {
    const result = authorize({
      actor: staff({ departmentId: "dept_housekeeping" }),
      action: "request:accept",
      resource: {
        businessId: BUSINESS_A,
        departmentId: "dept_housekeeping",
        assignedMembershipId: null,
      },
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks STAFF from accepting a request already claimed by someone else", () => {
    const result = authorize({
      actor: staff({ membershipId: "mem_1" }),
      action: "request:accept",
      resource: {
        businessId: BUSINESS_A,
        departmentId: "dept_housekeeping",
        assignedMembershipId: "mem_2",
      },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_ASSIGNED" });
  });

  it("blocks STAFF from accepting a request in a different department", () => {
    const result = authorize({
      actor: staff({ departmentId: "dept_housekeeping" }),
      action: "request:accept",
      resource: {
        businessId: BUSINESS_A,
        departmentId: "dept_maintenance",
        assignedMembershipId: null,
      },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_ASSIGNED" });
  });

  it("lets STAFF complete a request assigned to them", () => {
    const result = authorize({
      actor: staff({ membershipId: "mem_1" }),
      action: "request:complete",
      resource: { businessId: BUSINESS_A, assignedMembershipId: "mem_1" },
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks STAFF from completing a request assigned to someone else", () => {
    const result = authorize({
      actor: staff({ membershipId: "mem_1" }),
      action: "request:complete",
      resource: { businessId: BUSINESS_A, assignedMembershipId: "mem_2" },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_ASSIGNED" });
  });

  it("lets STAFF accept a NEW request a manager assigned to them, even across departments", () => {
    const result = authorize({
      actor: staff({ membershipId: "mem_1", departmentId: "dept_housekeeping" }),
      action: "request:accept",
      resource: { businessId: BUSINESS_A, departmentId: "dept_maintenance", assignedMembershipId: "mem_1" },
    });
    expect(result.allowed).toBe(true);
  });

  it("lets a MANAGER with no department accept a department-routed request", () => {
    const result = authorize({
      actor: staff({ role: "MANAGER", departmentId: null }),
      action: "request:accept",
      resource: { businessId: BUSINESS_A, departmentId: "dept_housekeeping", assignedMembershipId: null },
    });
    expect(result.allowed).toBe(true);
  });

  it("lets a MANAGER finish a request someone else started", () => {
    for (const action of ["request:start", "request:complete"] as const) {
      const result = authorize({
        actor: staff({ role: "MANAGER", membershipId: "mem_mgr" }),
        action,
        resource: { businessId: BUSINESS_A, assignedMembershipId: "mem_2" },
      });
      expect(result.allowed).toBe(true);
    }
  });

  it("still keeps a MANAGER inside their own business", () => {
    const result = authorize({
      actor: staff({ role: "MANAGER" }),
      action: "request:complete",
      resource: { businessId: BUSINESS_B, assignedMembershipId: null },
    });
    expect(result).toEqual({ allowed: false, reason: "CROSS_TENANT" });
  });

  it("lets a guest view their own request", () => {
    const result = authorize({
      actor: guest({ guestId: "guest_1" }),
      action: "request:view_own",
      resource: { businessId: BUSINESS_A, ownerGuestId: "guest_1" },
    });
    expect(result.allowed).toBe(true);
  });

  it("blocks a guest from viewing another guest's request even in the same business", () => {
    const result = authorize({
      actor: guest({ guestId: "guest_1" }),
      action: "request:view_own",
      resource: { businessId: BUSINESS_A, ownerGuestId: "guest_2" },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_OWNER" });
  });

  it("blocks a guest from cancelling another guest's request", () => {
    const result = authorize({
      actor: guest({ guestId: "guest_1" }),
      action: "request:cancel_own",
      resource: { businessId: BUSINESS_A, ownerGuestId: "guest_2" },
    });
    expect(result).toEqual({ allowed: false, reason: "NOT_OWNER" });
  });
});

describe("assertAuthorized", () => {
  it("returns override info on success", () => {
    const outcome = assertAuthorized({
      actor: staff({ role: "BUSINESS_OWNER" }),
      action: "location:manage",
      resource: { businessId: BUSINESS_A },
    });
    expect(outcome).toEqual({ viaPlatformOverride: false });
  });

  it("throws AuthorizationError with the denial reason on failure", () => {
    expect(() =>
      assertAuthorized({
        actor: staff({ role: "STAFF" }),
        action: "business:manage_billing",
        resource: { businessId: BUSINESS_A },
      }),
    ).toThrowError(AuthorizationError);

    try {
      assertAuthorized({
        actor: staff({ businessId: BUSINESS_A }),
        action: "location:manage",
        resource: { businessId: BUSINESS_B },
      });
      expect.fail("expected AuthorizationError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AuthorizationError);
      expect((err as InstanceType<typeof AuthorizationError>).reason).toBe(
        "CROSS_TENANT",
      );
    }
  });
});
