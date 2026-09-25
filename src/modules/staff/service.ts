import { assertAuthorized } from "@/modules/auth/authorize";
import { AuthorizationError } from "@/modules/auth/types";
import type { MembershipRole, StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { generateSecureToken } from "@/lib/security/tokens";
import { logAudit } from "@/modules/audit/service";
import { getDepartmentById } from "@/modules/departments/repository";
import * as repo from "./repository";
import { hashPassword, verifyPassword } from "@/lib/security/password";

/**
 * Staff-facing team management (project instructions section 8 Step 5 /
 * section 14 roles). "Invite" here means creating the account directly
 * with a generated temporary password shown once to the inviter, rather
 * than emailing an invite link — there is no async notification
 * infrastructure yet (section 21 is explicitly deferred until real events
 * exist to notify about), so this is the honest MVP version: the owner
 * copies the temporary credentials and hands them to the new staff member
 * through whatever channel they already use, the same way the guest
 * activation link works today.
 */
export async function inviteStaffMember(
  actor: StaffActor,
  input: { name: string; email: string; role: MembershipRole; departmentId?: string | null },
) {
  assertAuthorized({ actor, action: "staff:invite", resource: { businessId: actor.businessId } });

  // `staff:invite` alone doesn't distinguish which role the invitee gets —
  // a MANAGER has that permission (base matrix) but must not be able to
  // hand out BUSINESS_OWNER, which carries billing/staff-management/
  // permission-changing power a MANAGER doesn't have themselves. Only an
  // actor who already holds `staff:update_role` (BUSINESS_OWNER only) may
  // create another owner.
  if (input.role === "BUSINESS_OWNER" && actor.role !== "BUSINESS_OWNER") {
    throw new AuthorizationError("NOT_PERMITTED");
  }

  if (!["STAFF", "MANAGER", "BUSINESS_OWNER"].includes(input.role)) {
    throw new ValidationError("Choose a role.");
  }
  const name = input.name.trim();
  if (!name) throw new ValidationError("Name is required.");
  if (name.length > 120) throw new ValidationError("Keep the name under 120 characters.");
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new ValidationError("Enter a valid email address.");
  }

  const existing = await repo.findUserByEmail(email);
  if (existing) {
    // Whether that email already has a membership at THIS business or a
    // different one, the honest answer for a "please create their account"
    // flow is the same: it can't be created fresh. Adding them to this
    // business under an existing account is a distinct feature (multiple
    // memberships per user, spec section 13/16) this MVP doesn't expose a
    // UI for yet.
    throw new ValidationError("A user with that email already exists.");
  }

  if (input.departmentId) {
    const department = await getDepartmentById(actor.businessId, input.departmentId);
    if (!department) throw new NotFoundError("Department");
  }

  // 12 random bytes (96 bits), base64url — far above the 8-character
  // minimum `signUpBusiness` enforces, and never persisted anywhere except
  // as this user's password hash.
  const temporaryPassword = generateSecureToken(12).token;

  const user = await repo.createStaffUser({
    email,
    password: temporaryPassword,
    name,
  });

  const membership = await repo.createMembership({
    businessId: actor.businessId,
    userId: user.id,
    role: input.role,
    departmentId: input.departmentId ?? null,
  });

  await logAudit(actor, {
    action: "staff.invited",
    entityType: "BusinessMembership",
    entityId: membership.id,
    newValue: { email: user.email, role: input.role, departmentId: input.departmentId ?? null },
  });

  return { user, membership, temporaryPassword };
}

export async function disableStaffMember(actor: StaffActor, membershipId: string) {
  assertAuthorized({ actor, action: "staff:disable", resource: { businessId: actor.businessId } });

  if (membershipId === actor.membershipId) {
    throw new ValidationError("You can't disable your own membership.");
  }

  const result = await repo.disableMembership(actor.businessId, membershipId);
  if (result.count === 0) throw new NotFoundError("Staff member");

  await logAudit(actor, {
    action: "staff.disabled",
    entityType: "BusinessMembership",
    entityId: membershipId,
  });

  return result;
}

/** Gives a disabled team member their access back. Same permission as
 * disabling (BUSINESS_OWNER only in the base matrix). */
export async function enableStaffMember(actor: StaffActor, membershipId: string) {
  assertAuthorized({ actor, action: "staff:disable", resource: { businessId: actor.businessId } });
  const result = await repo.enableMembership(actor.businessId, membershipId);
  if (result.count === 0) throw new NotFoundError("Staff member");
  await logAudit(actor, { action: "staff.enabled", entityType: "BusinessMembership", entityId: membershipId });
  return result;
}

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 200;

/**
 * A signed-in user changing their own password, e.g. replacing the
 * temporary one they were invited with. Requires the current password, so
 * an unattended signed-in screen can't be used to take over the account.
 * Not tenant-scoped: a User isn't owned by a business.
 */
export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await repo.getUserById(userId);
  if (!user) throw new NotFoundError("User");
  if (currentPassword.length > MAX_PASSWORD || !(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new ValidationError("Your current password isn't right.");
  }
  if (newPassword.length < MIN_PASSWORD) throw new ValidationError(`Use at least ${MIN_PASSWORD} characters.`);
  if (newPassword.length > MAX_PASSWORD) throw new ValidationError(`Use at most ${MAX_PASSWORD} characters.`);
  if (newPassword === currentPassword) throw new ValidationError("Choose a password different from the current one.");
  await repo.setUserPasswordHash(userId, await hashPassword(newPassword));
}
