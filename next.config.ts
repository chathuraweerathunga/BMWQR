import type { NextConfig } from "next";

/**
 * Security headers applied to every response, static assets included
 * (project instructions section 32). The Content-Security-Policy is not
 * here: it needs a per-request nonce, so src/proxy.ts sets it.
 */
const securityHeaders = [
  // Browsers only ever talk to OneWeb over HTTPS, for two years, including
  // subdomains (custom tenant domains are a later milestone).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy clickjacking protection for browsers that ignore frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Tokens can appear in URLs (/qr/<token>, activation links). Never send
  // a full URL to another origin.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // OneWeb needs none of these device capabilities.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Token-bearing entry points: never cache, never leak via referrer.
      {
        source: "/(qr|portal/activate)/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
