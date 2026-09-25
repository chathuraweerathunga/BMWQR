import { cache } from "react";
import { getGuestPortalContext } from "@/lib/guest-context";
import { getBusinessById } from "@/modules/business/repository";
import { getGuestById } from "@/modules/guests/repository";
import { getStayById } from "@/modules/guest-stays/repository";
import { getLocationById } from "@/modules/locations/repository";
import { getSessionWithLocation } from "@/modules/guest-sessions/repository";
import type { GuestActor } from "@/modules/auth/types";

export interface GuestBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  welcomeMessage: string | null;
  phone: string | null;
  timezone: string;
}

export interface GuestPortal {
  actor: GuestActor;
  branding: GuestBranding;
  guestName: string | null;
  checkOutAt: Date;
  /** The stay's own room/unit, if reception set one. */
  stayLocation: { id: string; name: string } | null;
  /** Where the guest last scanned a QR code, if anywhere active. */
  scannedLocation: { id: string; name: string } | null;
}

export type GuestPortalResult = { ok: true; portal: GuestPortal } | { ok: false; errorCode: string };

/**
 * Everything a guest page renders, derived only from the session cookie
 * (via getGuestPortalContext, which re-validates session and stay on every
 * call). Memoized per request so a layout and page share one lookup.
 */
export const loadGuestPortal = cache(async (): Promise<GuestPortalResult> => {
  const context = await getGuestPortalContext();
  if (!context.ok) return context;
  const { actor } = context;

  const [business, guest, stay, session] = await Promise.all([
    getBusinessById(actor.businessId),
    getGuestById(actor.businessId, actor.guestId),
    getStayById(actor.businessId, actor.guestStayId),
    getSessionWithLocation(actor.businessId, actor.guestSessionId),
  ]);
  if (!business || !stay || !session) return { ok: false, errorCode: "NO_GUEST_SESSION" };
  if (business.status === "SUSPENDED" || business.status === "CANCELLED") {
    return { ok: false, errorCode: "BUSINESS_INACTIVE" };
  }

  const stayLocationRow = stay.locationId ? await getLocationById(actor.businessId, stay.locationId) : null;
  const scanned =
    session.currentLocation && session.currentLocation.status === "ACTIVE" ? session.currentLocation : null;

  return {
    ok: true,
    portal: {
      actor,
      branding: {
        name: business.name,
        logoUrl: business.settings?.logoUrl ?? null,
        primaryColor: business.settings?.primaryColor ?? null,
        welcomeMessage: business.settings?.welcomeMessage ?? null,
        phone: business.settings?.phone ?? null,
        timezone: business.timezone,
      },
      guestName: guest?.fullName ?? null,
      checkOutAt: stay.checkOutAt,
      stayLocation:
        stayLocationRow && stayLocationRow.status === "ACTIVE"
          ? { id: stayLocationRow.id, name: stayLocationRow.name }
          : null,
      scannedLocation: scanned ? { id: scanned.id, name: scanned.name } : null,
    },
  };
});
