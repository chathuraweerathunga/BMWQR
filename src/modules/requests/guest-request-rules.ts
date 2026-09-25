/**
 * Pure rules for turning a guest's portal submission into a routable
 * request. No Prisma, no I/O: the service layer loads the facts and these
 * functions decide, so the rules are unit-testable on their own.
 */

/** Which of the two server-known locations the guest wants help at. The
 * client only ever sends this label, never a location id. */
export type GuestLocationChoice = "scanned" | "stay";

export interface LocationFacts {
  /** Where the guest last scanned a QR code (server-recorded on the session). */
  scannedLocationId: string | null;
  /** The room/unit attached to the guest's stay at check-in. */
  stayLocationId: string | null;
}

/**
 * Resolves the location a guest request is routed to. Falls back to the
 * other known location if the chosen one is unknown, so a guest who never
 * scanned a QR still reaches their own room. Returns null only when the
 * server knows no location for this guest at all.
 */
export function resolveGuestRequestLocation(
  choice: GuestLocationChoice | null,
  facts: LocationFacts,
): string | null {
  if (choice === "stay") return facts.stayLocationId ?? facts.scannedLocationId;
  if (choice === "scanned") return facts.scannedLocationId ?? facts.stayLocationId;
  // No explicit choice: the most recent scan is the best signal of where
  // the guest is right now; their room is the fallback.
  return facts.scannedLocationId ?? facts.stayLocationId;
}

export const MAX_REQUEST_TITLE_LENGTH = 200;
export const MAX_REQUEST_DETAILS_LENGTH = 1000;

/** Collapses whitespace and trims. Returns null for effectively-empty input. */
export function normalizeGuestText(raw: string | null | undefined, maxLength: number): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.slice(0, maxLength);
}

/** When a request should be finished by, from the service's estimate. */
export function computeDueAt(estimatedMinutes: number | null | undefined, now: Date): Date | null {
  if (!estimatedMinutes || estimatedMinutes <= 0) return null;
  return new Date(now.getTime() + estimatedMinutes * 60_000);
}
