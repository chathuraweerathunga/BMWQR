/* eslint-disable @next/next/no-img-element -- tenant logos come from arbitrary
   HTTPS hosts until first-party uploads exist; next/image would need each
   host allow-listed. */
import { brandStyle } from "@/lib/brand";
import type { GuestBranding } from "@/lib/guest-portal";
import { GuestTabs } from "./GuestTabs";

/**
 * The frame for every signed-in guest page: the hotel's own name, logo and
 * color, not OneWeb's. One column, sized for a phone held in one hand,
 * with the tab bar at the bottom.
 */
export function GuestShell({
  branding,
  children,
  showTabs = true,
}: {
  branding: GuestBranding;
  children: React.ReactNode;
  showTabs?: boolean;
}) {
  return (
    <div style={brandStyle(branding.primaryColor)} className="flex min-h-screen flex-col bg-paper">
      <header className="bg-[var(--brand)] text-[var(--brand-ink)]">
        <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-5">
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt=""
              className="size-9 rounded-full bg-white object-contain p-1"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-white/15 font-display text-lg">
              {branding.name.charAt(0)}
            </span>
          )}
          <p className="truncate font-display text-lg">{branding.name}</p>
        </div>
      </header>
      <main className={showTabs ? "flex-1 pb-24" : "flex-1 pb-10"}>
        <div className="mx-auto max-w-lg px-5">{children}</div>
      </main>
      {showTabs && <GuestTabs />}
    </div>
  );
}

/** Shown when a guest has no usable session: plain, calm, and specific. */
export function GuestNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-lagoon-50 font-display text-2xl text-lagoon-800">
        ?
      </div>
      <h1 className="mt-5 font-display text-[28px] text-lagoon-900">{title}</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-ink-soft">{message}</p>
    </div>
  );
}
