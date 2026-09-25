import { auth, signOut } from "@/auth";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import type { Permission } from "@/modules/auth/types";
import { AppShell, type NavGroup, type NavItem } from "@/components/app/AppShell";
import { RequestPulse } from "@/components/app/RequestPulse";

const ROLE_LABEL = {
  BUSINESS_OWNER: "Owner",
  MANAGER: "Manager",
  STAFF: "Staff",
} as const;

/**
 * Shared chrome + access guard for every staff route scoped to one
 * business. `getStaffContext` ends in `notFound()`/`redirect()` unless the
 * slug resolves to a business where the signed-in user holds an ACTIVE
 * membership, so rendering this layout at all IS the access check.
 *
 * Navigation is derived from the central permission matrix: a link is
 * shown only if the role holds the permission its page needs. Hiding a
 * link is a convenience; each page and action still authorizes itself.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const [{ business, actor }, session] = await Promise.all([getStaffContext(businessSlug), auth()]);
  const can = (permission: Permission) => permissionsForActor(actor).has(permission);
  const base = `/${businessSlug}`;

  const item = (path: string, label: string, icon: NavItem["icon"], permission?: Permission) =>
    !permission || can(permission) ? [{ href: `${base}/${path}`, label, icon }] : [];

  const groups: NavGroup[] = [
    {
      label: "Operations",
      items: [
        ...item("dashboard", "Requests", "requests"),
        ...item("checkin", "Guests", "checkin", "guest_stay:create"),
        ...item("manager", "Overview", "manager", "business:view_analytics"),
      ],
    },
    {
      label: "Property setup",
      items: [
        ...item("locations", "Locations", "locations", "location:manage"),
        ...item("departments", "Departments", "departments", "department:manage"),
        ...item("services", "Services", "services", "service:manage"),
        ...item("qr", "QR codes", "qr", "qr:manage"),
        ...item("staff", "Team", "staff", "staff:invite"),
      ],
    },
    {
      label: "Administration",
      items: [
        ...item("settings", "Settings", "settings", "business:update_settings"),
        ...item("audit", "Audit log", "audit", "business:view_audit_log"),
      ],
    },
  ].filter((group) => group.items.length > 0);

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AppShell
      businessName={business.name}
      groups={groups}
      userName={session?.user?.name ?? session?.user?.email ?? "Signed in"}
      roleLabel={ROLE_LABEL[actor.role]}
      accountHref={`${base}/account`}
      signOutAction={signOutAction}
    >
      {children}
      <RequestPulse businessSlug={businessSlug} />
    </AppShell>
  );
}
