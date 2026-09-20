import { prisma } from "@/lib/prisma";
import {
  computeGuestSessionExpiry,
  generateGuestSessionToken,
  hashGuestSessionToken,
} from "./guest-session";

/**
 * Issues a brand-new session for an ACTIVE stay. The raw `token` is
 * returned exactly once, for the caller to set as a secure httpOnly
 * cookie — never persisted, never logged (see guest-session.ts).
 */
export async function createSessionForStay(
  stay: { id: string; businessId: string; checkOutAt: Date },
  originQrCodeId?: string | null,
  now: Date = new Date(),
) {
  const { token, tokenHash } = generateGuestSessionToken();
  const expiresAt = computeGuestSessionExpiry(stay.checkOutAt, now);

  const session = await prisma.guestSession.create({
    data: {
      businessId: stay.businessId,
      guestStayId: stay.id,
      tokenHash,
      originQrCodeId: originQrCodeId ?? null,
      expiresAt,
    },
  });

  return { session, token };
}

/**
 * The per-request lookup: resolves a session cookie's raw token to its
 * GuestSession + parent GuestStay, by hash — never trusts a client-supplied
 * session/guest/stay id directly. Returns null if no session matches
 * (`resolveQrScan()` / `isGuestSessionValid()` treat that as "no session").
 */
export async function findSessionByToken(rawToken: string) {
  const tokenHash = hashGuestSessionToken(rawToken);
  return prisma.guestSession.findUnique({
    where: { tokenHash },
    include: { guestStay: true },
  });
}

export async function touchLastSeen(sessionId: string, now: Date = new Date()) {
  return prisma.guestSession.update({
    where: { id: sessionId },
    data: { lastSeenAt: now },
  });
}

/** Tenant-scoped revoke — e.g. "log out this device" from the guest portal. */
export async function revokeSession(businessId: string, sessionId: string, now: Date = new Date()) {
  return prisma.guestSession.updateMany({
    where: { id: sessionId, businessId, revokedAt: null },
    data: { revokedAt: now },
  });
}
