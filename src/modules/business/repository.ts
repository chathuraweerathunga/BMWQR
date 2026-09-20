import { prisma } from "@/lib/prisma";

/**
 * Data access for the tenant root itself. Every OTHER module's repository
 * takes a `businessId` and scopes its queries by it; this is the one module
 * allowed to look businesses up by slug or list them platform-wide, because
 * it IS the tenant boundary rather than something scoped by one.
 */

export interface CreateBusinessInput {
  slug: string;
  name: string;
  type:
    | "HOTEL"
    | "RESORT"
    | "GUESTHOUSE"
    | "VILLA"
    | "RESTAURANT"
    | "CAFE"
    | "SALON"
    | "SPA"
    | "GYM"
    | "COWORKING"
    | "OFFICE"
    | "APARTMENT"
    | "EVENT_VENUE"
    | "OTHER";
  timezone?: string;
  currency?: string;
  defaultLocale?: string;
}

/** Creates a Business and its 1:1 BusinessSettings row together, so a
 * business never exists mid-setup without a settings row to attach
 * branding/feature flags to. */
export async function createBusiness(input: CreateBusinessInput) {
  return prisma.business.create({
    data: {
      slug: input.slug,
      name: input.name,
      type: input.type,
      timezone: input.timezone ?? "UTC",
      currency: input.currency ?? "USD",
      defaultLocale: input.defaultLocale ?? "en",
      settings: { create: {} },
    },
    include: { settings: true },
  });
}

export async function getBusinessById(businessId: string) {
  return prisma.business.findUnique({
    where: { id: businessId },
    include: { settings: true },
  });
}

export async function getBusinessBySlug(slug: string) {
  return prisma.business.findUnique({
    where: { slug },
    include: { settings: true },
  });
}

/** Platform-scoped listing (SUPER_ADMIN only — callers must authorize()
 * with a PlatformActor before calling this). */
export async function listBusinesses(params: { status?: "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED" } = {}) {
  return prisma.business.findMany({
    where: params.status ? { status: params.status } : undefined,
    orderBy: { createdAt: "desc" },
  });
}

export interface UpdateBusinessCoreInput {
  name?: string;
  timezone?: string;
  currency?: string;
  defaultLocale?: string;
}

/** Updates the tenant-identity fields on Business itself (name/timezone/
 * currency/locale) — distinct from `updateBusinessSettings`, which only
 * touches the 1:1 BusinessSettings (branding/contact) row. */
export async function updateBusinessCore(businessId: string, patch: UpdateBusinessCoreInput) {
  return prisma.business.update({
    where: { id: businessId },
    data: patch,
  });
}

export interface UpdateBusinessSettingsInput {
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  welcomeMessage?: string | null;
  address?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  description?: string | null;
  supportedLocales?: string[];
  featureFlags?: Record<string, boolean>;
}

export async function updateBusinessSettings(
  businessId: string,
  patch: UpdateBusinessSettingsInput,
) {
  return prisma.businessSettings.update({
    where: { businessId },
    data: patch,
  });
}
