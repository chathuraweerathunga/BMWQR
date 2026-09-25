import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { BedDouble } from "lucide-react";
import { getStaffContext } from "@/lib/staff-context";
import { permissionsForActor } from "@/modules/auth/permissions";
import { listActiveStaysForBusiness } from "@/modules/guest-stays/repository";
import { listLocationsForBusiness } from "@/modules/locations/repository";
import { checkInGuest, checkOutGuestStay } from "@/modules/guest-stays/service";
import { AuthorizationError } from "@/modules/auth/types";
import { ValidationError } from "@/lib/errors";
import { formatDate, formatTime, utcToZonedLocal, zonedLocalToUtc } from "@/lib/format";
import { PageHeader, Panel, PanelHeader, EmptyState } from "@/components/ui/Layout";
import { Alert } from "@/components/ui/Alert";
import { ConfirmSubmit } from "@/components/ui/ConfirmSubmit";
import { CheckInForm } from "./CheckInForm";
import type { CheckInRevealState } from "./types";

export const metadata: Metadata = { title: "Guests" };

/** Tomorrow at 11:00, property time: the most common checkout. */
function defaultCheckOut(timeZone: string): string {
  const tomorrow = new Date(new Date().getTime() + 24 * 60 * 60_000);
  return `${utcToZonedLocal(tomorrow, timeZone).slice(0, 10)}T11:00`;
}

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

  // Hiding the nav link is a convenience; this is the page's own check.
  // The service functions re-check guest_stay:create / :checkout anyway.
  if (!permissionsForActor(actor).has("guest_stay:create")) redirect(`/${businessSlug}/dashboard`);

  const tz = business.timezone;
  const [activeStays, locations] = await Promise.all([
    listActiveStaysForBusiness(business.id),
    listLocationsForBusiness(business.id),
  ]);
  const roomOptions = locations
    .filter((l: { status: string }) => l.status === "ACTIVE")
    .map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));

  async function checkInAction(_prev: CheckInRevealState | null, formData: FormData): Promise<CheckInRevealState | null> {
    "use server";
    const text = (name: string) => {
      const value = formData.get(name);
      return typeof value === "string" ? value.trim() : "";
    };
    const fail = (error: string): CheckInRevealState => ({ guestName: "", activationUrl: "", error });

    const guestFullName = text("guestFullName");
    if (!guestFullName) return fail("Enter the guest's name.");
    const checkOutAt = zonedLocalToUtc(text("checkOutAt"), tz);
    if (!checkOutAt || checkOutAt.getTime() <= new Date().getTime()) return fail("Choose a checkout time in the future.");

    try {
      const { guest, activationUrl, activationQr } = await checkInGuest(actor, {
        guestFullName,
        guestEmail: text("guestEmail") || null,
        guestPhone: text("guestPhone") || null,
        locationId: text("locationId") || null,
        checkOutAt,
      });
      revalidatePath(`/${businessSlug}/checkin`);
      return { guestName: guest.fullName, activationUrl, activationQr, nonce: new Date().getTime() };
    } catch (err) {
      if (err instanceof ValidationError) return fail(err.message);
      if (err instanceof AuthorizationError) return fail("You don't have permission to check guests in.");
      console.error("[checkin] unexpected failure", err);
      return fail("The guest couldn't be checked in. Try again.");
    }
  }

  async function checkOutAction(formData: FormData) {
    "use server";
    const guestStayId = formData.get("guestStayId");
    if (typeof guestStayId !== "string") return;
    try {
      await checkOutGuestStay(actor, guestStayId);
    } catch (err) {
      if (err instanceof AuthorizationError) redirect(`/${businessSlug}/checkin?error=NOT_ALLOWED`);
      throw err;
    }
    redirect(`/${businessSlug}/checkin`);
  }

  const tzLabel = tz.replace(/_/g, " ");

  return (
    <>
      <PageHeader
        title="Guests"
        description="Check guests in to give them guest services on their phone. Checking out ends their access immediately."
      />

      {error === "NOT_ALLOWED" && (
        <Alert tone="error" className="mb-6">
          You don&apos;t have permission to check guests out.
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[380px_1fr]">
        <Panel>
          <PanelHeader title="Check in" />
          <div className="p-5">
            <CheckInForm
              action={checkInAction}
              locations={roomOptions}
              defaultCheckOut={defaultCheckOut(tz)}
              timezoneLabel={tzLabel}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="In house"
            description={`${activeStays.length} ${activeStays.length === 1 ? "guest" : "guests"} checked in`}
          />
          {activeStays.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<BedDouble className="size-6" />} title="No one is checked in">
                Guests you check in appear here until they check out.
              </EmptyState>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {activeStays.map((stay: (typeof activeStays)[number]) => {
                const overdue = stay.checkOutAt.getTime() < new Date().getTime();
                return (
                  <li key={stay.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                    <div className="grid size-11 shrink-0 place-items-center rounded-[var(--radius-control)] bg-lagoon-50 text-sm font-extrabold text-lagoon-800">
                      {stay.location?.name.replace(/^room\s*/i, "").slice(0, 4) || "—"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{stay.guest.fullName}</p>
                      <p className="text-sm text-ink-faint">
                        {stay.location?.name ?? "No room"}. Checks out {formatDate(stay.checkOutAt, tz)},{" "}
                        {formatTime(stay.checkOutAt, tz)}
                        {overdue && <span className="ml-1.5 font-semibold text-danger">(past checkout)</span>}
                      </p>
                    </div>
                    <form action={checkOutAction}>
                      <input type="hidden" name="guestStayId" value={stay.id} />
                      <ConfirmSubmit confirmLabel="Check out now">Check out</ConfirmSubmit>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
