import QRCode from "qrcode";
import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { getLocationById, listLocationsForBusiness } from "@/modules/locations/repository";
import { env } from "@/lib/env";
import { logAudit } from "@/modules/audit/service";
import { buildQrUrl } from "./qr-token";
import * as repo from "./repository";

/**
 * Staff-facing QR management. Every function here authorizes with
 * `qr:manage` (BUSINESS_OWNER/MANAGER only, per the base role matrix)
 * before touching a row. The raw token is only ever available in the
 * return value of `createQr`/`regenerateQr` — callers must show it to the
 * staff member once and never persist it themselves either.
 */

async function toDisplayable(rawToken: string) {
  const url = buildQrUrl(env.APP_URL, rawToken);
  const imageDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 320 });
  return { url, imageDataUrl };
}

export async function createQr(
  actor: StaffActor,
  input: { locationId: string; label?: string | null },
) {
  assertAuthorized({ actor, action: "qr:manage", resource: { businessId: actor.businessId } });
  const location = await getLocationById(actor.businessId, input.locationId);
  if (!location) throw new NotFoundError("Location");
  if (input.label && input.label.length > 60) throw new ValidationError("Keep the label under 60 characters.");
  const { qrCode, token } = await repo.createQrCode({
    businessId: actor.businessId,
    locationId: input.locationId,
    label: input.label,
  });
  await logAudit(actor, {
    action: "qr.created",
    entityType: "QRCode",
    entityId: qrCode.id,
    newValue: { locationId: input.locationId, label: input.label ?? null },
  });
  return { qrCode, ...(await toDisplayable(token)) };
}

/** Issues a fresh token for an existing QR record — e.g. a printed QR was
 * lost or the location wants to invalidate every copy in circulation. The
 * old token stops resolving the instant this runs. */
export async function regenerateQr(actor: StaffActor, qrCodeId: string) {
  assertAuthorized({ actor, action: "qr:manage", resource: { businessId: actor.businessId } });
  const result = await repo.regenerateQrCode(actor.businessId, qrCodeId);
  if (!result) throw new NotFoundError("QR code");
  await logAudit(actor, { action: "qr.regenerated", entityType: "QRCode", entityId: qrCodeId });
  return toDisplayable(result.token);
}

export async function setQrStatus(
  actor: StaffActor,
  qrCodeId: string,
  status: "ACTIVE" | "DISABLED",
) {
  assertAuthorized({ actor, action: "qr:manage", resource: { businessId: actor.businessId } });
  const result = await repo.setQrCodeStatus(actor.businessId, qrCodeId, status);
  if (result.count === 0) throw new NotFoundError("QR code");
  await logAudit(actor, {
    action: status === "ACTIVE" ? "qr.enabled" : "qr.disabled",
    entityType: "QRCode",
    entityId: qrCodeId,
    newValue: { status },
  });
  return result;
}

const MAX_BATCH = 300;

/** Structural locations guests are never "at": no QR code by default. */
export const NO_QR_BY_DEFAULT: ReadonlySet<string> = new Set(["BUILDING", "FLOOR"]);

/**
 * Creates one QR code for every ACTIVE location of the given types that
 * doesn't already have an active code: "give every room its QR" in one
 * step. Returns each code's image and link for printing right away; the
 * raw tokens are never stored, so this is the only moment they exist.
 */
export async function createQrForUncoveredLocations(
  actor: StaffActor,
  input: { types?: string[] } = {},
) {
  assertAuthorized({ actor, action: "qr:manage", resource: { businessId: actor.businessId } });

  const [locations, existing] = await Promise.all([
    listLocationsForBusiness(actor.businessId),
    repo.listQrCodesForBusiness(actor.businessId),
  ]);
  const covered = new Set(
    existing.filter((q: { status: string }) => q.status === "ACTIVE").map((q: { locationId: string }) => q.locationId),
  );
  const targets = locations
    .filter((l: { status: string; type: string; id: string }) =>
      l.status === "ACTIVE" &&
      !covered.has(l.id) &&
      (input.types?.length ? input.types.includes(l.type) : !NO_QR_BY_DEFAULT.has(l.type)),
    )
    .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .slice(0, MAX_BATCH);

  const codes: Array<{ locationName: string; url: string; imageDataUrl: string }> = [];
  for (const location of targets) {
    const { token } = await repo.createQrCode({ businessId: actor.businessId, locationId: location.id });
    codes.push({ locationName: location.name, ...(await toDisplayable(token)) });
  }

  if (codes.length) {
    await logAudit(actor, {
      action: "qr.bulk_created",
      entityType: "QRCode",
      newValue: { count: codes.length, types: input.types ?? null },
    });
  }
  return codes;
}
