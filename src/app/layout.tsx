import type { Metadata } from "next";
import "./globals.css";

// Deliberately no next/font/google usage: fetching Geist from Google Fonts
// at build time makes the build depend on external network access (it
// failed outright in this sandbox's restricted-egress environment — see
// docs/ARCHITECTURE.md). A system font stack (Tailwind's default
// `font-sans`) has no such dependency and is a perfectly reasonable choice
// before real branding/design work happens in a later milestone. If a
// custom typeface is wanted then, prefer `next/font/local` with a
// self-hosted font file over `next/font/google`.

export const metadata: Metadata = {
  title: "OneWeb",
  description: "Multi-tenant customer-service and business-operations platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
