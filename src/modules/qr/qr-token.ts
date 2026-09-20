import { generateSecureToken, hashToken } from "@/lib/security/tokens";
import type { QrScanInput, QrScanResult } from "./types";

/**
 * Generates a new QR token. The raw `token` is what gets embedded in the
 * printed/displayed QR code's URL (e.g. `${APP_URL}/qr/${token}`) — it is
 * shown once at creation time and never persisted. Only `tokenHash` is
 * written to QRCode.tokenHash.
 *
 * Deliberately NOT a predictable path like `/room/208` (project
 * instructions section 6): the token has 256 bits of entropy from
 * `crypto.randomBytes`, so it cannot be guessed or enumerated.
 */
export function generateQrToken(): { token: string; tokenHash: string } {
  return generateSecureToken(32);
}

export function hashQrToken(token: string): string {
  return hashToken(token);
}

export function buildQrUrl(appUrl: string, token: string): string {
  return new URL(`/qr/${token}`, appUrl).toString();
}

/**
 * The QR-scan resolution checklist (project instructions section 6, steps
 * 1–8; steps 9–10 — issuing/reusing a session and restricting to permitted
 * functions — are the caller's job once this returns `ok: true`, and rate
 * limiting is applied at the route/middleware layer before this is even
 * called).
 *
 * This is a pure function: the caller is responsible for looking up the
 * QRCode (by `hashQrToken(scannedToken)`), its Business, and the guest's
 * current GuestSession + GuestStay (typically from a signed session cookie,
 * never from anything in the scanned URL). Keeping this pure makes every
 * branch — including ones that are security-critical and easy to get
 * wrong, like "session belongs to a different business than the QR" —
 * exhaustively unit-testable without a database.
 *
 * A QR code identifies a LOCATION. It never grants access on its own — the
 * guest must already carry a valid session tied to an active stay at this
 * same business. Photographing/sharing a QR code does not give an outsider
 * access (section 6).
 */
export function resolveQrScan({
  qrCode,
  business,
  guestSession,
  guestStay,
  now,
}: QrScanInput): QrScanResult {
  // 1. Token didn't resolve to any QR code at all.
  if (!qrCode) {
    return { ok: false, reason: "INVALID_TOKEN" };
  }

  // 2. QR has been disabled by the business (e.g. lost/compromised print-out).
  if (qrCode.status !== "ACTIVE") {
    return { ok: false, reason: "QR_DISABLED" };
  }

  // 3. The business itself must be usable (not suspended/cancelled). TRIAL
  //    businesses are allowed to operate normally.
  if (!business || business.status === "SUSPENDED" || business.status === "CANCELLED") {
    return { ok: false, reason: "BUSINESS_INACTIVE" };
  }

  // 4. The guest must already carry a session — a bare QR scan with no
  //    session proves nothing about who is holding the phone.
  if (!guestSession) {
    return { ok: false, reason: "NO_GUEST_SESSION" };
  }

  // 5 & 6. Session must not be revoked or expired.
  if (guestSession.revokedAt) {
    return { ok: false, reason: "GUEST_SESSION_REVOKED" };
  }
  if (guestSession.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "GUEST_SESSION_EXPIRED" };
  }

  // 7. Defense in depth: the session's own business must match the QR's
  //    business. The composite-FK schema makes this condition structurally
  //    guaranteed once both rows are loaded correctly, but a resolver that
  //    trusted that unconditionally would be one refactor away from a
  //    tenant-isolation bug — so it is checked explicitly here too.
  if (guestSession.businessId !== qrCode.businessId) {
    return { ok: false, reason: "TENANT_MISMATCH" };
  }

  // 8. The underlying stay must still be active and not past checkout.
  if (!guestStay || guestStay.status !== "ACTIVE") {
    return { ok: false, reason: "GUEST_STAY_NOT_ACTIVE" };
  }
  if (guestStay.checkOutAt.getTime() <= now.getTime()) {
    return { ok: false, reason: "GUEST_STAY_EXPIRED" };
  }
  if (guestStay.businessId !== qrCode.businessId) {
    return { ok: false, reason: "TENANT_MISMATCH" };
  }

  return {
    ok: true,
    businessId: qrCode.businessId,
    locationId: qrCode.locationId,
    guestStayId: guestSession.guestStayId,
    guestSessionId: guestSession.id,
  };
}
