import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OneWeb — guest requests, handled",
    template: "%s · OneWeb",
  },
  description:
    "OneWeb turns guest requests into organised, trackable staff work, and shows managers what is happening across the property right now.",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0f3a35",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading request headers opts every route into dynamic rendering, which
  // the per-request CSP nonce set in src/proxy.ts requires: Next.js stamps
  // that nonce onto its own scripts only while rendering a live request.
  await headers();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
