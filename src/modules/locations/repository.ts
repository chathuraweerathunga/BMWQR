import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { LocationStatus, LocationType } from "./types";

export interface CreateLocationInput {
  businessId: string;
  name: string;
  type: LocationType;
  parentLocationId?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createLocation(input: CreateLocationInput) {
  return prisma.location.create({
    data: {
      businessId: input.businessId,
      name: input.name,
      type: input.type,
      parentLocationId: input.parentLocationId ?? null,
      description: input.description ?? null,
      metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? {},
    },
  });
}

/** Tenant-scoped lookup: the WHERE clause includes businessId so a wrong
 * or spoofed locationId can never resolve to another tenant's row. */
export async function getLocationById(businessId: string, locationId: string) {
  return prisma.location.findFirst({ where: { id: locationId, businessId } });
}

export async function listLocationsForBusiness(
  businessId: string,
  params: { type?: LocationType; parentLocationId?: string | null } = {},
) {
  return prisma.location.findMany({
    where: {
      businessId,
      ...(params.type ? { type: params.type } : {}),
      ...(params.parentLocationId !== undefined
        ? { parentLocationId: params.parentLocationId }
        : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function updateLocationStatus(
  businessId: string,
  locationId: string,
  status: LocationStatus,
) {
  return prisma.location.updateMany({
    where: { id: locationId, businessId },
    data: { status },
  });
}
