import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";
import { LOCATION_STATUSES, LOCATION_TYPES, type LocationStatus, type LocationType } from "./types";

const MAX_NAME_LENGTH = 80;
const MAX_BULK = 300;

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
  if (name.length > MAX_NAME_LENGTH) throw new ValidationError(`Keep the name under ${MAX_NAME_LENGTH} characters.`);
  if (!(LOCATION_TYPES as readonly string[]).includes(input.type)) throw new ValidationError("Choose a location type.");

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

  if (!(LOCATION_STATUSES as readonly string[]).includes(status)) throw new ValidationError("Unknown status.");
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

/**
 * Adds a numbered run of locations in one go, e.g. "Room 101" to
 * "Room 150" under "Floor 1". Hotels have tens or hundreds of rooms;
 * adding them one by one is how setups get abandoned.
 */
export async function createLocationRange(
  actor: StaffActor,
  input: { prefix: string; from: number; to: number; type: LocationType; parentLocationId?: string | null },
) {
  assertAuthorized({ actor, action: "location:manage", resource: { businessId: actor.businessId } });

  const prefix = input.prefix.trim();
  if (prefix.length > MAX_NAME_LENGTH - 6) throw new ValidationError("That name prefix is too long.");
  if (!Number.isInteger(input.from) || !Number.isInteger(input.to) || input.from < 0 || input.to < input.from) {
    throw new ValidationError("Enter a number range like 101 to 150.");
  }
  const count = input.to - input.from + 1;
  if (count > MAX_BULK) throw new ValidationError(`Add at most ${MAX_BULK} at a time.`);
  if (!(LOCATION_TYPES as readonly string[]).includes(input.type)) throw new ValidationError("Choose a location type.");
  if (input.parentLocationId) {
    const parent = await repo.getLocationById(actor.businessId, input.parentLocationId);
    if (!parent) throw new NotFoundError("Parent location");
  }

  const existing = new Set(
    (await repo.listLocationsForBusiness(actor.businessId)).map((l: { name: string }) => l.name.toLowerCase()),
  );
  const names = Array.from({ length: count }, (_, i) => `${prefix ? `${prefix} ` : ""}${input.from + i}`).filter(
    (n) => !existing.has(n.toLowerCase()),
  );

  const created = await repo.createLocationsMany(
    names.map((name) => ({
      businessId: actor.businessId,
      name,
      type: input.type,
      parentLocationId: input.parentLocationId ?? null,
    })),
  );

  await logAudit(actor, {
    action: "location.bulk_created",
    entityType: "Location",
    newValue: { prefix, from: input.from, to: input.to, created: created.count, skipped: count - names.length },
  });

  return { created: created.count, skipped: count - names.length };
}
