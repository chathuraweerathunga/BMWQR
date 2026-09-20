import QRCode from "qrcode";
import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { NotFoundError } from "@/lib/errors";
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
