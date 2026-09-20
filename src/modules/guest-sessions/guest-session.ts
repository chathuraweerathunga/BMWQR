import { generateSecureToken, hashToken } from "@/lib/security/tokens";
import type {
  GuestSessionLike,
  GuestSessionValidityResult,
  GuestStayLike,
} from "./types";

/** Default upper bound on how long a single guest session token stays
 * valid before the guest's browser needs a fresh one, independent of how
 * far away checkout is. Keeps a stolen/leaked session cookie from being
 * useful for the guest's entire (possibly multi-day) stay. */
export const DEFAULT_MAX_SESSION_HOURS = 24;

/**
 * Generates a new guest session token. The raw `token` is set in the
 * guest's secure, httpOnly cookie exactly once; only `tokenHash` is
 * persisted to GuestSession.tokenHash (project instructions section 7:
 * "Use secure cookies/tokens", never store the raw secret server-side).
 */
export function generateGuestSessionToken(): { token: string; tokenHash: string } {
  return generateSecureToken(32);
}

export function hashGuestSessionToken(token: string): string {
  return hashToken(token);
}

/**
 * Computes the expiry to set on a new/refreshed guest session.
 *
 * A session must NEVER outlive the guest's stay (it becomes invalid at
 * checkout, per section 4), but it also should not simply be set to
 * `checkOutAt` for a multi-day stay — that would let a single leaked
 * cookie stay valid for days. So the expiry is the earlier of:
 *   - `now + maxSessionHours` (a rolling cap, refreshed on normal use), and
 *   - the stay's `checkOutAt` (the hard ceiling).
 */
export function computeGuestSessionExpiry(
  guestStayCheckOutAt: Date,
  now: Date = new Date(),
  maxSessionHours: number = DEFAULT_MAX_SESSION_HOURS,
): Date {
  const rollingExpiry = new Date(now.getTime() + maxSessionHours * 60 * 60 * 1000);
  return rollingExpiry.getTime() < guestStayCheckOutAt.getTime()
    ? rollingExpiry
    : guestStayCheckOutAt;
}

/**
 * Re-derivable validity check for an existing guest session, independent
 * of the QR-scan flow — this is what the "open the Guest Services portal
 * directly, no QR needed" path (section 5, Method 1) should call on every
 * request to re-validate the session cookie.
 */
export function isGuestSessionValid(
  session: GuestSessionLike,
  stay: GuestStayLike,
  now: Date = new Date(),
): GuestSessionValidityResult {
  if (session.revokedAt) {
    return { valid: false, reason: "REVOKED" };
  }
  if (session.expiresAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "EXPIRED" };
  }
  if (stay.status !== "ACTIVE") {
    return { valid: false, reason: "STAY_NOT_ACTIVE" };
  }
  if (stay.checkOutAt.getTime() <= now.getTime()) {
    return { valid: false, reason: "STAY_EXPIRED" };
  }
  return { valid: true };
}
