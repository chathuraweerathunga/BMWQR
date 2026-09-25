"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BarChart3,
  BedDouble,
  Building2,
  ClipboardList,
  ConciergeBell,
  LogOut,
  MapPin,
  Menu,
  QrCode,
  ScrollText,
  Settings,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Avatar } from "@/components/ui/Layout";
import { cn } from "@/lib/cn";

export type NavIcon =
  | "requests"
  | "checkin"
  | "manager"
  | "locations"
  | "departments"
  | "services"
  | "qr"
  | "staff"
  | "settings"
  | "audit";

const ICONS: Record<NavIcon, LucideIcon> = {
  requests: ClipboardList,
  checkin: BedDouble,
  manager: BarChart3,
  locations: MapPin,
  departments: Building2,
  services: ConciergeBell,
  qr: QrCode,
  staff: Users,
  settings: Settings,
  audit: ScrollText,
};

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs font-semibold text-white/45">{group.label}</p>
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition-colors",
                  active ? "bg-white/12 text-white" : "text-white/70 hover:bg-white/6 hover:text-white",
                )}
              >
                <Icon className={cn("size-[18px]", active ? "text-brass-300" : "text-white/50")} aria-hidden />
                {item.label}
                {item.icon === "requests" && <NewRequestsBadge />}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/** Live count of NEW requests, fed by RequestPulse via a window event. */
function NewRequestsBadge() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    const onPulse = (event: Event) => setCount((event as CustomEvent<number>).detail);
    window.addEventListener("oneweb:new-count", onPulse);
    return () => window.removeEventListener("oneweb:new-count", onPulse);
  }, []);
  if (!count) return null;
  return (
    <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brass-500 px-1.5 text-[11px] font-bold text-lagoon-900 tabular">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function Account({
  userName,
  roleLabel,
  accountHref,
  signOutAction,
}: {
  userName: string;
  roleLabel: string;
  accountHref: string;
  signOutAction: () => Promise<void>;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-white/10 pt-4">
      <Link href={accountHref} className="flex min-w-0 flex-1 items-center gap-3 rounded-[var(--radius-control)] p-1 -m-1 hover:bg-white/6" title="Your account">
        <Avatar name={userName} className="bg-brass-300 text-lagoon-900" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{userName}</span>
          <span className="block text-xs text-white/55">{roleLabel}</span>
        </span>
      </Link>
      <form action={signOutAction}>
        <button
          type="submit"
          className="grid size-9 place-items-center rounded-[var(--radius-control)] text-white/60 hover:bg-white/10 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({
  businessName,
  groups,
  userName,
  roleLabel,
  accountHref,
  signOutAction,
  children,
}: {
  businessName: string;
  groups: NavGroup[];
  userName: string;
  roleLabel: string;
  accountHref: string;
  signOutAction: () => Promise<void>;
  children: React.ReactNode;
}) {
  // The drawer closes itself when a link in it is followed (onNavigate).
  const [open, setOpen] = useState(false);

  const sidebar = (
    <div className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="px-3">
        <Wordmark tone="light" />
        <p className="mt-4 truncate text-[15px] font-bold text-white" title={businessName}>
          {businessName}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
      </div>
      <div className="px-1">
        <Account userName={userName} roleLabel={roleLabel} accountHref={accountHref} signOutAction={signOutAction} />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="sticky top-0 hidden h-screen bg-lagoon-900 lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-ml-2 grid size-10 place-items-center rounded-[var(--radius-control)] text-ink hover:bg-sunken"
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu className="size-5" />
        </button>
        <p className="truncate px-2 text-[15px] font-bold">{businessName}</p>
        <span className="size-10" aria-hidden />
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button
            type="button"
            className="absolute inset-0 bg-lagoon-900/50"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
          <aside className="absolute inset-y-0 left-0 w-[280px] bg-lagoon-900 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 grid size-9 place-items-center rounded-[var(--radius-control)] text-white/70 hover:bg-white/10"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
