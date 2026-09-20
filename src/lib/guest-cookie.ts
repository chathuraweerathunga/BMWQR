/**
 * The one cookie a guest's browser carries: an opaque session token (see
 * modules/guest-sessions). Centralized here so every route that sets,
 * reads, or clears it agrees on the name and security flags — a guest
 * portal accidentally using `sameSite: "none"` or skipping `httpOnly` in
 * one route while another gets it right is exactly the kind of drift this
 * file exists to prevent.
 */
export const GUEST_SESSION_COOKIE = "oneweb_guest_session";

/** Minimal shape both `next/headers`' cookies() and a Route Handler's
 * `NextResponse.cookies` satisfy, so this helper works in either context. */
interface CookieWriter {
  set(name: string, value: string, options: Record<string, unknown>): void;
  delete(name: string): void;
}

export function setGuestSessionCookie(
  writer: CookieWriter,
  token: string,
  expiresAt: Date,
): void {
  writer.set(GUEST_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearGuestSessionCookie(writer: CookieWriter): void {
  writer.delete(GUEST_SESSION_COOKIE);
}
