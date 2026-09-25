import { NextResponse, type NextRequest } from "next/server";
import { findSessionByToken } from "@/modules/guest-sessions/repository";
import { isGuestSessionValid } from "@/modules/guest-sessions/guest-session";
import { setGuestSessionCookie } from "@/lib/guest-cookie";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const ACTIVATE_LIMIT = 20;
const ACTIVATE_WINDOW_MS = 60_000;

/**
 * The guest's entry point from a reception-issued activation link (see
 * modules/guest-stays/service.ts: checkInGuest). This is the ONLY route
 * that turns a raw session token from a URL into the guest's cookie —
 * every other guest-facing route only ever reads the cookie, never a URL
 * or body parameter, for its session token.
 *
 * Rate-limited by IP for the same reason as the QR scan route (section 44):
 * it's an unauthenticated, token-bearing public URL, so it needs its own
 * throttle against token-guessing rather than relying on the token's
 * entropy alone.
 */
export async function GET(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const limitResult = await rateLimit(`portal-activate:${ip}`, ACTIVATE_LIMIT, ACTIVATE_WINDOW_MS);
  if (!limitResult.allowed) {
    return NextResponse.redirect(new URL("/portal?error=RATE_LIMITED", request.url));
  }

  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/portal?error=INVALID_TOKEN", request.url));
  }

  const session = await findSessionByToken(token);
  const now = new Date();

  const valid =
    session &&
    isGuestSessionValid(
      { expiresAt: session.expiresAt, revokedAt: session.revokedAt },
      { status: session.guestStay.status, checkOutAt: session.guestStay.checkOutAt },
      now,
    ).valid;

  if (!session || !valid) {
    return NextResponse.redirect(new URL("/portal?error=INVALID_TOKEN", request.url));
  }

  const response = NextResponse.redirect(new URL("/portal", request.url));
  setGuestSessionCookie(response.cookies, token, session.expiresAt);
  return response;
}
