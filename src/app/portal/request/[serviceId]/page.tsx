import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { loadGuestPortal } from "@/lib/guest-portal";
import { GUEST_ERROR_MESSAGES } from "@/lib/guest-context";
import { getServiceById } from "@/modules/services/repository";
import { createGuestRequest } from "@/modules/requests/service";
import { MAX_REQUEST_DETAILS_LENGTH, MAX_REQUEST_TITLE_LENGTH } from "@/modules/requests/guest-request-rules";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";
import { GuestNotice, GuestShell } from "@/components/guest/GuestShell";
import { ServiceIcon } from "@/components/guest/ServiceIcon";
import { Alert } from "@/components/ui/Alert";
import { Field, Input, Textarea } from "@/components/ui/Form";
import { SubmitButton } from "@/components/ui/SubmitButton";

export const metadata: Metadata = { title: "New request", robots: { index: false } };

const REQUEST_SUBMIT_LIMIT = 10;
const REQUEST_SUBMIT_WINDOW_MS = 5 * 60_000;

const ERRORS: Record<string, string> = {
  MISSING_TITLE: "Tell us what you need.",
  NO_LOCATION: "We don't know where you are yet. Scan the QR code in your room or area, then try again.",
  LOCATION_UNAVAILABLE: "That location isn't taking requests right now. Please call reception.",
  SERVICE_UNAVAILABLE: "That service isn't available right now. Choose another, or send a general request.",
  RATE_LIMITED: "You've sent several requests in a few minutes. Wait a moment, then try again.",
};

/**
 * One request, one screen: the chosen service, an optional note, and where
 * to send help. The service id in the URL is only a selection; the server
 * re-checks it belongs to this property and is active before using it.
 */
export default async function NewRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ serviceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ serviceId }, { error }] = await Promise.all([params, searchParams]);
  const result = await loadGuestPortal();
  if (!result.ok) {
    return (
      <GuestNotice
        title="Guest services"
        message={GUEST_ERROR_MESSAGES[result.errorCode] ?? GUEST_ERROR_MESSAGES.NO_GUEST_SESSION}
      />
    );
  }
  const { portal } = result;

  const isGeneral = serviceId === "other";
  const service = isGeneral ? null : await getServiceById(portal.actor.businessId, serviceId);
  if (!isGeneral && (!service || !service.isActive)) notFound();

  const { scannedLocation, stayLocation } = portal;
  const offerChoice = scannedLocation && stayLocation && scannedLocation.id !== stayLocation.id;
  const helpAt = scannedLocation ?? stayLocation;

  async function submit(formData: FormData) {
    "use server";
    const fresh = await loadGuestPortal();
    if (!fresh.ok) redirect(`/portal?error=${fresh.errorCode}`);
    const { actor } = fresh.portal;
    const back = `/portal/request/${serviceId}`;

    const limit = await rateLimit(`request-create:${actor.guestSessionId}`, REQUEST_SUBMIT_LIMIT, REQUEST_SUBMIT_WINDOW_MS);
    if (!limit.allowed) redirect(`${back}?error=RATE_LIMITED`);

    const note = formData.get("note");
    const titleField = formData.get("title");
    const where = formData.get("where");
    const title =
      typeof titleField === "string" && titleField.trim()
        ? titleField
        : service
          ? service.name
          : "";

    let created: { id: string };
    try {
      created = await createGuestRequest(actor, {
        where: where === "stay" || where === "scanned" ? where : null,
        serviceId: service?.id ?? null,
        title,
        description: typeof note === "string" ? note : null,
      });
    } catch (err) {
      if (err instanceof ValidationError && ERRORS[err.message]) redirect(`${back}?error=${err.message}`);
      if (err instanceof NotFoundError) redirect("/portal?error=NO_GUEST_SESSION");
      throw err;
    }
    redirect(`/portal/requests?sent=${encodeURIComponent(created.id)}`);
  }

  return (
    <GuestShell branding={portal.branding} showTabs={false}>
      <Link
        href="/portal"
        className="-ml-2 mt-4 inline-flex h-10 items-center gap-1 rounded-[var(--radius-control)] px-2 text-sm font-semibold text-ink-soft hover:bg-sunken"
      >
        <ChevronLeft className="size-4" aria-hidden />
        All services
      </Link>

      <div className="mt-3 flex items-center gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[var(--brand-soft)] text-[var(--brand)]">
          <ServiceIcon icon={service?.icon} name={service?.name ?? "general"} className="size-7" />
        </span>
        <div>
          <h1 className="font-display text-[28px] leading-tight text-ink">{service?.name ?? "Something else"}</h1>
          {service?.description && <p className="mt-0.5 text-sm text-ink-soft">{service.description}</p>}
        </div>
      </div>

      {error && ERRORS[error] && (
        <Alert tone="error" className="mt-6">
          {ERRORS[error]}
        </Alert>
      )}

      <form action={submit} className="mt-7 flex flex-col gap-6">
        {isGeneral && (
          <Field label="What do you need?" htmlFor="title">
            <Input
              id="title"
              name="title"
              required
              maxLength={MAX_REQUEST_TITLE_LENGTH}
              placeholder="An extra blanket, please"
              autoComplete="off"
            />
          </Field>
        )}

        <Field
          label={isGeneral ? "Details" : "Anything we should know?"}
          htmlFor="note"
          optional
          hint={service?.estimatedMinutes ? `Usually takes about ${service.estimatedMinutes} minutes.` : undefined}
        >
          <Textarea
            id="note"
            name="note"
            rows={3}
            maxLength={MAX_REQUEST_DETAILS_LENGTH}
            placeholder={service ? "Quantity, timing, anything specific" : "Anything that helps us help you"}
          />
        </Field>

        {offerChoice ? (
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Where should we come?</legend>
            <div className="mt-2 grid gap-2">
              {[
                { value: "scanned", label: scannedLocation.name, sub: "Where you scanned" },
                { value: "stay", label: stayLocation.name, sub: "Your room" },
              ].map((opt, i) => (
                <label
                  key={opt.value}
                  className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] border border-line-strong bg-surface px-4 py-3 has-[:checked]:border-[var(--brand)] has-[:checked]:bg-[var(--brand-soft)]"
                >
                  <input
                    type="radio"
                    name="where"
                    value={opt.value}
                    defaultChecked={i === 0}
                    className="size-4 accent-[var(--brand)]"
                  />
                  <span>
                    <span className="block font-bold text-ink">{opt.label}</span>
                    <span className="text-xs text-ink-faint">{opt.sub}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : helpAt ? (
          <p className="text-sm text-ink-soft">
            We&apos;ll come to <span className="font-bold text-ink">{helpAt.name}</span>.
          </p>
        ) : (
          <Alert tone="info">Scan the QR code in your room or area first, so we know where to come.</Alert>
        )}

        <SubmitButton variant="brand" size="lg" block pendingLabel="Sending" disabled={!helpAt}>
          Send request
        </SubmitButton>
      </form>
    </GuestShell>
  );
}
