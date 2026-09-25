import { NextResponse, type NextRequest } from "next/server";
import { scanQr } from "@/modules/qr/scan-service";
import { GUEST_SESSION_COOKIE } from "@/lib/guest-cookie";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

const QR_SCAN_LIMIT = 30;
const QR_SCAN_WINDOW_MS = 60_000;

/**
 * The QR scan entry point. Per project instructions section 6, a QR code
 * identifies a location — it does not by itself grant access. All of the
 * actual decision logic lives in `scanQr()` / `resolveQrScan()`; this
 * handler's only job is the HTTP plumbing: read the token from the path,
 * read the guest's session token from their cookie (never from the URL or
 * a request body), and turn the result into a redirect.
 *
 * Rate-limited by IP (spec section 6 step 9 / section 44: "public QR
 * endpoints require special protection") — this is an unauthenticated,
 * publicly guessable-shaped URL, so it's the kind of endpoint someone
 * could hammer while brute-forcing tokens. 30/min is generous for a real
 * guest scanning a physical QR code repeatedly, tight enough to blunt
 * automated probing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getClientIp(request.headers);
  const limitResult = await rateLimit(`qr-scan:${ip}`, QR_SCAN_LIMIT, QR_SCAN_WINDOW_MS);
  if (!limitResult.allowed) {
    return NextResponse.redirect(new URL("/portal?error=RATE_LIMITED", request.url));
  }

  const { token } = await params;
  const sessionTokenFromCookie = request.cookies.get(GUEST_SESSION_COOKIE)?.value ?? null;

  const result = await scanQr({ rawQrToken: token, sessionTokenFromCookie });

  if (!result.ok) {
    return NextResponse.redirect(new URL(`/portal?error=${result.reason}`, request.url));
  }

  // The scanned location is now stored on the guest's session server-side
  // (see scanQr), so nothing about it travels in the URL.
  return NextResponse.redirect(new URL("/portal?scanned=1", request.url));
}
