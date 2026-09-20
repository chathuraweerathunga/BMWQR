import { ValidationError } from "@/lib/errors";
import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { createStaffUser, createMembership, findUserByEmail } from "@/modules/staff/repository";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";
import type { CreateBusinessInput, UpdateBusinessCoreInput, UpdateBusinessSettingsInput } from "./repository";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_PASSWORD_LENGTH = 8;

export interface SignUpBusinessInput {
  businessName: string;
  businessSlug: string;
  businessType: CreateBusinessInput["type"];
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
}

/**
 * The public business-signup flow (project instructions section 8, Step 1).
 * Creates, in sequence: the Business (+ its 1:1 BusinessSettings row), a
 * brand-new User for the owner, and the BusinessMembership that actually
 * grants that user BUSINESS_OWNER access — creating a User or Business row
 * alone grants no access (see modules/staff/repository.ts).
 *
 * Deliberately NOT wrapped in a single database transaction: each step is
 * an independent create-only write that can't corrupt another tenant's
 * data even on partial failure (worst case: an orphaned Business with no
 * owner, which a platform admin can clean up — never a security issue).
 * This codebase reserves `$transaction` for writes that must be atomic to
 * preserve an invariant a partial write would actively break — e.g. a
 * Request always having its first history row (requests/repository.ts), or
 * a checkout never leaving a session valid past its stay
 * (guest-stays/repository.ts) — not for a one-time setup flow like this.
 */
export async function signUpBusiness(input: SignUpBusinessInput) {
  const slug = input.businessSlug.trim().toLowerCase();
  if (!SLUG_PATTERN.test(slug)) {
    throw new ValidationError(
      "Workspace URL must be lowercase letters, numbers and hyphens only (e.g. ocean-pearl-resort).",
    );
  }
  if (!input.businessName.trim()) {
    throw new ValidationError("Business name is required.");
  }
  if (!input.ownerName.trim()) {
    throw new ValidationError("Your name is required.");
  }
  if (input.ownerPassword.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }

  const existingBusiness = await repo.getBusinessBySlug(slug);
  if (existingBusiness) {
    throw new ValidationError("That workspace URL is already taken — please choose another.");
  }
  const existingUser = await findUserByEmail(input.ownerEmail);
  if (existingUser) {
    throw new ValidationError("An account with that email already exists — please sign in instead.");
  }

  const business = await repo.createBusiness({
    slug,
    name: input.businessName.trim(),
    type: input.businessType,
  });

  const owner = await createStaffUser({
    email: input.ownerEmail,
    password: input.ownerPassword,
    name: input.ownerName.trim(),
  });

  const membership = await createMembership({
    businessId: business.id,
    userId: owner.id,
    role: "BUSINESS_OWNER",
  });

  await logAudit(
    {
      kind: "staff",
      userId: owner.id,
      businessId: business.id,
      membershipId: membership.id,
      role: "BUSINESS_OWNER",
      departmentId: null,
    },
    {
      action: "business.signed_up",
      entityType: "Business",
      entityId: business.id,
      newValue: { name: business.name, slug: business.slug, type: business.type },
    },
  );

  return { business, owner, membership };
}

/** Updates the tenant-identity fields (name/timezone/currency/locale) —
 * BUSINESS_OWNER or MANAGER only, same permission as branding/contact
 * settings below. Kept as a separate function from
 * `updateBusinessSettings` because it touches a different table
 * (Business, not BusinessSettings), but the two are typically submitted
 * from the same settings form. */
export async function updateBusinessCore(actor: StaffActor, patch: UpdateBusinessCoreInput) {
  assertAuthorized({
    actor,
    action: "business:update_settings",
    resource: { businessId: actor.businessId },
  });

  if (patch.name !== undefined && !patch.name.trim()) {
    throw new ValidationError("Business name cannot be empty.");
  }

  const updated = await repo.updateBusinessCore(actor.businessId, patch);

  await logAudit(actor, {
    action: "business.core_updated",
    entityType: "Business",
    entityId: actor.businessId,
    newValue: patch as Record<string, unknown>,
  });

  return updated;
}

/**
 * Staff-facing business settings update (project instructions section 8
 * Step 2 / section 26 white-labeling). BUSINESS_OWNER or MANAGER only, per
 * the base permission matrix.
 */
export async function updateBusinessSettings(actor: StaffActor, patch: UpdateBusinessSettingsInput) {
  assertAuthorized({
    actor,
    action: "business:update_settings",
    resource: { businessId: actor.businessId },
  });

  const updated = await repo.updateBusinessSettings(actor.businessId, patch);

  await logAudit(actor, {
    action: "business.settings_updated",
    entityType: "BusinessSettings",
    entityId: actor.businessId,
    newValue: patch as Record<string, unknown>,
  });

  return updated;
}
