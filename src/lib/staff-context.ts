import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { getBusinessBySlug } from "@/modules/business/repository";
import { getCurrentUserId } from "@/lib/session";
import { getActiveMembership, toStaffActor } from "@/modules/staff/repository";
import type { StaffActor } from "@/modules/auth/types";

export interface StaffContext {
  business: NonNullable<Awaited<ReturnType<typeof getBusinessBySlug>>>;
  actor: StaffActor;
}

/**
 * Resolves which business a `/[businessSlug]/...` staff route is for, plus
 * the current user's `StaffActor` there. This is the ONLY place a staff
 * page should turn a URL slug into a businessId + actor — every page
 * under `app/[businessSlug]/**` should call this first, before reading
 * anything else.
 *
 * `cache()`-wrapped (React's per-request memoization) so a layout and the
 * page it wraps can both call this for the same request without a
 * duplicate set of lookups — not a cross-request cache.
 *
 * Deliberately indistinguishable outcomes, matching `AuthenticationError`'s
 * reasoning in lib/session.ts: an unknown slug and a real business the
 * user has no membership at both end in `notFound()` (404), never a
 * "that business exists but you're not on it" message that would let a
 * signed-in user enumerate other tenants' slugs.
 */
export const getStaffContext = cache(async (businessSlug: string): Promise<StaffContext> => {
  const business = await getBusinessBySlug(businessSlug);
  if (!business) notFound();

  const userId = await getCurrentUserId();
  if (!userId) redirect(`/login?next=/${businessSlug}`);

  const membership = await getActiveMembership(userId, business.id);
  if (!membership) notFound();

  return { business, actor: toStaffActor(membership) };
});
