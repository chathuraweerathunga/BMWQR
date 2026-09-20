import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";
import type { LocationStatus, LocationType } from "./types";

/**
 * Staff-facing location management (project instructions section 8 Step
 * 3 / section 12: the generic, hierarchical Location model). This is a
 * prerequisite for QR code creation — a QR always identifies a location,
 * and until this module had a route calling it, a business could only get
 * locations onto the platform via the seed script or Prisma Studio.
 */
export async function createLocation(
  actor: StaffActor,
  input: { name: string; type: LocationType; parentLocationId?: string | null; description?: string | null },
) {
  assertAuthorized({
    actor,
    action: "location:manage",
    resource: { businessId: actor.businessId },
  });

  const name = input.name.trim();
  if (!name) throw new ValidationError("Location name is required.");

  if (input.parentLocationId) {
    const parent = await repo.getLocationById(actor.businessId, input.parentLocationId);
    if (!parent) throw new NotFoundError("Parent location");
  }

  const location = await repo.createLocation({
    businessId: actor.businessId,
    name,
    type: input.type,
    parentLocationId: input.parentLocationId ?? null,
    description: input.description ?? null,
  });

  await logAudit(actor, {
    action: "location.created",
    entityType: "Location",
    entityId: location.id,
    newValue: { name, type: input.type, parentLocationId: input.parentLocationId ?? null },
  });

  return location;
}

export async function setLocationStatus(actor: StaffActor, locationId: string, status: LocationStatus) {
  assertAuthorized({
    actor,
    action: "location:manage",
    resource: { businessId: actor.businessId },
  });

  const result = await repo.updateLocationStatus(actor.businessId, locationId, status);
  if (result.count === 0) throw new NotFoundError("Location");

  await logAudit(actor, {
    action: "location.status_changed",
    entityType: "Location",
    entityId: locationId,
    newValue: { status },
  });

  return result;
}
