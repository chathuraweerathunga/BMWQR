import Link from "next/link";
import { getCurrentUserId } from "@/lib/session";
import { listActiveMembershipsForUser } from "@/modules/staff/repository";

/**
 * The signed-in landing page and business switcher (project instructions
 * section 13: a user can hold memberships at more than one business).
 * `requireStaffActor`/`getStaffContext` never needed a page like this to
 * function — a URL slug was always enough — but a signed-in user with more
 * than one membership had no way to discover their other businesses'
 * slugs. This is also where `signIn`'s default `redirectTo: "/"` (see
 * app/login/page.tsx) actually lands someone.
 */
export default async function HomePage() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-semibold">OneWeb</h1>
        <p className="text-sm text-gray-500">
          Customer-service and operations management for hotels and similar businesses.
        </p>
        <div className="flex gap-3">
          <Link href="/login" className="rounded border border-gray-300 px-4 py-2 text-sm font-medium">
            Staff sign in
          </Link>
          <Link href="/signup" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            Create a workspace
          </Link>
        </div>
      </main>
    );
  }

  const memberships = await listActiveMembershipsForUser(userId);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-lg font-semibold">Your businesses</h1>

      {memberships.length === 0 ? (
        <div className="flex flex-col gap-3 text-center">
          <p className="text-sm text-gray-500">
            You&apos;re signed in, but don&apos;t belong to any business yet.
          </p>
          <Link href="/signup" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
            Create a workspace
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {memberships.map((membership: (typeof memberships)[number]) => (
            <li key={membership.id}>
              <Link
                href={`/${membership.business.slug}/dashboard`}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-3 hover:bg-gray-50"
              >
                <span className="text-sm font-medium">{membership.business.name}</span>
                <span className="text-xs text-gray-500">{membership.role}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
