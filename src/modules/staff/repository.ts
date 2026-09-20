import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/security/password";
import type { StaffActor } from "@/modules/auth/types";

/**
 * Data access for platform identities (User) and their per-business
 * memberships (BusinessMembership) — the ONLY path by which a staff member
 * gets access to a business's data (see docs/ARCHITECTURE.md).
 */

export interface CreateStaffUserInput {
  email: string;
  password: string;
  name: string;
}

/** Creates a brand-new User (a login identity — NOT yet tied to any
 * business) with a securely hashed password. Pair with `createMembership`
 * to actually grant access to a specific business. */
export async function createStaffUser(input: CreateStaffUserInput) {
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      email: input.email.toLowerCase().trim(),
      passwordHash,
      name: input.name,
    },
  });
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
}

export interface CreateMembershipInput {
  businessId: string;
  userId: string;
  role: "BUSINESS_OWNER" | "MANAGER" | "STAFF";
  departmentId?: string | null;
}

/** Grants a User access to a business with a role. This is the operation
 * that actually authorizes a staff member — creating a User alone grants
 * nothing. */
export async function createMembership(input: CreateMembershipInput) {
  return prisma.businessMembership.create({
    data: {
      businessId: input.businessId,
      userId: input.userId,
      role: input.role,
      departmentId: input.departmentId ?? null,
    },
  });
}

/**
 * Resolves the single ACTIVE membership a user has at a specific business.
 * This — not the raw userId, and never a client-supplied businessId — is
 * the only correct source for constructing a `StaffActor`.
 */
export async function getActiveMembership(userId: string, businessId: string) {
  return prisma.businessMembership.findFirst({
    where: { userId, businessId, status: "ACTIVE" },
  });
}

/**
 * Builds a `StaffActor` for `authorize()` from a verified, ACTIVE
 * membership row. Never construct a StaffActor by hand from request input
 * elsewhere in the codebase — always go through this after loading the
 * membership server-side (e.g. from the authenticated session).
 */
export function toStaffActor(membership: {
  userId: string;
  businessId: string;
  id: string;
  role: "BUSINESS_OWNER" | "MANAGER" | "STAFF";
  departmentId: string | null;
}): StaffActor {
  return {
    kind: "staff",
    userId: membership.userId,
    businessId: membership.businessId,
    membershipId: membership.id,
    role: membership.role,
    departmentId: membership.departmentId,
  };
}

/**
 * Every ACTIVE membership a user holds, across ALL businesses — the one
 * legitimate cross-tenant query in this module. Used only to let a signed-in
 * user pick which of *their own* businesses to act in (the "business
 * switcher"); it never returns anything about a business the user isn't a
 * member of, so it doesn't violate tenant isolation despite spanning
 * tenants.
 */
export async function listActiveMembershipsForUser(userId: string) {
  return prisma.businessMembership.findMany({
    where: { userId, status: "ACTIVE" },
    include: { business: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function listStaffForBusiness(businessId: string) {
  return prisma.businessMembership.findMany({
    where: { businessId },
    include: { user: { select: { id: true, name: true, email: true } }, department: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function disableMembership(businessId: string, membershipId: string) {
  // Scoped by businessId in the WHERE clause (not just the id) so this can
  // never disable a membership belonging to a different tenant even if a
  // caller passed the wrong id by mistake.
  return prisma.businessMembership.updateMany({
    where: { id: membershipId, businessId },
    data: { status: "DISABLED" },
  });
}
