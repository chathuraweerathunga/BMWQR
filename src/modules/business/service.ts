import { ValidationError } from "@/lib/errors";
import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { createStaffUser, createMembership, findUserByEmail } from "@/modules/staff/repository";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";
import type { CreateBusinessInput, UpdateBusinessCoreInput, UpdateBusinessSettingsInput } from "./repository";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MIN_PASSWORD_LENGTH = 8;
// scrypt cost grows with input length; cap it so a megabyte "password"
// can't be used to burn server CPU.
const MAX_PASSWORD_LENGTH = 200;
const MAX_NAME_LENGTH = 120;
const MIN_SLUG_LENGTH = 3;
const MAX_SLUG_LENGTH = 48;

/**
 * Workspace URLs live at the top level (`/{slug}/dashboard`), next to the
 * app's own routes. A business must never claim a slug that is, or may
 * become, a platform route.
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin", "api", "app", "assets", "auth", "billing", "dashboard", "docs", "help",
  "login", "logout", "manager", "oneweb", "platform", "portal", "pricing", "privacy",
  "qr", "register", "settings", "signin", "signout", "signup", "static", "status",
  "support", "terms", "www", "_next",
]);

/** Returns the timezone if the runtime recognises it, otherwise UTC. */
export function normalizeTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    return new Intl.DateTimeFormat("en", { timeZone }).resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export interface SignUpBusinessInput {
  businessName: string;
  businessSlug: string;
  businessType: CreateBusinessInput["type"];
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  /** IANA timezone detected from the owner's browser; editable later. */
  timezone?: string | null;
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
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    throw new ValidationError(
      `Workspace URL must be ${MIN_SLUG_LENGTH}–${MAX_SLUG_LENGTH} characters long.`,
    );
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new ValidationError("That workspace URL is reserved — please choose another.");
  }
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
  if (input.ownerPassword.length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at most ${MAX_PASSWORD_LENGTH} characters.`);
  }
  if (input.businessName.trim().length > MAX_NAME_LENGTH || input.ownerName.trim().length > MAX_NAME_LENGTH) {
    throw new ValidationError(`Names must be at most ${MAX_NAME_LENGTH} characters.`);
  }
  const ownerEmail = input.ownerEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail) || ownerEmail.length > 254) {
    throw new ValidationError("Please enter a valid email address.");
  }

  const existingBusiness = await repo.getBusinessBySlug(slug);
  if (existingBusiness) {
    throw new ValidationError("That workspace URL is already taken — please choose another.");
  }
  const existingUser = await findUserByEmail(ownerEmail);
  if (existingUser) {
    throw new ValidationError("An account with that email already exists — please sign in instead.");
  }

  const business = await repo.createBusiness({
    slug,
    name: input.businessName.trim(),
    type: input.businessType,
    timezone: normalizeTimeZone(input.timezone),
  });

  const owner = await createStaffUser({
    email: ownerEmail,
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

  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new ValidationError("Business name cannot be empty.");
    if (patch.name.trim().length > MAX_NAME_LENGTH) throw new ValidationError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
    patch = { ...patch, name: patch.name.trim() };
  }
  if (patch.timezone !== undefined) {
    const tz = normalizeTimeZone(patch.timezone);
    if (tz === "UTC" && patch.timezone !== "UTC" && patch.timezone !== "Etc/UTC") {
      throw new ValidationError("Choose a timezone from the list.");
    }
    patch = { ...patch, timezone: tz };
  }
  if (patch.currency !== undefined && !/^[A-Z]{3}$/.test(patch.currency)) {
    throw new ValidationError("Currency must be a three-letter code such as LKR or USD.");
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

  const clean = validateSettingsPatch(patch);
  const updated = await repo.updateBusinessSettings(actor.businessId, clean);

  await logAudit(actor, {
    action: "business.settings_updated",
    entityType: "BusinessSettings",
    entityId: actor.businessId,
    newValue: clean as Record<string, unknown>,
  });

  return updated;
}

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function httpsUrlOrNull(value: string | null | undefined, field: string, httpAllowed = false): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ValidationError(`${field} must be a full web address starting with https://`);
  }
  if (url.protocol !== "https:" && !(httpAllowed && url.protocol === "http:")) {
    throw new ValidationError(`${field} must start with https://`);
  }
  if (value.length > 500) throw new ValidationError(`${field} is too long.`);
  return url.toString();
}

/**
 * Branding and contact values end up on guest-facing pages (the logo as an
 * image source, the color in a style attribute), so they are checked
 * strictly here, not just in the form.
 */
export function validateSettingsPatch(patch: UpdateBusinessSettingsInput): UpdateBusinessSettingsInput {
  const out: UpdateBusinessSettingsInput = { ...patch };
  for (const key of ["primaryColor", "secondaryColor"] as const) {
    const v = patch[key];
    if (v !== undefined && v !== null && !HEX_COLOR.test(v)) throw new ValidationError("Colors must look like #1d6258.");
    if (v) out[key] = v.toLowerCase();
  }
  if (patch.logoUrl !== undefined) out.logoUrl = httpsUrlOrNull(patch.logoUrl, "Logo address");
  if (patch.coverImageUrl !== undefined) out.coverImageUrl = httpsUrlOrNull(patch.coverImageUrl, "Cover image address");
  if (patch.website !== undefined) out.website = httpsUrlOrNull(patch.website, "Website", true);
  if (patch.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.contactEmail)) {
    throw new ValidationError("Enter a valid contact email.");
  }
  if (patch.phone && !/^[+()\d\s-]{5,30}$/.test(patch.phone)) {
    throw new ValidationError("Enter a phone number using digits, spaces, + and -.");
  }
  const limits: Array<[keyof UpdateBusinessSettingsInput, number]> = [
    ["welcomeMessage", 280],
    ["description", 1000],
    ["address", 300],
  ];
  for (const [key, max] of limits) {
    const v = patch[key];
    if (typeof v === "string" && v.length > max) throw new ValidationError(`Keep that under ${max} characters.`);
  }
  return out;
}
