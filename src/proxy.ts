import { NextResponse, type NextRequest } from "next/server";

/**
 * Per-request Content Security Policy (Next.js 16 `proxy`, formerly
 * `middleware`). A fresh nonce every request means only scripts Next.js
 * itself rendered can run: an injected `<script>` can't guess the nonce,
 * which is the main defense-in-depth layer against XSS (project
 * instructions section 32: security headers).
 *
 * Notes on the directives:
 *  - `style-src 'unsafe-inline'`: tenant branding sets colors through
 *    inline `style` attributes (CSS variables). Nonces don't apply to
 *    style attributes, and inline styles can't execute code.
 *  - `img-src https:`: tenants may point their logo/cover at any HTTPS
 *    image host until first-party uploads (object storage) exist.
 *  - `frame-ancestors 'none'`: no one may embed OneWeb pages (clickjacking).
 *
 * The other, non-nonce headers (HSTS, nosniff, referrer policy, …) are set
 * for every response in next.config.ts.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${isDev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: API routes return JSON, and static assets need no CSP.
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
