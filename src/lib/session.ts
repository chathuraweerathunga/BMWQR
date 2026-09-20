import { auth } from "@/auth";
import { AuthenticationError } from "@/lib/errors";
import { getActiveMembership, toStaffActor } from "@/modules/staff/repository";
import type { StaffActor } from "@/modules/auth/types";

/**
 * The bridge between "who is signed in" (Auth.js) and "what can they do at
 * THIS business" (the RBAC core). A signed-in session only ever proves
 * identity — every route handler that acts on a specific business must
 * call `requireStaffActor(businessId)` to get a `StaffActor`, never
 * construct one from the session directly. `businessId` here must come
 * from a trusted server-side source (a route param resolved against the
 * database, a selected-business cookie you control) — never end-to-end
 * from an unvalidated client field, though `authorize()` would still
 * reject a mismatched one downstream regardless.
 */

export async function getCurrentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/**
 * Resolves a `StaffActor` for the current session at `businessId`, or
 * throws `AuthenticationError` if the user isn't signed in OR has no
 * ACTIVE membership there. Those two cases are deliberately
 * indistinguishable to the caller (see AuthenticationError's doc comment)
 * — don't branch on "signed in but no membership" vs "not signed in" in
 * a way that would leak which businesses exist to an authenticated user
 * probing ids they don't belong to.
 */
export async function requireStaffActor(businessId: string): Promise<StaffActor> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new AuthenticationError();
  }
  const membership = await getActiveMembership(userId, businessId);
  if (!membership) {
    throw new AuthenticationError();
  }
  return toStaffActor(membership);
}
