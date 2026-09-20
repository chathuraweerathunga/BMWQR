export type GuestStayStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface GuestSessionLike {
  expiresAt: Date;
  revokedAt: Date | null;
}

export interface GuestStayLike {
  status: GuestStayStatus;
  checkOutAt: Date;
}

export type GuestSessionInvalidReason =
  | "REVOKED"
  | "EXPIRED"
  | "STAY_NOT_ACTIVE"
  | "STAY_EXPIRED";

export type GuestSessionValidityResult =
  | { valid: true }
  | { valid: false; reason: GuestSessionInvalidReason };
