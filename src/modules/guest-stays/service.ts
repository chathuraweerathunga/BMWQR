import { assertAuthorized } from "@/modules/auth/authorize";
import type { StaffActor } from "@/modules/auth/types";
import { env } from "@/lib/env";
import { createGuest } from "@/modules/guests/repository";
import { createSessionForStay } from "@/modules/guest-sessions/repository";
import { logAudit } from "@/modules/audit/service";
import * as repo from "./repository";

export interface CheckInGuestInput {
  guestFullName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  locationId?: string | null;
  checkOutAt: Date;
}

/**
 * The reception check-in flow (project instructions section 4/5, Method 1
 * "secure link... at check-in"). Creates the Guest + GuestStay + the
 * guest's FIRST GuestSession together, and returns an activation URL
 * embedding that session's raw token. Reception relays this link to the
 * guest by whatever channel the business uses (SMS, printed slip, email);
 * opening it (GET /portal/activate) is what actually sets the guest's
 * session cookie — the link itself is the "access code" a bare QR scan
 * cannot substitute for.
 *
 * `actor` must be a StaffActor with `guest_stay:create` (BUSINESS_OWNER or
 * MANAGER in the base matrix — see modules/auth/permissions.ts).
 */
export async function checkInGuest(actor: StaffActor, input: CheckInGuestInput) {
  assertAuthorized({
    actor,
    action: "guest_stay:create",
    resource: { businessId: actor.businessId },
  });

  const guest = await createGuest({
    businessId: actor.businessId,
    fullName: input.guestFullName,
    email: input.guestEmail,
    phone: input.guestPhone,
  });

  const guestStay = await repo.checkIn({
    businessId: actor.businessId,
    guestId: guest.id,
    locationId: input.locationId,
    checkOutAt: input.checkOutAt,
    createdByUserId: actor.userId,
  });

  const { token } = await createSessionForStay({
    id: guestStay.id,
    businessId: guestStay.businessId,
    checkOutAt: guestStay.checkOutAt,
  });

  const activationUrl = new URL("/portal/activate", env.APP_URL);
  activationUrl.searchParams.set("token", token);

  await logAudit(actor, {
    action: "guest_stay.checked_in",
    entityType: "GuestStay",
    entityId: guestStay.id,
    newValue: {
      guestId: guest.id,
      locationId: input.locationId ?? null,
      checkOutAt: input.checkOutAt.toISOString(),
    },
  });

  return { guest, guestStay, activationUrl: activationUrl.toString() };
}

/**
 * Reception (or a manager) ending a stay early / at departure. Flips the
 * stay to EXPIRED and revokes every session tied to it in one transaction
 * (repository.checkOut) — historical requests/feedback are untouched.
 */
export async function checkOutGuestStay(actor: StaffActor, guestStayId: string) {
  assertAuthorized({
    actor,
    action: "guest_stay:checkout",
    resource: { businessId: actor.businessId },
  });
  const result = await repo.checkOut(actor.businessId, guestStayId);
  if (result.checkedOut) {
    await logAudit(actor, {
      action: "guest_stay.checked_out",
      entityType: "GuestStay",
      entityId: guestStayId,
    });
  }
  return result;
}
