import { cookies } from "next/headers";
import { GUEST_SESSION_COOKIE } from "@/lib/guest-cookie";
import { findSessionByToken } from "@/modules/guest-sessions/repository";
import { isGuestSessionValid } from "@/modules/guest-sessions/guest-session";
import type { GuestActor } from "@/modules/auth/types";
import type { GuestSessionInvalidReason } from "@/modules/guest-sessions/types";

/** User-facing copy for every way a guest can land on a portal page without
 * a usable session. Shared by every guest-facing route so the wording (and
 * the set of reasons callers must handle) stays in one place. */
export const GUEST_ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: "That link or QR code isn't valid. Please ask reception for a new one.",
  QR_DISABLED: "This QR code has been disabled. Please ask staff for assistance.",
  BUSINESS_INACTIVE: "This property's services aren't available right now.",
  NO_GUEST_SESSION:
    "We couldn't find your session. Please use the activation link reception gave you at check-in.",
  GUEST_SESSION_REVOKED: "Your session has ended. Please contact reception.",
  GUEST_SESSION_EXPIRED: "Your session has expired. Please contact reception for a new link.",
  GUEST_STAY_NOT_ACTIVE:
    "We couldn't find an active stay for this session. Please contact reception.",
  GUEST_STAY_EXPIRED: "Your stay has ended — thank you for visiting!",
  TENANT_MISMATCH: "That link doesn't match your session. Please contact reception.",
  RATE_LIMITED: "Too many attempts — please wait a moment and try again.",
};

const INVALID_REASON_TO_ERROR_CODE: Record<GuestSessionInvalidReason, string> = {
  REVOKED: "GUEST_SESSION_REVOKED",
  EXPIRED: "GUEST_SESSION_EXPIRED",
  STAY_NOT_ACTIVE: "GUEST_STAY_NOT_ACTIVE",
  STAY_EXPIRED: "GUEST_STAY_EXPIRED",
};

export type GuestPortalContextResult =
  | { ok: true; actor: GuestActor }
  | { ok: false; errorCode: string };

/**
 * The one place every guest-facing page/action re-derives "who is this
 * guest" from the session cookie. Never trust a client-supplied
 * guestId/guestStayId/businessId (project instructions section 7/20) — this
 * is the sole path from an opaque cookie value to a usable `GuestActor`,
 * re-validating the session and stay on every call rather than caching a
 * verdict across requests.
 */
export async function getGuestPortalContext(): Promise<GuestPortalContextResult> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(GUEST_SESSION_COOKIE)?.value ?? null;
  if (!rawToken) {
    return { ok: false, errorCode: "NO_GUEST_SESSION" };
  }

  const session = await findSessionByToken(rawToken);
  if (!session) {
    return { ok: false, errorCode: "NO_GUEST_SESSION" };
  }

  const validity = isGuestSessionValid(
    { expiresAt: session.expiresAt, revokedAt: session.revokedAt },
    { status: session.guestStay.status, checkOutAt: session.guestStay.checkOutAt },
    new Date(),
  );
  if (!validity.valid) {
    return { ok: false, errorCode: INVALID_REASON_TO_ERROR_CODE[validity.reason] };
  }

  return {
    ok: true,
    actor: {
      kind: "guest",
      guestId: session.guestStay.guestId,
      businessId: session.businessId,
      guestStayId: session.guestStay.id,
      guestSessionId: session.id,
    },
  };
}
