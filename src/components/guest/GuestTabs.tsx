"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LayoutGrid, Star } from "lucide-react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/portal", label: "Services", icon: LayoutGrid },
  { href: "/portal/requests", label: "My requests", icon: ClipboardList },
  { href: "/portal/feedback", label: "Feedback", icon: Star },
];

/** Thumb-reach tab bar for the guest portal. */
export function GuestTabs() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Guest services"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-3">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/portal" ? pathname === "/portal" || pathname.startsWith("/portal/request/") : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-xs font-semibold",
                  active ? "text-[var(--brand)]" : "text-ink-faint hover:text-ink",
                )}
              >
                <Icon className="size-[22px]" aria-hidden strokeWidth={active ? 2.4 : 2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
