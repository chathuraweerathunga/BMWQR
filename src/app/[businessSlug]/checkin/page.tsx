import { redirect } from "next/navigation";
import { getStaffContext } from "@/lib/staff-context";
import { listActiveStaysForBusiness } from "@/modules/guest-stays/repository";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { checkInGuest, checkOutGuestStay } from "@/modules/guest-stays/service";
import { AuthorizationError } from "@/modules/auth/types";
import { CheckInForm } from "./CheckInForm";
import type { CheckInRevealState } from "./types";

export default async function CheckInPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { businessSlug } = await params;
  const { error } = await searchParams;
  const { business, actor } = await getStaffContext(businessSlug);

  // Route-level guard mirroring the QR page: the layout only hides the nav
  // link for STAFF. `checkInGuest`/`checkOutGuestStay` re-check
  // `guest_stay:create`/`guest_stay:checkout` regardless.
  if (actor.role !== "BUSINESS_OWNER" && actor.role !== "MANAGER") {
    redirect(`/${businessSlug}/dashboard`);
  }

  const [activeStays, locations] = await Promise.all([
    listActiveStaysForBusiness(business.id),
    listLocationsForBusiness(business.id),
  ]);

  async function checkInAction(
    _prevState: CheckInRevealState | null,
    formData: FormData,
  ): Promise<CheckInRevealState | null> {
    "use server";
    const guestFullName = formData.get("guestFullName");
    const guestEmail = formData.get("guestEmail");
    const guestPhone = formData.get("guestPhone");
    const locationId = formData.get("locationId");
    const checkOutAtRaw = formData.get("checkOutAt");

    if (typeof guestFullName !== "string" || guestFullName.trim().length === 0) {
      return { guestName: "", activationUrl: "", error: "Guest name is required." };
    }
    if (typeof checkOutAtRaw !== "string" || checkOutAtRaw.length === 0) {
      return { guestName: "", activationUrl: "", error: "Checkout date/time is required." };
    }
    const checkOutAt = new Date(checkOutAtRaw);
    const submittedAt = new Date();
    if (Number.isNaN(checkOutAt.getTime()) || checkOutAt.getTime() <= submittedAt.getTime()) {
      return { guestName: "", activationUrl: "", error: "Checkout must be a valid future date/time." };
    }

    try {
      const { guest, activationUrl } = await checkInGuest(actor, {
        guestFullName: guestFullName.trim(),
        guestEmail: typeof guestEmail === "string" && guestEmail.length > 0 ? guestEmail : null,
        guestPhone: typeof guestPhone === "string" && guestPhone.length > 0 ? guestPhone : null,
        locationId: typeof locationId === "string" && locationId.length > 0 ? locationId : null,
        checkOutAt,
      });
      return { guestName: guest.fullName, activationUrl };
    } catch (err) {
      const message =
        err instanceof AuthorizationError
          ? "You don't have permission to check in guests."
          : "Something went wrong — please try again.";
      return { guestName: "", activationUrl: "", error: message };
    }
  }

  async function checkOutAction(formData: FormData) {
    "use server";
    const guestStayId = formData.get("guestStayId");
    if (typeof guestStayId !== "string") return;

    try {
      await checkOutGuestStay(actor, guestStayId);
    } catch (err) {
      const message = err instanceof AuthorizationError ? "NOT_ALLOWED" : "UNKNOWN";
      redirect(`/${businessSlug}/checkin?error=${message}`);
    }
    redirect(`/${businessSlug}/checkin`);
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-lg font-semibold">Guest check-in</h1>

      {error && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          That action couldn&apos;t be completed ({error}).
        </p>
      )}

      <CheckInForm action={checkInAction} locations={locations} />

      <div>
        <h2 className="mb-2 text-sm font-semibold">Currently checked in</h2>
        {activeStays.length === 0 ? (
          <p className="text-sm text-gray-500">No active guest stays.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {activeStays.map((stay: (typeof activeStays)[number]) => (
              <li
                key={stay.id}
                className="flex items-center justify-between rounded border border-gray-200 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {stay.guest.fullName}
                    {stay.location ? ` · ${stay.location.name}` : ""}
                  </p>
                  <p className="text-xs text-gray-500">
                    Checkout: {stay.checkOutAt.toLocaleString()}
                  </p>
                </div>
                <form action={checkOutAction}>
                  <input type="hidden" name="guestStayId" value={stay.id} />
                  <button
                    type="submit"
                    className="rounded border border-gray-300 px-3 py-1 text-xs font-medium"
                  >
                    Check out
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
