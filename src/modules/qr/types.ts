export type QrCodeStatus = "ACTIVE" | "DISABLED";
export type BusinessStatus = "TRIAL" | "ACTIVE" | "SUSPENDED" | "CANCELLED";
export type GuestStayStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

/** Minimal shape the resolver needs from a looked-up QRCode row. */
export interface QrCodeRecord {
  businessId: string;
  locationId: string;
  status: QrCodeStatus;
}

/** Minimal shape the resolver needs from the QR's parent Business row. */
export interface BusinessRecord {
  status: BusinessStatus;
}

/** Minimal shape the resolver needs from the guest's current GuestSession. */
export interface GuestSessionRecord {
  id: string;
  businessId: string;
  guestStayId: string;
  expiresAt: Date;
  revokedAt: Date | null;
}

/** Minimal shape the resolver needs from the session's GuestStay. */
export interface GuestStayRecord {
  businessId: string;
  status: GuestStayStatus;
  checkOutAt: Date;
}

export type QrScanDenialReason =
  | "INVALID_TOKEN"
  | "QR_DISABLED"
  | "BUSINESS_INACTIVE"
  | "NO_GUEST_SESSION"
  | "GUEST_SESSION_REVOKED"
  | "GUEST_SESSION_EXPIRED"
  | "GUEST_STAY_NOT_ACTIVE"
  | "GUEST_STAY_EXPIRED"
  | "TENANT_MISMATCH";

export interface QrScanInput {
  /** null when no QRCode matched the scanned token's hash at all. */
  qrCode: QrCodeRecord | null;
  /** null when the QR's business could not be loaded (should not happen
   *  given the FK, but the resolver checks defensively anyway). */
  business: BusinessRecord | null;
  /** null when the guest has no current session (e.g. first-ever scan, or
   *  their previous session already expired and was not renewed). */
  guestSession: GuestSessionRecord | null;
  /** null when guestSession is null, or the stay could not be loaded. */
  guestStay: GuestStayRecord | null;
  now: Date;
}

export interface QrScanAllowed {
  ok: true;
  businessId: string;
  locationId: string;
  guestStayId: string;
  guestSessionId: string;
}

export interface QrScanDenied {
  ok: false;
  reason: QrScanDenialReason;
}

export type QrScanResult = QrScanAllowed | QrScanDenied;
