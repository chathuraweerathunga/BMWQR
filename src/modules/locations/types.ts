/** Mirrors the `LocationType` enum in prisma/schema.prisma. Kept as a
 * plain TypeScript union + array here (rather than importing the Prisma
 * enum) so the value list is available to UI code without depending on the
 * generated Prisma Client — useful in this sandbox where that client isn't
 * generated yet, and harmless once it is. */
export const LOCATION_TYPES = [
  "ROOM",
  "BUILDING",
  "FLOOR",
  "POOL",
  "TABLE",
  "BAR",
  "PRIVATE_ROOM",
  "SPA_ROOM",
  "TREATMENT_ROOM",
  "CHAIR",
  "GYM_AREA",
  "EQUIPMENT",
  "LOCKER",
  "DESK",
  "MEETING_ROOM",
  "UNIT",
  "COMMON_AREA",
  "PARKING",
  "RECEPTION",
  "OTHER",
] as const;

export type LocationType = (typeof LOCATION_TYPES)[number];

export const LOCATION_STATUSES = ["ACTIVE", "INACTIVE", "MAINTENANCE"] as const;
export type LocationStatus = (typeof LOCATION_STATUSES)[number];
