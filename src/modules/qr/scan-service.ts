import { getActiveStayById } from "@/modules/guest-stays/repository";
import { findSessionByToken, touchLastSeen } from "@/modules/guest-sessions/repository";
import { findQrCodeByToken, recordScan } from "./repository";
import { resolveQrScan } from "./qr-token";
import type { QrScanResult } from "./types";

export interface ScanQrInput {
  /** The raw token from the scanned URL path (`/qr/[token]`). */
  rawQrToken: string;
  /** The raw token from the guest's session cookie, if any — never a
   *  guestId/guestStayId/businessId read directly from anywhere client
   *  controlled. */
  sessionTokenFromCookie: string | null;
  now?: Date;
}

/**
 * The only function a route handler should call to process a QR scan. It
 * loads exactly what `resolveQrScan()` needs (never more), runs the pure
 * checklist, and — only on success — records the scan and touches the
 * session's last-seen timestamp. Rate limiting happens one layer up, in
 * the route/proxy, before this is ever invoked (spec section 6, step 8).
 */
export async function scanQr({
  rawQrToken,
  sessionTokenFromCookie,
  now = new Date(),
}: ScanQrInput): Promise<QrScanResult> {
  const qrCodeRow = await findQrCodeByToken(rawQrToken);

  const sessionRow = sessionTokenFromCookie
    ? await findSessionByToken(sessionTokenFromCookie)
    : null;

  // The guest's session must itself belong to the QR's business for us to
  // even bother loading the stay — resolveQrScan() also checks this, but
  // skipping the extra query here keeps a cross-tenant cookie from ever
  // causing a lookup against another tenant's stay.
  const guestStayRow =
    sessionRow && qrCodeRow && sessionRow.businessId === qrCodeRow.businessId
      ? await getActiveStayById(qrCodeRow.businessId, sessionRow.guestStayId)
      : null;

  const result = resolveQrScan({
    qrCode: qrCodeRow
      ? { businessId: qrCodeRow.businessId, locationId: qrCodeRow.locationId, status: qrCodeRow.status }
      : null,
    business: qrCodeRow?.business ? { status: qrCodeRow.business.status } : null,
    guestSession: sessionRow
      ? {
          id: sessionRow.id,
          businessId: sessionRow.businessId,
          guestStayId: sessionRow.guestStayId,
          expiresAt: sessionRow.expiresAt,
          revokedAt: sessionRow.revokedAt,
        }
      : null,
    guestStay: guestStayRow
      ? {
          businessId: guestStayRow.businessId,
          status: guestStayRow.status,
          checkOutAt: guestStayRow.checkOutAt,
        }
      : null,
    now,
  });

  if (result.ok && qrCodeRow) {
    // Fire-and-forget bookkeeping — never let an analytics update block or
    // fail the guest's actual access decision.
    void recordScan(qrCodeRow.id).catch(() => undefined);
    void touchLastSeen(result.guestSessionId, now).catch(() => undefined);
  }

  return result;
}
