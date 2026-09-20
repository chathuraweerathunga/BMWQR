import Link from "next/link";
import { getStaffContext } from "@/lib/staff-context";

/**
 * Shared chrome + access guard for every staff route scoped to one
 * business. `getStaffContext` throws (via `notFound()`/`redirect()`) if
 * the slug doesn't resolve to a business the signed-in user has an ACTIVE
 * membership at — so simply rendering this layout is the access check for
 * every page nested under it.
 */
export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const { business, actor } = await getStaffContext(businessSlug);

  const canManage = actor.role === "BUSINESS_OWNER" || actor.role === "MANAGER";

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <span className="font-semibold">{business.name}</span>
          <nav className="flex gap-4 text-sm text-gray-600">
            <Link href={`/${businessSlug}/dashboard`}>Requests</Link>
            {canManage && (
              <>
                <Link href={`/${businessSlug}/checkin`}>Check-in</Link>
                <Link href={`/${businessSlug}/locations`}>Locations</Link>
                <Link href={`/${businessSlug}/departments`}>Departments</Link>
                <Link href={`/${businessSlug}/services`}>Services</Link>
                <Link href={`/${businessSlug}/staff`}>Staff</Link>
                <Link href={`/${businessSlug}/qr`}>QR Codes</Link>
                <Link href={`/${businessSlug}/manager`}>Manager</Link>
                <Link href={`/${businessSlug}/audit`}>Audit log</Link>
                <Link href={`/${businessSlug}/settings`}>Settings</Link>
              </>
            )}
          </nav>
          <span className="text-sm text-gray-500">{actor.role}</span>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
