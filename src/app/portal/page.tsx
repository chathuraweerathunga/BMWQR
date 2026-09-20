import { redirect } from "next/navigation";
import Link from "next/link";
import { getGuestPortalContext, GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { getGuestById } from "@/modules/guests/repository";
import { getStayById } from "@/modules/guest-stays/repository";
import { listActiveServicesForBusiness } from "@/modules/services/repository";
import { createGuestRequest } from "@/modules/requests/service";
import { rateLimit } from "@/lib/rate-limit";

const REQUEST_SUBMIT_LIMIT = 10;
const REQUEST_SUBMIT_WINDOW_MS = 5 * 60_000;

const REQUEST_FORM_ERROR_MESSAGES: Record<string, string> = {
  NO_LOCATION: "We don't know your location — scan the QR code in your room or area first.",
  MISSING_TITLE: "Please describe what you need.",
  RATE_LIMITED: "Too many requests — please wait a few minutes and try again.",
};

/**
 * Minimal, functional guest portal — deliberately plain (no branding,
 * layout, or design polish yet; that's later milestone work). It exists
 * now to prove the check-in → activation → QR scan → request-creation
 * flow end to end. Every guest-facing decision here (session validity,
 * authorization, request creation) reuses the same modules the route
 * handlers use — nothing is re-implemented in the page itself.
 */
export default async function GuestPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; location?: string; submitted?: string }>;
}) {
  const { error, location: scannedLocationId, submitted } = await searchParams;
  const context = await getGuestPortalContext();

  if (!context.ok) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Guest services</h1>
        <p className="text-sm text-gray-600">
          {GUEST_ERROR_MESSAGES[error ?? context.errorCode] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
        </p>
      </main>
    );
  }

  const { actor } = context;

  const [guest, stay, services] = await Promise.all([
    getGuestById(actor.businessId, actor.guestId),
    getStayById(actor.businessId, actor.guestStayId),
    listActiveServicesForBusiness(actor.businessId),
  ]);

  const effectiveLocationId = scannedLocationId ?? stay?.locationId ?? null;

  async function submitRequest(formData: FormData) {
    "use server";

    // Keyed by the guest's own session — already authenticated, so this
    // catches a single guest spamming requests without also penalizing an
    // entire hotel sharing one NAT'd IP address (section 32: rate limiting
    // / abuse detection).
    const limitResult = rateLimit(
      `request-create:${actor.guestSessionId}`,
      REQUEST_SUBMIT_LIMIT,
      REQUEST_SUBMIT_WINDOW_MS,
    );
    if (!limitResult.allowed) {
      redirect("/portal?error=RATE_LIMITED");
    }

    const locationId = formData.get("locationId");
    const serviceId = formData.get("serviceId");
    const title = formData.get("title");
    if (typeof locationId !== "string" || !locationId) {
      redirect("/portal?error=NO_LOCATION");
    }
    if (typeof title !== "string" || !title.trim()) {
      redirect("/portal?error=MISSING_TITLE");
    }

    await createGuestRequest(actor, {
      locationId: locationId as string,
      serviceId: typeof serviceId === "string" && serviceId ? serviceId : null,
      title: title as string,
    });

    redirect("/portal?submitted=1");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">
          Welcome{guest?.fullName ? `, ${guest.fullName}` : ""}
        </h1>
        <p className="text-sm text-gray-500">How can we help?</p>
      </header>

      {submitted && (
        <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
          Request received — we&apos;ll let you know as soon as it&apos;s handled.
        </p>
      )}

      {error && REQUEST_FORM_ERROR_MESSAGES[error] && (
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {REQUEST_FORM_ERROR_MESSAGES[error]}
        </p>
      )}

      {!effectiveLocationId && (
        <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Scan the QR code in your room or the area you&apos;re in so we know where to send help.
        </p>
      )}

      <form action={submitRequest} className="flex flex-col gap-3">
        <input type="hidden" name="locationId" value={effectiveLocationId ?? ""} />
        <label className="flex flex-col gap-1 text-sm">
          Service
          <select name="serviceId" className="rounded border border-gray-300 px-3 py-2">
            <option value="">General request</option>
            {services.map((service: { id: string; name: string }) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          What do you need?
          <textarea
            name="title"
            required
            rows={3}
            placeholder="e.g. Two extra towels, please"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <button
          type="submit"
          disabled={!effectiveLocationId}
          className="rounded bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          Send request
        </button>
      </form>

      <Link href="/portal/feedback" className="text-center text-sm text-gray-500 underline">
        Leave feedback about your stay
      </Link>
    </main>
  );
}
